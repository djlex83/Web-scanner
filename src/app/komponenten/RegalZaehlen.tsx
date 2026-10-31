import { Camera, Copy, ImageUp, Plus, RefreshCw, ScanLine, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Stueck } from "../../gemeinsam/typen";
import {
  codesZuPunkten,
  aktiveZiele,
  MAX_ZIEL_TEXT,
  MAX_ZIELE,
  ZAEHL_MODELL_NAME,
  ZAEHL_MODELLE,
  zieleVorschlagen,
  type CodeOrt,
  type ZaehlAntwort,
  type ZaehlDiagnose,
  type ZaehlModell,
  type ZaehlPunkt,
  type ZaehlZiel,
} from "../../gemeinsam/zaehlen";
import { fehlerText, senden } from "../lib/api";
import { anzahl } from "../lib/format";
import { amRechner } from "../lib/kamera";
import { useLaden } from "../lib/hooks";
import { signalFertig } from "../lib/rueckmeldung";
import { erkennen } from "../scanner/erkennung";
import { Blatt } from "../ui/blatt";
import { Auswahl, Eingabe, Feld } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis, Kreisel } from "../ui/zustand";
import { KameraAufnahme } from "./KameraAufnahme";

/**
 * Längste Bildseite, die ans Modell geht. 1600 px: In vollen Regalen (30+ Teile) bleiben so je Teil
 * noch gut 50 px; größer kostet Upload und Tokens, ohne dass die Modelle merklich besser zählen.
 */
const MAX_SEITE = 1600;

/** Leeres Eingabefeld, wenn das Regal laut System leer ist – dann trägt man selbst ein, was gezählt wird. */
const LEERE_ART: ZaehlZiel = { text: "", soll: 0 };
const vorschlagFuer = (stuecke: Stueck[]): ZaehlZiel[] => {
  const v = zieleVorschlagen(stuecke);
  return v.length ? v : [LEERE_ART];
};

/** Farbe je Art – kräftig genug für helle und dunkle Fotos, Punkte haben zusätzlich einen weißen Rand. */
const FARBEN = ["#4f46e5", "#db2777", "#0891b2", "#ea580c", "#65a30d", "#9333ea"];
const OHNE_ART = "#6b7280";

/** Zuletzt benutztes Zählmodell – damit man beim Vergleichen nicht jedes Mal neu wählen muss. */
const MODELL_MERKER = "zaehl-modell";
function gemerktesModell(): ZaehlModell | null {
  try {
    const m = localStorage.getItem(MODELL_MERKER);
    return m && (ZAEHL_MODELLE as readonly string[]).includes(m) ? (m as ZaehlModell) : null;
  } catch {
    return null;
  }
}

interface Foto {
  url: string;
  dataUrl: string;
  breite: number;
  hoehe: number;
  codes: CodeOrt[];
}

async function fotoVorbereiten(datei: File): Promise<Foto> {
  let bild: ImageBitmap;
  try {
    bild = await createImageBitmap(datei, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Dieses Bildformat wird nicht unterstützt");
  }
  try {
    // Strichcodes am Original lesen: kleine Etiketten gehen beim Verkleinern sonst verloren
    const funde = await erkennen(bild);
    const codes = funde.map((f) => ({
      code: f.code,
      x: f.ecken.reduce((s, p) => s + p.x, 0) / f.ecken.length / bild.width,
      y: f.ecken.reduce((s, p) => s + p.y, 0) / f.ecken.length / bild.height,
    }));
    const faktor = Math.min(1, MAX_SEITE / Math.max(bild.width, bild.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bild.width * faktor);
    canvas.height = Math.round(bild.height * faktor);
    const ctx = canvas.getContext("2d")!;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(bild, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.82);
    const blob = await (await fetch(dataUrl)).blob();
    return { url: URL.createObjectURL(blob), dataUrl, breite: canvas.width, hoehe: canvas.height, codes };
  } finally {
    bild.close();
  }
}

/**
 * Zählhilfe für die Inventur: Foto vom Regal → ein Punkt je Teil (Bildmodell bei Cloudflare oder Gemini).
 * Punkte lassen sich per Tippen setzen und entfernen. Bucht nichts.
 */
export function RegalZaehlen({
  offen,
  schliessen,
  stuecke,
  beiCodes,
}: {
  offen: boolean;
  schliessen: () => void;
  /** Stücke, die laut System hier liegen (inventurpflichtig) – daraus werden die Arten vorgeschlagen */
  stuecke: Stueck[];
  beiCodes: (codes: string[]) => void;
}) {
  const { daten: verfuegbar } = useLaden<Record<ZaehlModell, boolean>>(offen ? "/zaehlen/modelle" : null);
  const [ziele, setZiele] = useState<ZaehlZiel[]>(() => vorschlagFuer(stuecke));
  const [modell, setModellRoh] = useState<ZaehlModell>(() => gemerktesModell() ?? ZAEHL_MODELLE[0]);
  const setModell = (m: ZaehlModell) => {
    setModellRoh(m);
    try {
      localStorage.setItem(MODELL_MERKER, m);
    } catch {
      /* privater Modus */
    }
  };
  const [foto, setFoto] = useState<Foto | null>(null);
  const [ergebnis, setErgebnis] = useState<{ ziele: ZaehlZiel[]; punkte: ZaehlPunkt[]; modell: ZaehlModell; diagnose: ZaehlDiagnose | null } | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktivesZiel, setAktivesZiel] = useState(0);
  const [uebernommen, setUebernommen] = useState(false);
  const [kameraOffen, setKameraOffen] = useState(false);
  const bildRef = useRef<HTMLDivElement>(null);

  // Vorschlag neu bilden, wenn das Regal neu geladen wurde und noch nichts gezählt ist
  const vorschlag = useMemo(() => vorschlagFuer(stuecke), [stuecke]);
  useEffect(() => {
    if (!ergebnis) setZiele(vorschlag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorschlag]);

  // Ohne mindestens eine eingetragene Art ist ein Foto sinnlos – die Fotoknöpfe bleiben dann gesperrt,
  // statt erst nach der Aufnahme einen Fehler zu zeigen.
  const aktive = aktiveZiele(ziele);
  const bereit = aktive.length > 0;

  // Nicht eingerichtetes Modell nicht vorwählen: dann das erste eingerichtete in der Reihenfolge der Liste
  useEffect(() => {
    if (verfuegbar && !verfuegbar[modell]) {
      const erstes = ZAEHL_MODELLE.find((m) => verfuegbar[m]);
      if (erstes) setModellRoh(erstes);
    }
  }, [verfuegbar, modell]);

  const fotoUrl = foto?.url;
  useEffect(() => () => void (fotoUrl && URL.revokeObjectURL(fotoUrl)), [fotoUrl]);

  const zuordnung = useMemo(
    () => (foto && ergebnis ? codesZuPunkten(ergebnis.punkte, foto.codes, foto.breite, foto.hoehe) : new Map<number, string>()),
    [foto, ergebnis],
  );

  async function zaehlen(f: Foto, mit: ZaehlModell) {
    // Die Knöpfe sind ohne Art gesperrt; das hier fängt nur Sonderfälle ab
    if (!bereit) {
      setFehler("Mindestens eine Art angeben, die gezählt werden soll");
      return;
    }
    setFehler(null);
    setUebernommen(false);
    setLaeuft(`${ZAEHL_MODELL_NAME[mit]} zählt …`);
    try {
      const r = await senden<ZaehlAntwort>("/zaehlen", {
        modell: mit,
        bild: f.dataUrl,
        breite: f.breite,
        hoehe: f.hoehe,
        ziele: aktive.map((z) => z.text),
      });
      setErgebnis({ ziele: aktive, punkte: r.punkte, modell: r.modell, diagnose: r.diagnose ?? null });
      setAktivesZiel(0);
      signalFertig();
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaeuft(null);
    }
  }

  async function fotoGewaehlt(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setLaeuft("Foto wird vorbereitet …");
    try {
      const f = await fotoVorbereiten(datei);
      setFoto(f);
      setErgebnis(null);
      await zaehlen(f, modell);
    } catch (e) {
      setLaeuft(null);
      setFehler(fehlerText(e));
    }
  }

  function punktSetzen(ev: MouseEvent<HTMLDivElement>) {
    if (!ergebnis || !bildRef.current) return;
    const r = bildRef.current.getBoundingClientRect();
    const x = (ev.clientX - r.left) / r.width;
    const y = (ev.clientY - r.top) / r.height;
    if (x < 0 || x > 1 || y < 0 || y > 1) return;
    setErgebnis({ ...ergebnis, punkte: [...ergebnis.punkte, { x, y, ziel: ergebnis.ziele.length ? aktivesZiel : null }] });
  }

  function punktEntfernen(i: number) {
    if (!ergebnis) return;
    setErgebnis({ ...ergebnis, punkte: ergebnis.punkte.filter((_, j) => j !== i) });
  }

  const gesperrt = !!laeuft || !bereit;
  const knopfKlassen = (art: "primaer" | "zweit") =>
    kl(
      "flex h-14 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-3 text-base font-semibold transition active:scale-[0.97]",
      art === "primaer" ? "bg-primaer text-auf-primaer hover:bg-primaer-hover" : "border border-rand bg-flaeche shadow-karte hover:bg-flaeche-2",
      gesperrt && "pointer-events-none cursor-not-allowed opacity-50",
    );

  /**
   * Zwei Wege zum Bild: „aufnehmen“ öffnet am Handy direkt die Kamera, „hochladen“ die Fotos bzw. den Dateidialog.
   * Am Rechner öffnet ein Datei-Feld keine Kamera; dort zeigt „aufnehmen“ eine eigene Kamera-Ansicht,
   * in der ein iPhone in der Nähe als Kamera wählbar ist (Kamera-Übergabe von Apple).
   */
  const fotoKnopf = (text: string, quelle: "kamera" | "datei", art: "primaer" | "zweit") =>
    quelle === "kamera" && amRechner ? (
      <button type="button" className={knopfKlassen(art)} disabled={gesperrt} aria-describedby="foto-hinweis" onClick={() => setKameraOffen(true)}>
        <Camera className="size-5 shrink-0" />
        <span className="truncate">{text}</span>
      </button>
    ) : (
      <label className={knopfKlassen(art)} aria-disabled={gesperrt || undefined}>
        {quelle === "kamera" ? <Camera className="size-5 shrink-0" /> : <ImageUp className="size-5 shrink-0" />}
        <span className="truncate">{text}</span>
        <input
          type="file"
          accept="image/*"
          capture={quelle === "kamera" ? "environment" : undefined}
          className="sr-only"
          disabled={gesperrt}
          aria-describedby="foto-hinweis"
          onChange={(ev) => {
            void fotoGewaehlt(ev.target.files?.[0]);
            ev.target.value = "";
          }}
        />
      </label>
    );

  const fotoKnoepfe = (neu: boolean) => (
    <div className="space-y-2">
      {!bereit && (
        <p id="foto-hinweis" className="rounded-2xl bg-warnung-weich px-4 py-3 text-[15px] text-warnung-text">
          Erst oben eintragen, was gezählt werden soll – dann lässt sich ein Foto aufnehmen.
        </p>
      )}
      <div className="flex gap-2">
        {fotoKnopf(neu ? "Neues Foto" : "Foto aufnehmen", "kamera", neu ? "zweit" : "primaer")}
        {fotoKnopf("Bild hochladen", "datei", "zweit")}
      </div>
      {bereit && (
        <p id="foto-hinweis" className="text-[12px] text-gedaempft">
          Am besten eine Ablage pro Foto, möglichst gerade von vorn oder schräg von oben, mit gutem Licht. Angeschnittene Böden am Bildrand
          werden nicht gezählt.
          {amRechner &&
            " „Foto aufnehmen“ öffnet die Kamera des Rechners; am Mac lässt sich dort ein iPhone in der Nähe wählen. „Bild hochladen“ nimmt eine Datei, z. B. per AirDrop."}
        </p>
      )}
    </div>
  );

  const kamera = (
    <KameraAufnahme
      offen={kameraOffen}
      schliessen={() => setKameraOffen(false)}
      beiFoto={(f) => {
        setKameraOffen(false);
        void fotoGewaehlt(f);
      }}
    />
  );

  const modellOptionen = ZAEHL_MODELLE.filter((m) => !verfuegbar || verfuegbar[m]);
  const modellWahl = modellOptionen.length > 1 && (
    <Feld beschriftung="Zählmodell" hinweis="Bei Cloudflare ohne eigenen Schlüssel. Ruhig mehrere mit demselben Foto vergleichen.">
      {(p) => (
        <Auswahl {...p} value={modell} onChange={(ev) => setModell(ev.target.value as ZaehlModell)}>
          {modellOptionen.map((m) => (
            <option key={m} value={m}>
              {ZAEHL_MODELL_NAME[m]}
            </option>
          ))}
        </Auswahl>
      )}
    </Feld>
  );

  const zieleBearbeiten = (
    <div className="space-y-2.5">
      <h3 className="text-[13px] font-semibold uppercase tracking-wider text-gedaempft">Was gezählt wird</h3>
      {ziele.map((z, i) => (
        <div key={i} className="flex items-center gap-2">
          <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ background: FARBEN[i % FARBEN.length] }} />
          <Eingabe
            value={z.text}
            maxLength={MAX_ZIEL_TEXT}
            aria-label={`Art ${i + 1}`}
            aria-invalid={!bereit || undefined}
            placeholder="z. B. Akkuschrauber im blauen Koffer"
            onChange={(ev) => setZiele(ziele.map((y, j) => (j === i ? { ...y, text: ev.target.value } : y)))}
          />
          {z.soll > 0 && <span className="shrink-0 text-[13px] text-gedaempft">{z.soll}×</span>}
          <button
            type="button"
            aria-label={`Art ${i + 1} entfernen`}
            onClick={() => setZiele(ziele.filter((_, j) => j !== i))}
            className="flex size-11 shrink-0 items-center justify-center rounded-full text-gedaempft hover:bg-flaeche-2"
          >
            <X className="size-5" />
          </button>
        </div>
      ))}
      {ziele.length < MAX_ZIELE && (
        <Knopf art="leise" symbol={<Plus className="size-5" />} onClick={() => setZiele([...ziele, { text: "", soll: 0 }])}>
          Art hinzufügen
        </Knopf>
      )}
      <p className="text-[12px] text-gedaempft">
        {stuecke.length
          ? "Vorschlag aus Kategorie, Name und Beschreibung der Stücke in diesem Regal. Beschreiben, woran man ein Teil erkennt (Form, Farbe, Größe), hilft mehr als Typnummern."
          : "Laut System liegt hier nichts. Bitte eintragen, was gezählt werden soll, z. B. „Werkzeugaufnahme mit Kegelschaft in blauem Halteplatz“."}
      </p>
    </div>
  );

  return (
    <Blatt offen={offen} schliessen={schliessen} titel="Regal zählen">
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}

        {laeuft && (
          <div className="flex flex-col items-center gap-4 py-8 text-center" aria-live="polite">
            <Kreisel />
            <p className="text-[15px]">{laeuft}</p>
          </div>
        )}

        {kameraOffen && !laeuft && kamera}

        {!laeuft && !kameraOffen && !ergebnis && (
          <>
            <p className="text-[15px]">
              Foto vom Regal oder Fach aufnehmen. Jedes gefundene Teil bekommt einen <b>Punkt</b>. Fehlende Punkte setzt man durch Tippen, falsche
              entfernt man durch Tippen.
            </p>
            {zieleBearbeiten}
            {modellWahl}
            {verfuegbar && modellOptionen.length === 0 && <FehlerHinweis text="Kein Zählmodell eingerichtet" />}
            <p className="text-[12px] text-gedaempft">
              Das Foto wird zum Zählen an {modell === "gemini" ? "Google" : "Cloudflare Workers AI"} geschickt und nicht gespeichert.
            </p>
            {foto && (
              <Knopf art="primaer" groesse="l" breit disabled={!bereit} symbol={<RefreshCw className="size-5" />} onClick={() => void zaehlen(foto, modell)}>
                Mit demselben Foto zählen
              </Knopf>
            )}
            {fotoKnoepfe(!!foto)}
          </>
        )}

        {!laeuft && !kameraOffen && ergebnis && foto && (
          <>
            <div
              ref={bildRef}
              role="group"
              aria-label="Foto mit Punkten. Tippen setzt einen Punkt, Tippen auf einen Punkt entfernt ihn."
              onClick={punktSetzen}
              className="relative cursor-crosshair touch-manipulation select-none overflow-hidden rounded-2xl bg-flaeche-2"
            >
              <img src={foto.url} alt="" draggable={false} className="block w-full" />
              {ergebnis.punkte.map((p, i) => {
                const farbe = p.ziel === null ? OHNE_ART : FARBEN[p.ziel % FARBEN.length];
                const code = zuordnung.get(i);
                return (
                  <button
                    key={i}
                    type="button"
                    aria-label={`Punkt ${i + 1}${p.text ? ` („${p.text}“)` : ""}${code ? ` (Code ${code})` : ""} entfernen`}
                    onClick={(ev) => {
                      ev.stopPropagation();
                      punktEntfernen(i);
                    }}
                    className="absolute flex size-7 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 border-white text-[11px] font-bold text-white shadow-[0_1px_4px_rgb(0_0_0/0.5)]"
                    style={{
                      left: `${p.x * 100}%`,
                      top: `${p.y * 100}%`,
                      background: farbe,
                      outline: code ? "3px solid var(--erfolg)" : undefined,
                      outlineOffset: 1,
                    }}
                  >
                    {i + 1}
                    {/* Vom Modell gelesene Beschriftung (z. B. „T808“) unter dem Punkt */}
                    {p.text && (
                      <span className="pointer-events-none absolute left-1/2 top-full mt-0.5 max-w-24 -translate-x-1/2 truncate rounded bg-black/70 px-1 text-[10px] font-semibold leading-4 text-white">
                        {p.text}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <div className="flex items-end justify-between gap-3">
              <div>
                <div className="zahlen text-4xl font-bold">{ergebnis.punkte.length}</div>
                <div className="text-[13px] text-gedaempft">
                  gezählt · {ZAEHL_MODELL_NAME[ergebnis.modell]}
                  {zuordnung.size > 0 && ` · ${zuordnung.size} mit Code`}
                </div>
              </div>
            </div>

            <div className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand">
              {ergebnis.ziele.map((z, i) => {
                const ist = ergebnis.punkte.filter((p) => p.ziel === i).length;
                const aktiv = aktivesZiel === i;
                return (
                  <button
                    key={i}
                    type="button"
                    aria-pressed={aktiv}
                    onClick={() => setAktivesZiel(i)}
                    className={kl("flex min-h-14 w-full items-center gap-3 px-4 py-2 text-left", aktiv && "bg-primaer-weich")}
                  >
                    <span aria-hidden className="size-3.5 shrink-0 rounded-full" style={{ background: FARBEN[i % FARBEN.length] }} />
                    <span className="min-w-0 flex-1 truncate text-[15px]">{z.text}</span>
                    <span
                      className={kl(
                        "zahlen shrink-0 text-[15px] font-bold",
                        z.soll > 0 && (ist === z.soll ? "text-erfolg-text" : "text-warnung-text"),
                      )}
                    >
                      {ist}
                      {z.soll > 0 && <span className="font-normal text-gedaempft"> / {z.soll}</span>}
                    </span>
                  </button>
                );
              })}
            </div>
            <p className="text-[13px] text-gedaempft">
              Art antippen, dann ins Foto tippen, um einen fehlenden Punkt dieser Art zu setzen. Zahl hinter dem Schrägstrich = laut System hier.
            </p>
            <p className="flex items-start gap-2 text-[13px] text-gedaempft">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              Automatisch gezählt, bitte prüfen. Für die Inventur zählen nur gescannte Codes.
            </p>
            {ergebnis.punkte.length === 0 && (
              <p className="rounded-2xl bg-warnung-weich px-4 py-3 text-[15px] text-warnung-text">
                Das Modell hat nichts gefunden. Eine Beschreibung, woran man das Teil erkennt, oder ein anderes Zählmodell hilft oft. Unten stehen
                die Details.
              </p>
            )}
            {(() => {
              // Nennt das Modell selbst eine andere Zahl als es Punkte gesetzt hat, hat es sich verzählt – Hinweis zum Nachprüfen
              const genannt = ergebnis.diagnose?.versuche[0]?.anzahl;
              const gesetzt = ergebnis.diagnose?.versuche[0]?.punkte;
              return genannt !== undefined && gesetzt !== undefined && genannt !== gesetzt ? (
                <p className="rounded-2xl bg-warnung-weich px-4 py-3 text-[15px] text-warnung-text">
                  Das Modell nennt {genannt} Teile, hat aber {gesetzt} Punkte gesetzt. Bitte besonders genau prüfen.
                </p>
              ) : null;
            })()}
            {ergebnis.diagnose && <Diagnose d={ergebnis.diagnose} modell={ergebnis.modell} offen={ergebnis.punkte.length === 0} />}

            <div className="space-y-2.5">
              {foto.codes.length > 0 && (
                <Knopf
                  art="primaer"
                  groesse="l"
                  breit
                  disabled={uebernommen}
                  symbol={<ScanLine className="size-5" />}
                  onClick={() => {
                    beiCodes([...new Set(foto.codes.map((c) => c.code))]);
                    setUebernommen(true);
                  }}
                >
                  {uebernommen ? "Übernommen" : `${anzahl(new Set(foto.codes.map((c) => c.code)).size, "gelesenen Code", "gelesene Codes")} übernehmen`}
                </Knopf>
              )}
              {/* Zurück zur Auswahl – Foto bleibt, dort „Mit demselben Foto zählen“ */}
              <Knopf breit symbol={<RefreshCw className="size-5" />} onClick={() => setErgebnis(null)}>
                {modellOptionen.length > 1 ? "Anderes Modell oder Arten ändern" : "Arten ändern"}
              </Knopf>
              {fotoKnoepfe(true)}
            </div>
          </>
        )}
      </div>
    </Blatt>
  );
}

/** Was ans Modell ging und was zurückkam – zum Prüfen und zum Weitergeben bei Problemen. */
function Diagnose({ d, modell, offen }: { d: ZaehlDiagnose; modell: ZaehlModell; offen: boolean }) {
  const [kopiert, setKopiert] = useState(false);
  const text = JSON.stringify({ modell, ...d }, null, 2);
  return (
    <details open={offen} className="rounded-2xl border border-rand">
      <summary className="flex min-h-12 cursor-pointer items-center px-4 text-[13px] font-semibold text-gedaempft">Technische Details</summary>
      <div className="space-y-3 border-t border-rand px-4 py-3 text-[13px]">
        <p className="text-gedaempft">
          Foto {d.breite} × {d.hoehe} px, {d.bildKb} KB · {d.versuche.length} {d.versuche.length === 1 ? "Aufruf" : "Aufrufe"}
        </p>
        <ul className="space-y-2">
          {d.versuche.map((v, i) => (
            <li key={i} className="rounded-xl bg-flaeche-2 px-3 py-2">
              <div className="flex justify-between gap-2">
                <span className="min-w-0 font-semibold break-words">{v.gesendet}</span>
                <span className="shrink-0">
                  {v.punkte} Punkte{v.anzahl !== undefined && v.anzahl !== v.punkte && ` (genannt: ${v.anzahl})`} · {v.dauerMs} ms
                </span>
              </div>
              {v.fehler && <div className="mt-1 text-gefahr-text break-words">Fehler: {v.fehler}</div>}
              {v.antwort && <pre className="mt-1 max-h-32 overflow-auto whitespace-pre-wrap break-all font-mono text-[11px] text-gedaempft">{v.antwort}</pre>}
            </li>
          ))}
        </ul>
        <Knopf
          breit
          symbol={<Copy className="size-5" />}
          onClick={() => {
            void navigator.clipboard?.writeText(text).then(() => setKopiert(true), () => setKopiert(false));
          }}
        >
          {kopiert ? "Kopiert" : "Details kopieren"}
        </Knopf>
      </div>
    </details>
  );
}
