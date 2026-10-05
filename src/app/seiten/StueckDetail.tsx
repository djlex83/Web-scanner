import { ArrowRightLeft, Box, Copy, History, MapPin, Pencil } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { STATUS_NAME, type Buchung, type Platz, type Stueck, type StueckStatus } from "../../gemeinsam/typen";
import { BewegungsZeile } from "../komponenten/BewegungsZeile";
import { FotoBereich } from "../komponenten/FotoBereich";
import { KategorieSymbol, kategorienAktualisieren, stilFuer, useKategorien } from "../komponenten/kategorie";
import { PlatzWahl } from "../komponenten/PlatzWahl";
import { aendern, fehlerText, senden } from "../lib/api";
import { tagesUeberschrift, vorWann, zeitpunkt } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Abzeichen, StatusAbzeichen } from "../ui/abzeichen";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Segmente, Textfeld } from "../ui/formular";
import { Abschnitt, Karte, Liste } from "../ui/karte";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Laden, Leer } from "../ui/zustand";

export default function StueckDetail() {
  const { id } = useParams();
  const { darf } = useSitzung();
  const melden = useMeldung();
  const { daten, setDaten, fehler, neuLaden } = useLaden<{ stueck: Stueck; verlauf: Buchung[] }>(`/stuecke/${id}`);
  const kategorien = useKategorien();
  const [wahl, setWahl] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);

  if (fehler) return <FehlerHinweis text={fehler} nochmal={neuLaden} />;
  if (!daten) return <Laden />;
  const { stueck: s, verlauf } = daten;

  async function umbuchen(p: Platz) {
    try {
      const r = await senden<{ gebucht: number; ziel: string }>("/buchungen", { nach_platz_id: p.id, stueck_ids: [s.id] });
      melden(r.gebucht ? `Nach ${r.ziel} gebucht` : "Liegt schon dort", r.gebucht ? "erfolg" : "info");
      await neuLaden();
    } catch (e) {
      melden(fehlerText(e), "fehler");
    }
  }

  // Verlauf nach Tagen gruppieren
  const gruppen: [string, Buchung[]][] = [];
  for (const b of verlauf) {
    const tag = tagesUeberschrift(b.zeitpunkt);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte[0] === tag) letzte[1].push(b);
    else gruppen.push([tag, [b]]);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SeitenKopf
        zurueck
        titel={s.name}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <StatusAbzeichen status={s.status} />
            {s.kategorie && (
              <Abzeichen className="pl-1">
                <KategorieSymbol stil={stilFuer(s.kategorie, kategorien)} className="size-5 rounded-full" />
                {s.kategorie}
              </Abzeichen>
            )}
          </span>
        }
      />

      <FotoBereich stueck={s} geaendert={(v) => setDaten({ stueck: { ...s, foto_version: v }, verlauf })} />

      <Karte className="overflow-hidden">
        <div className="flex items-start gap-4 bg-gradient-to-br from-primaer-weich to-transparent p-5">
          <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primaer text-auf-primaer">
            <MapPin className="size-6" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] font-semibold uppercase tracking-wider text-gedaempft">Liegt in</div>
            {s.platz ? (
              <Link to={`/plaetze/${s.platz.id}`} className="mt-0.5 block text-xl font-bold leading-snug hover:underline">
                {s.platz.pfad}
              </Link>
            ) : (
              <div className="mt-0.5 text-xl font-bold text-warnung-text">Kein Platz zugeordnet</div>
            )}
            {s.bewegt_am && (
              <div className="mt-1 text-[13px] text-gedaempft" title={zeitpunkt(s.bewegt_am)}>
                {vorWann(s.bewegt_am)}
                {s.bewegt_von && ` von ${s.bewegt_von}`}
              </div>
            )}
          </div>
        </div>
        <dl className="grid grid-cols-1 gap-4 border-t border-rand p-5 sm:grid-cols-2">
          <div>
            <dt className="text-[13px] text-gedaempft">Code</dt>
            <dd className="mt-0.5 flex items-center gap-2 font-mono text-[15px] font-semibold">
              <span className="truncate">{s.code}</span>
              <button
                onClick={() => void navigator.clipboard?.writeText(s.code).then(() => melden("Code kopiert", "info"))}
                aria-label="Code kopieren"
                className="flex size-9 items-center justify-center rounded-lg text-gedaempft hover:bg-flaeche-2"
              >
                <Copy className="size-4" />
              </button>
            </dd>
          </div>
          <div>
            <dt className="text-[13px] text-gedaempft">Erfasst</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">{zeitpunkt(s.erstellt_am)}</dd>
          </div>
          {s.beschreibung && (
            <div className="sm:col-span-2">
              <dt className="text-[13px] text-gedaempft">Beschreibung</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[15px]">{s.beschreibung}</dd>
            </div>
          )}
        </dl>
      </Karte>

      <div className="grid grid-cols-2 gap-3">
        {darf("buchen") && s.status !== "ausgemustert" && (
          <Knopf art="primaer" groesse="l" symbol={<ArrowRightLeft className="size-5" />} onClick={() => setWahl(true)}>
            Umbuchen
          </Knopf>
        )}
        {darf("stuecke_verwalten") && (
          <Knopf groesse="l" symbol={<Pencil className="size-5" />} onClick={() => setBearbeiten(true)}>
            Bearbeiten
          </Knopf>
        )}
      </div>

      <Abschnitt titel="Verlauf">
        {verlauf.length === 0 ? (
          <Leer symbol={<History />} titel="Noch keine Bewegungen" />
        ) : (
          <div className="space-y-4">
            {gruppen.map(([tag, liste]) => (
              <div key={tag} className="space-y-2">
                <h3 className="px-1 text-sm font-semibold">{tag}</h3>
                <Liste>
                  {liste.map((b) => (
                    <BewegungsZeile key={b.id} b={b} ohneStueck exakt />
                  ))}
                </Liste>
              </div>
            ))}
          </div>
        )}
      </Abschnitt>

      <PlatzWahl offen={wahl} schliessen={() => setWahl(false)} waehlen={(p) => void umbuchen(p)} aktuell={s.platz?.id} titel="Wohin umbuchen?" />
      {bearbeiten && (
        <BearbeitenBlatt
          stueck={s}
          schliessen={() => setBearbeiten(false)}
          gespeichert={() => {
            setBearbeiten(false);
            melden("Gespeichert");
            void neuLaden();
            void kategorienAktualisieren();
          }}
        />
      )}
    </div>
  );
}

function BearbeitenBlatt({ stueck, schliessen, gespeichert }: { stueck: Stueck; schliessen: () => void; gespeichert: () => void }) {
  const [name, setName] = useState(stueck.name);
  const [kategorie, setKategorie] = useState(stueck.kategorie ?? "");
  const [beschreibung, setBeschreibung] = useState(stueck.beschreibung ?? "");
  const [status, setStatus] = useState<StueckStatus>(stueck.status);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      await aendern(`/stuecke/${stueck.id}`, { name, kategorie: kategorie || null, beschreibung: beschreibung || null, status });
      gespeichert();
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
      titel="Stück bearbeiten"
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Name">{(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />}</Feld>
        <Feld beschriftung="Kategorie">
          {(p) => <Eingabe {...p} value={kategorie} onChange={(e) => setKategorie(e.target.value)} maxLength={80} />}
        </Feld>
        <Feld beschriftung="Beschreibung">
          {(p) => <Textfeld {...p} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} maxLength={1000} />}
        </Feld>
        <div className="space-y-1.5">
          <div className="px-1 text-sm font-semibold">Status</div>
          <Segmente
            beschriftung="Status"
            wert={status}
            aendern={setStatus}
            optionen={(["vorhanden", "defekt", "ausgemustert"] as const).map((w) => ({ wert: w, text: STATUS_NAME[w] }))}
          />
          {status === "ausgemustert" && (
            <p className="px-1 text-[13px] text-gedaempft">
              <Box className="mr-1 inline size-3.5" />
              Ausgemusterte Stücke verschwinden aus Bestand und Regalen, bleiben aber im Protokoll.
            </p>
          )}
        </div>
      </div>
    </Blatt>
  );
}
