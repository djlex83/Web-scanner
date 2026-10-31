import { Camera, Copy, ImageUp, Plus, RefreshCw, ScanLine, Sparkles, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, type MouseEvent } from "react";
import type { Stueck } from "../../gemeinsam/typen";
import {
  codesZuPunkten,
  MAX_ZIEL_TEXT,
  MAX_ZIELE,
  ZAEHL_MODELL_NAME,
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
import { Eingabe, Segmente } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis, Kreisel } from "../ui/zustand";
import { KameraAufnahme } from "./KameraAufnahme";

/** Größer bringt den Modellen kaum etwas, kostet aber Upload und Tokens. */
const MAX_SEITE = 1280;

/** Farbe je Art – kräftig genug für helle und dunkle Fotos, Punkte haben zusätzlich einen weißen Rand. */
const FARBEN = ["#4f46e5", "#db2777", "#0891b2", "#ea580c", "#65a30d", "#9333ea"];
const OHNE_ART = "#6b7280";

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
 * Zählhilfe für die Inventur: Foto vom Regal → ein Punkt je Teil (Moondream oder Gemini).
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
  const [ziele, setZiele] = useState<ZaehlZiel[]>(() => zieleVorschlagen(stuecke));
  const [modell, setModell] = useState<ZaehlModell>("moondream");
  const [foto, setFoto] = useState<Foto | null>(null);
  const [ergebnis, setErgebnis] = useState<{ ziele: ZaehlZiel[]; punkte: ZaehlPunkt[]; modell: ZaehlModell; diagnose: ZaehlDiagnose | null } | null>(null);
  const [laeuft, setLaeuft] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [aktivesZiel, setAktivesZiel] = useState(0);
  const [uebernommen, setUebernommen] = useState(false);
  const [kameraOffen, setKameraOffen] = useState(false);
  const bildRef = useRef<HTMLDivElement>(null);

  // Vorschlag neu bilden, wenn das Regal neu geladen wurde und noch nichts gezählt ist
  const vorschlag = useMemo(() => zieleVorschlagen(stuecke), [stuecke]);
  useEffect(() => {
    if (!ergebnis) setZiele(vorschlag);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [vorschlag]);

  // Nicht eingerichtetes Modell nicht vorwählen
  useEffect(() => {
    if (verfuegbar && !verfuegbar[modell]) {
      const anderes: ZaehlModell = modell === "moondream" ? "gemini" : "moondream";
      if (verfuegbar[anderes]) setModell(anderes);
    }
  }, [verfuegbar, modell]);

  const fotoUrl = foto?.url;
  useEffect(() => () => void (fotoUrl && URL.revokeObjectURL(fotoUrl)), [fotoUrl]);

  const zuordnung = useMemo(
    () => (foto && ergebnis ? codesZuPunkten(ergebnis.punkte, foto.codes, foto.breite, foto.hoehe) : new Map<number, string>()),
    [foto, ergebnis],
  );

  async function zaehlen(f: Foto, mit: ZaehlModell) {
    const aktive = ziele.map((z) => ({ ...z, text: z.text.trim() })).filter((z) => z.text);
    if (!aktive.length) {
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

  const knopfKlassen = (art: "primaer" | "zweit") =>
    kl(
      "flex h-14 min-w-0 flex-1 cursor-pointer items-center justify-center gap-2.5 rounded-2xl px-3 text-base font-semibold transition active:scale-[0.97]",
      art === "primaer" ? "bg-primaer text-auf-primaer hover:bg-primaer-hover" : "border border-rand bg-flaeche shadow-karte hover:bg-flaeche-2",
      laeuft && "pointer-events-none opacity-50",
    );

  /**
   * Zwei Wege zum Bild: „aufnehmen“ öffnet am Handy direkt die Kamera, „hochladen“ die Fotos bzw. den Dateidialog.
   * Am Rechner öffnet ein Datei-Feld keine Kamera; dort zeigt „aufnehmen“ eine eigene Kamera-Ansicht,
   * in der ein iPhone in der Nähe als Kamera wählbar ist (Kamera-Übergabe von Apple).
   */
  const fotoKnopf = (text: string, quelle: "kamera" | "datei", art: "primaer" | "zweit") =>
    quelle === "kamera" && amRechner ? (
      <button type="button" className={knopfKlassen(art)} disabled={!!laeuft} onClick={() => setKameraOffen(true)}>
        <Camera className="size-5 shrink-0" />
        <span className="truncate">{text}</span>
      </button>
    ) : (
    <label className={knopfKlassen(art)}>
      {quelle === "kamera" ? <Camera className="size-5 shrink-0" /> : <ImageUp className="size-5 shrink-0" />}
      <span className="truncate">{text}</span>
      <input
        type="file"
        accept="image/*"
        capture={quelle === "kamera" ? "environment" : undefined}
        className="sr-only"
        disabled={!!laeuft}
        onChange={(ev) => {
          void fotoGewaehlt(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />
    </label>
    );

  const fotoKnoepfe = (neu: boolean) => (
    <div className="space-y-2">
      <div className="flex gap-2">
        {fotoKnopf(neu ? "Neues Foto" : "Foto aufnehmen", "kamera", neu ? "zweit" : "primaer")}
        {fotoKnopf("Bild hochladen", "datei", "zweit")}
      </div>
      {amRechner && (
        <p className="text-[12px] text-gedaempft">
          „Foto aufnehmen“ öffnet die Kamera des Rechners; am Mac lässt sich dort ein iPhone in der Nähe als Kamera wählen. „Bild hochladen“
          nimmt eine Datei, z. B. per AirDrop vom iPhone.
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

  const modellOptionen = (["moondream", "gemini"] as const)
    .filter((m) => !verfuegbar || verfuegbar[m])
    .map((m) => ({ wert: m, text: m === "moondream" ? "Moondream" : "Gemini" }));

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
      <p className="text-[12px] text-gedaempft">Vorschlag aus Kategorie, Name und Beschreibung der Stücke in diesem Regal. Genauer beschreiben hilft.</p>
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
            {modellOptionen.length > 1 && <Segmente beschriftung="Modell" wert={modell} aendern={setModell} optionen={modellOptionen} />}
            {verfuegbar && !verfuegbar.moondream && !verfuegbar.gemini && <FehlerHinweis text="Kein Zählmodell eingerichtet" />}
            <p className="text-[12px] text-gedaempft">
              Das Foto wird zum Zählen an {modell === "gemini" ? "Google (über OpenRouter)" : "Cloudflare Workers AI"} geschickt und nicht gespeichert.
            </p>
            {foto && (
              <Knopf art="primaer" groesse="l" breit symbol={<RefreshCw className="size-5" />} onClick={() => void zaehlen(foto, modell)}>
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
                    aria-label={`Punkt ${i + 1}${code ? ` (Code ${code})` : ""} entfernen`}
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
                Das Modell hat nichts gefunden. Kürzere, sichtbare Begriffe helfen oft (z. B. „Koffer“, „Karton“). Unten stehen die Details.
              </p>
            )}
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
              {modellOptionen.length > 1 && (
                <Knopf
                  breit
                  symbol={<RefreshCw className="size-5" />}
                  onClick={() => {
                    const anderes: ZaehlModell = ergebnis.modell === "moondream" ? "gemini" : "moondream";
                    setModell(anderes);
                    void zaehlen(foto, anderes);
                  }}
                >
                  Mit {ergebnis.modell === "moondream" ? "Gemini" : "Moondream"} nochmal zählen
                </Knopf>
              )}
              <Knopf breit art="leise" onClick={() => setErgebnis(null)}>
                Arten ändern
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
                <span className="min-w-0 font-semibold break-words">
                  {v.ziel === null ? "Allgemein" : `Art ${v.ziel + 1}`}: „{v.gesendet}“
                </span>
                <span className="shrink-0">
                  {v.punkte} Punkte · {v.dauerMs} ms
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
