import { CheckCircle2, ChevronDown, ClipboardCheck, PackagePlus, SearchX, X } from "lucide-react";
import { ErfolgsHaken } from "../ui/bewegung";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate, useParams } from "react-router";
import type { InventurEintrag, InventurErgebnis, Platz, ScanTreffer, Stueck } from "../../gemeinsam/typen";
import { ErfassenBlatt } from "../komponenten/ErfassenBlatt";
import { StueckBild } from "../komponenten/kategorie";
import { fehlerText, senden } from "../lib/api";
import { anzahl, vorWann } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { signalFertig } from "../lib/rueckmeldung";
import { useBuchungMelden } from "../lib/rueckgaengig";
import { ManuelleEingabe, useHandscanner } from "../scanner/eingabe";
import { Kamera } from "../scanner/Kamera";
import { TrefferKarte } from "../scanner/TrefferKarte";
import { useScanListe } from "../scanner/useScanListe";
import { Blatt } from "../ui/blatt";
import { Schalter } from "../ui/formular";
import { Karte, Liste, Zeile } from "../ui/karte";
import { kl } from "../ui/kl";
import { Knopf, KnopfLink } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Laden } from "../ui/zustand";

interface Soll {
  platz: Platz;
  platz_ids: number[];
  stuecke: Stueck[];
  letzte: InventurEintrag[];
}

const speicherSchluessel = (id: string) => `ws-inventur-${id}`;

function gemerkt(id: string): string[] {
  try {
    return JSON.parse(localStorage.getItem(speicherSchluessel(id)) ?? "[]") as string[];
  } catch {
    return [];
  }
}

/** Inventur eines Regals: alles scannen, was da ist, und mit dem Soll vergleichen. */
export default function InventurPlatz() {
  const { id = "" } = useParams();
  const melden = useMeldung();
  const buchungMelden = useBuchungMelden();
  const { daten, fehler, neuLaden } = useLaden<Soll>(`/inventur/${id}`);
  const [abschliessen, setAbschliessen] = useState(false);
  const [ergebnis, setErgebnis] = useState<InventurErgebnis | null>(null);
  const [erfassenCode, setErfassenCode] = useState<string | null>(null);

  const beiTreffer = useCallback(
    (t: ScanTreffer) => {
      if (t.art !== "platz") return;
      // Platz-Etiketten zählen nicht; ein anderes Regal ist vermutlich ein Versehen
      liste.entfernen(t.code);
      if (String(t.platz.id) !== id) melden(`Das ist ${t.platz.pfad} – hier wird ${daten?.platz.pfad ?? "ein anderes Regal"} gezählt`, "info");
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [id, daten],
  );
  const liste = useScanListe(beiTreffer);
  const { hinzufuegen } = liste;
  useHandscanner((code) => liste.hinzufuegen([code]));

  // Gescannte Codes überstehen Neuladen und Seitenwechsel
  const wiederhergestellt = useRef(false);
  useEffect(() => {
    if (!daten || wiederhergestellt.current) return;
    wiederhergestellt.current = true;
    const codes = gemerkt(id);
    if (codes.length) hinzufuegen(codes);
  }, [daten, id, hinzufuegen]);
  useEffect(() => {
    if (!wiederhergestellt.current || ergebnis) return;
    try {
      localStorage.setItem(speicherSchluessel(id), JSON.stringify(liste.eintraege.map((e) => e.code)));
    } catch {
      /* privater Modus */
    }
  }, [liste.eintraege, id, ergebnis]);

  if (fehler) return <FehlerHinweis text={fehler} nochmal={neuLaden} />;
  if (!daten) return <Laden />;
  if (ergebnis) return <Ergebnis e={ergebnis} platzId={id} />;

  const imBaum = new Set(daten.platz_ids);
  const gescannt = liste.eintraege.flatMap((e) => (e.treffer?.art === "stueck" ? [e.treffer.stueck] : []));
  const gescanntIds = new Set(gescannt.map((s) => s.id));
  // Ein gescannter Behälter zählt mitsamt Inhalt
  const gefunden = (s: Stueck) => gescanntIds.has(s.id) || (!!s.in_behaelter && gescanntIds.has(s.in_behaelter.id));
  const erwartet = daten.stuecke.filter((s) => s.inventur);
  const okListe = erwartet.filter(gefunden);
  const verliehen = erwartet.filter((s) => !gefunden(s) && s.ausleihe);
  const fehlend = erwartet.filter((s) => !gefunden(s) && !s.ausleihe);
  const zusaetzlich = gescannt.filter(
    (s) => s.status !== "ausgemustert" && !(s.platz && imBaum.has(s.platz.id)) && !(s.in_behaelter && gescanntIds.has(s.in_behaelter.id)),
  );
  const unbekannt = liste.eintraege.filter((e) => e.treffer?.art === "unbekannt" || (!e.treffer && e.fehler));
  const ohneInventur = daten.stuecke.length - erwartet.length;
  const anteil = erwartet.length ? Math.round((okListe.length / erwartet.length) * 100) : 100;
  const zeile = (s: Stueck, unter: ReactNode, entfernen?: boolean) => (
    <div key={s.id} className="flex items-center pr-2">
      <Link to={`/stuecke/${s.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-flaeche-2">
        <StueckBild stueck={s} className="size-11 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{s.name}</span>
          <span className="mt-0.5 block truncate text-[13px] text-gedaempft">{unter}</span>
        </span>
      </Link>
      {entfernen && (
        <button
          type="button"
          aria-label={`${s.name} aus der Inventur entfernen`}
          onClick={() => liste.entfernen(s.code)}
          className="flex size-11 shrink-0 items-center justify-center rounded-full text-gedaempft hover:bg-flaeche-2"
        >
          <X className="size-5" />
        </button>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SeitenKopf zurueck titel="Inventur" unter={daten.platz.pfad} />

      <Karte className="space-y-3 p-5">
        <div className="flex items-end justify-between gap-3">
          <div>
            <div className="zahlen text-4xl font-bold">
              {okListe.length}
              <span className="text-2xl text-gedaempft"> / {erwartet.length}</span>
            </div>
            <div className="text-[13px] text-gedaempft">Stücke gefunden</div>
          </div>
          {daten.letzte[0] && (
            <div className="text-right text-[12px] text-gedaempft">
              Letzte Inventur
              <br />
              {vorWann(daten.letzte[0].zeitpunkt)} · {daten.letzte[0].benutzer}
            </div>
          )}
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-flaeche-2" role="progressbar" aria-label="Anteil gefundener Stücke" aria-valuenow={anteil} aria-valuemin={0} aria-valuemax={100}>
          <div className="relative h-full overflow-hidden rounded-full bg-erfolg transition-[width] duration-300" style={{ width: `${anteil}%` }}>
            {/* Glanz, sobald alles gefunden ist */}
            {anteil === 100 && erwartet.length > 0 && (
              <span aria-hidden className="anim-glanz absolute inset-y-0 left-0 w-1/3 bg-gradient-to-r from-transparent via-white/60 to-transparent" />
            )}
          </div>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[13px]">
          <span className={kl("font-semibold", fehlend.length ? "text-gefahr-text" : "text-erfolg-text")}>{fehlend.length} fehlen noch</span>
          {zusaetzlich.length > 0 && <span className="font-semibold text-warnung-text">{zusaetzlich.length} zusätzlich</span>}
          {verliehen.length > 0 && <span className="text-gedaempft">{verliehen.length} verliehen</span>}
          {ohneInventur > 0 && <span className="text-gedaempft">{ohneInventur} ohne Inventur</span>}
        </div>
      </Karte>

      <Kamera beiCodes={liste.hinzufuegen} hinweis="Alles scannen, was im Regal liegt" />
      <ManuelleEingabe beiCode={(c) => liste.hinzufuegen([c])} />

      {unbekannt.length > 0 && (
        <Bereich titel="Unbekannte Codes" anzahl={unbekannt.length} ton="warnung" offen>
          <div className="space-y-2.5">
            {unbekannt.map((e) => (
              <TrefferKarte key={e.code} eintrag={e} erfassen={setErfassenCode} entfernen={liste.entfernen} />
            ))}
          </div>
        </Bereich>
      )}
      {zusaetzlich.length > 0 && (
        <Bereich titel="Zusätzlich gefunden" anzahl={zusaetzlich.length} ton="warnung" offen>
          <Liste>
            {zusaetzlich.map((s) =>
              zeile(s, <>eingetragen: {s.platz?.pfad ?? "ohne Platz"}{s.in_behaelter && ` › ${s.in_behaelter.name}`}</>, true),
            )}
          </Liste>
        </Bereich>
      )}
      {fehlend.length > 0 && (
        <Bereich titel="Fehlen noch" anzahl={fehlend.length} ton="gefahr" offen={fehlend.length <= 30}>
          <Liste>
            {fehlend.map((s) =>
              zeile(
                s,
                <>
                  {s.platz && s.platz.id !== daten.platz.id && `${s.platz.name} · `}
                  {s.in_behaelter && `in ${s.in_behaelter.name} · `}
                  <span className="font-mono">{s.code}</span>
                  {s.vermisst_seit && " · schon vermisst"}
                </>,
              ),
            )}
          </Liste>
        </Bereich>
      )}
      {verliehen.length > 0 && (
        <Bereich titel="Verliehen" anzahl={verliehen.length}>
          <Liste>{verliehen.map((s) => zeile(s, <>bei {s.ausleihe!.an}</>))}</Liste>
        </Bereich>
      )}
      {okListe.length > 0 && (
        <Bereich titel="Gefunden" anzahl={okListe.length} ton="erfolg">
          <Liste>
            {okListe.map((s) =>
              zeile(s, <>{s.in_behaelter && gescanntIds.has(s.in_behaelter.id) ? `im Behälter ${s.in_behaelter.name}` : <span className="font-mono">{s.code}</span>}</>, gescanntIds.has(s.id)),
            )}
          </Liste>
        </Bereich>
      )}

      <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 -mx-4 bg-gradient-to-t from-hg from-60% to-transparent px-4 pb-3 pt-6 lg:bottom-0 lg:pb-6">
        <div>
          <Knopf art="primaer" groesse="xl" breit symbol={<ClipboardCheck className="size-6" />} className="shadow-hoch" onClick={() => setAbschliessen(true)}>
            Inventur abschließen
          </Knopf>
        </div>
      </div>

      {abschliessen && (
        <Abschluss
          platz={daten.platz}
          gefundenIds={[...gescanntIds]}
          zahlen={{ ok: okListe.length, erwartet: erwartet.length, fehlend: fehlend.length, zusaetzlich: zusaetzlich.length, verliehen: verliehen.length }}
          schliessen={() => setAbschliessen(false)}
          fertig={(e) => {
            try {
              localStorage.removeItem(speicherSchluessel(id));
            } catch {
              /* egal */
            }
            signalFertig();
            setAbschliessen(false);
            setErgebnis(e);
            if (e.vorgang_id) buchungMelden(`${anzahl(e.zusaetzlich, "Stück", "Stücke")} hierher gebucht`, e.vorgang_id);
          }}
        />
      )}
      <ErfassenBlatt
        code={erfassenCode}
        ziel={{ art: "platz", platz: daten.platz }}
        schliessen={() => setErfassenCode(null)}
        fertig={(s) => {
          const code = erfassenCode!;
          setErfassenCode(null);
          liste.ersetzen(code, { code, art: "stueck", stueck: s });
          melden(`„${s.name}“ erfasst`);
          // neues Stück gehört jetzt zum Soll
          void neuLaden();
        }}
      />
    </div>
  );

}

function Bereich({ titel, anzahl: n, ton, offen, children }: { titel: string; anzahl: number; ton?: "gefahr" | "warnung" | "erfolg"; offen?: boolean; children: ReactNode }) {
  return (
    <details open={offen} className="group space-y-3">
      <summary className="flex min-h-11 cursor-pointer list-none items-center gap-2 px-1 [&::-webkit-details-marker]:hidden">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gedaempft">{titel}</h2>
        <span
          className={kl(
            "rounded-full px-2 text-xs font-bold leading-5",
            ton === "gefahr" ? "bg-gefahr-weich text-gefahr-text" : ton === "warnung" ? "bg-warnung-weich text-warnung-text" : ton === "erfolg" ? "bg-erfolg-weich text-erfolg-text" : "bg-flaeche-2 text-gedaempft",
          )}
        >
          {n}
        </span>
        <ChevronDown className="ml-auto size-5 text-gedaempft transition group-open:rotate-180" />
      </summary>
      {children}
    </details>
  );
}

function Abschluss({
  platz,
  gefundenIds,
  zahlen,
  schliessen,
  fertig,
}: {
  platz: Platz;
  gefundenIds: number[];
  zahlen: { ok: number; erwartet: number; fehlend: number; zusaetzlich: number; verliehen: number };
  schliessen: () => void;
  fertig: (e: InventurErgebnis) => void;
}) {
  const [buchen, setBuchen] = useState(true);
  const [vermisst, setVermisst] = useState(true);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      fertig(
        await senden<InventurErgebnis>("/inventur", {
          platz_id: platz.id,
          gefunden_ids: gefundenIds,
          zusaetzliche_buchen: buchen,
          fehlende_vermisst: vermisst,
        }),
      );
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Blatt
      offen
      schliessen={schliessen}
      titel="Inventur abschließen"
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Abschließen und speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <p className="text-[15px]">
          <b>{zahlen.ok}</b> von <b>{zahlen.erwartet}</b> Stücken in {platz.pfad} gefunden
          {zahlen.verliehen > 0 && `, ${zahlen.verliehen} verliehen`}.
        </p>
        {(zahlen.zusaetzlich > 0 || zahlen.fehlend > 0) && (
          <div className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand">
            {zahlen.zusaetzlich > 0 && (
              <Schalter
                an={buchen}
                aendern={setBuchen}
                beschriftung={`${anzahl(zahlen.zusaetzlich, "zusätzliches Stück", "zusätzliche Stücke")} hierher buchen`}
                beschreibung={`Liegen hier, sind aber woanders eingetragen → nach ${platz.name}`}
              />
            )}
            {zahlen.fehlend > 0 && (
              <Schalter
                an={vermisst}
                aendern={setVermisst}
                beschriftung={`${anzahl(zahlen.fehlend, "fehlendes Stück", "fehlende Stücke")} als vermisst melden`}
                beschreibung="Wer sie später irgendwo scannt, bekommt einen Hinweis"
              />
            )}
          </div>
        )}
        <p className="text-[13px] text-gedaempft">Das Ergebnis wird im Protokoll gespeichert und kann nicht geändert werden.</p>
      </div>
    </Blatt>
  );
}

function Ergebnis({ e, platzId }: { e: InventurErgebnis; platzId: string }) {
  const navigate = useNavigate();
  const vollstaendig = e.fehlend === 0 && e.zusaetzlich === 0;
  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <SeitenKopf titel="Inventur gespeichert" unter={e.platz?.pfad} />
      <Karte className="flex items-center gap-4 p-5">
        {vollstaendig ? (
          <ErfolgsHaken className="size-14" />
        ) : (
          <span className="flex size-14 shrink-0 items-center justify-center rounded-2xl bg-warnung-weich text-warnung-text">
            <CheckCircle2 className="size-7" />
          </span>
        )}
        <div>
          <div className="text-xl font-bold">{vollstaendig ? "Alles da" : `${e.gefunden} von ${e.erwartet} gefunden`}</div>
          <div className="text-[13px] text-gedaempft">
            {[
              e.fehlend && `${e.fehlend} fehlen`,
              e.zusaetzlich && `${e.zusaetzlich} zusätzlich`,
              e.verliehen && `${e.verliehen} verliehen`,
            ]
              .filter(Boolean)
              .join(" · ") || "Soll und Ist stimmen überein"}
          </div>
        </div>
      </Karte>
      {e.fehlende.length > 0 && (
        <Liste>
          {e.fehlende.map((s) => (
            <Zeile key={s.id} zu={`/stuecke/${s.id}`} symbol={<SearchX />} titel={s.name} unter={<span className="font-mono">{s.code}</span>} />
          ))}
        </Liste>
      )}
      {e.zusaetzliche.length > 0 && (
        <Liste>
          {e.zusaetzliche.map((s) => (
            <Zeile key={s.id} zu={`/stuecke/${s.id}`} symbol={<PackagePlus />} titel={s.name} unter={e.vorgang_id ? "hierher gebucht" : "nicht umgebucht"} />
          ))}
        </Liste>
      )}
      <div className="grid grid-cols-2 gap-3">
        <KnopfLink to={`/plaetze/${platzId}`} groesse="l">
          Zum Regal
        </KnopfLink>
        <Knopf art="primaer" groesse="l" onClick={() => navigate("/inventur")}>
          Nächstes Regal
        </Knopf>
      </div>
    </div>
  );
}
