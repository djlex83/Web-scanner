import {
  ArrowRightLeft,
  Box,
  ClipboardCheck,
  Copy,
  Handshake,
  History,
  MapPin,
  PackagePlus,
  Pencil,
  Printer,
  SearchCheck,
  SearchX,
  Undo2,
  Wrench,
} from "lucide-react";
import { useState, type ReactNode } from "react";
import { Link, useParams } from "react-router";
import { PRUEF_ERGEBNIS_NAME, type Ausleihe, type Buchung, type Platz, type Pruefung, type Stueck } from "../../gemeinsam/typen";
import { AusleiheBlatt } from "../komponenten/AusleiheBlatt";
import { BewegungsZeile } from "../komponenten/BewegungsZeile";
import { FotoBereich } from "../komponenten/FotoBereich";
import { KategorieSymbol, kategorienAktualisieren, StueckBild, stilFuer, useKategorien } from "../komponenten/kategorie";
import { PlatzWahl } from "../komponenten/PlatzWahl";
import { PruefungBlatt } from "../komponenten/PruefungBlatt";
import { StueckBearbeiten } from "../komponenten/StueckBearbeiten";
import { datumText, istUeberfaellig, pruefStand, StueckMerkmale } from "../komponenten/StueckMerkmale";
import { fehlerText, senden } from "../lib/api";
import { tagesUeberschrift, vorWann, zeitpunkt } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useBuchungMelden } from "../lib/rueckgaengig";
import { useIch, useSitzung } from "../lib/sitzung";
import { Abzeichen, type Ton } from "../ui/abzeichen";
import { Abschnitt, Karte, Liste, Zeile } from "../ui/karte";
import { kl } from "../ui/kl";
import { Knopf, KnopfLink } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Laden, Leer } from "../ui/zustand";

interface Detail {
  stueck: Stueck;
  verlauf: Buchung[];
  pruefungen: Pruefung[];
  ausleihen: Ausleihe[];
  inhalt: Stueck[];
}

const RUECKGAENGIG_MINUTEN = 15;

export default function StueckDetail() {
  const { id } = useParams();
  const { darf } = useSitzung();
  const ich = useIch();
  const melden = useMeldung();
  const buchungMelden = useBuchungMelden();
  const { daten, setDaten, fehler, neuLaden } = useLaden<Detail>(`/stuecke/${id}`);
  const kategorien = useKategorien();
  const [wahl, setWahl] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);
  const [ausgeben, setAusgeben] = useState(false);
  const [pruefen, setPruefen] = useState(false);
  const [laedt, setLaedt] = useState<string | null>(null);

  if (fehler) return <FehlerHinweis text={fehler} nochmal={neuLaden} />;
  if (!daten) return <Laden />;
  const { stueck: s, verlauf, pruefungen, ausleihen, inhalt } = daten;
  const kannBuchen = darf("buchen") && s.status !== "ausgemustert";
  const hatPruefung = !!(s.pruefung.art || s.pruefung.intervall || s.pruefung.naechste);

  async function umbuchen(p: Platz) {
    try {
      const r = await senden<{ gebucht: number; ziel: string; vorgang_id: string | null }>("/buchungen", {
        nach_platz_id: p.id,
        stueck_ids: [s.id],
      });
      if (r.gebucht) buchungMelden(`Nach ${r.ziel} gebucht`, r.vorgang_id, () => void neuLaden());
      else melden("Liegt schon dort", "info");
      await neuLaden();
    } catch (e) {
      melden(fehlerText(e), "fehler");
    }
  }

  /** Kurze Aktion mit Rückmeldung und Neuladen */
  async function aktion(schluessel: string, pfad: string, text: string) {
    setLaedt(schluessel);
    try {
      await senden(pfad, { stueck_ids: [s.id] });
      melden(text);
      await neuLaden();
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setLaedt(null);
    }
  }

  // Letzte eigene Buchung kann rückgängig gemacht werden
  const letzte = verlauf[0];
  const rueckgaengigMoeglich =
    !!letzte &&
    !letzte.mitgefuehrt &&
    darf("buchen") &&
    (darf("stuecke_verwalten") ||
      (letzte.benutzer === ich.name && Date.now() - new Date(letzte.zeitpunkt).getTime() < RUECKGAENGIG_MINUTEN * 60_000));

  // Verlauf nach Tagen gruppieren
  const gruppen: [string, Buchung[]][] = [];
  for (const b of verlauf) {
    const tag = tagesUeberschrift(b.zeitpunkt);
    const zuletzt = gruppen[gruppen.length - 1];
    if (zuletzt && zuletzt[0] === tag) zuletzt[1].push(b);
    else gruppen.push([tag, [b]]);
  }
  const pStand = pruefStand(s.pruefung.naechste);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SeitenKopf
        zurueck
        titel={s.name}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            {s.status === "vorhanden" && !s.vermisst_seit && <Abzeichen ton="erfolg">Vorhanden</Abzeichen>}
            <StueckMerkmale stueck={s} mitBehaelter={false} />
            {s.behaelter && <Abzeichen ton="primaer">Behälter</Abzeichen>}
            {s.kategorie && (
              <Abzeichen className="pl-1">
                <KategorieSymbol stil={stilFuer(s.kategorie, kategorien)} className="size-5 rounded-full" />
                {s.kategorie}
              </Abzeichen>
            )}
          </span>
        }
      />

      {s.vermisst_seit && (
        <Hinweis ton="gefahr" symbol={<SearchX />} titel="Als vermisst gemeldet" text={`seit ${zeitpunkt(s.vermisst_seit)}`}>
          {kannBuchen && (
            <Knopf art="zweit" laedt={laedt === "gefunden"} symbol={<SearchCheck className="size-5" />} onClick={() => void aktion("gefunden", "/vermisst/gefunden", "Als gefunden markiert")}>
              Gefunden
            </Knopf>
          )}
        </Hinweis>
      )}
      {s.ausleihe && (
        <Hinweis
          ton={istUeberfaellig(s.ausleihe.bis) ? "gefahr" : "warnung"}
          symbol={<Handshake />}
          titel={`Verliehen an ${s.ausleihe.an}`}
          text={
            (s.ausleihe.bis ? `Rückgabe bis ${datumText(s.ausleihe.bis)}${istUeberfaellig(s.ausleihe.bis) ? " – überfällig" : ""}` : "ohne Rückgabedatum") +
            ` · seit ${vorWann(s.ausleihe.seit)}`
          }
        >
          {darf("buchen") && (
            <Knopf art="zweit" laedt={laedt === "zurueck"} onClick={() => void aktion("zurueck", "/ausleihen/zurueck", "Zurückgenommen")}>
              Zurücknehmen
            </Knopf>
          )}
        </Hinweis>
      )}
      {(pStand === "ueberfaellig" || pStand === "bald") && (
        <Hinweis
          ton={pStand === "ueberfaellig" ? "gefahr" : "warnung"}
          symbol={<Wrench />}
          titel={`${s.pruefung.art ?? "Prüfung"} ${pStand === "ueberfaellig" ? "überfällig" : "bald fällig"}`}
          text={`fällig am ${datumText(s.pruefung.naechste)}`}
        >
          {kannBuchen && (
            <Knopf art="zweit" onClick={() => setPruefen(true)}>
              Eintragen
            </Knopf>
          )}
        </Hinweis>
      )}

      <FotoBereich stueck={s} geaendert={(v) => setDaten({ ...daten, stueck: { ...s, foto_version: v } })} />

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
            {s.in_behaelter && (
              <Link to={`/stuecke/${s.in_behaelter.id}`} className="mt-1 inline-flex items-center gap-1.5 text-[15px] font-semibold text-primaer-text hover:underline">
                <Box className="size-4" /> im Behälter „{s.in_behaelter.name}“
              </Link>
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
          <div>
            <dt className="text-[13px] text-gedaempft">Inventur</dt>
            <dd className="mt-0.5 text-[15px] font-semibold">{s.inventur ? "wird gezählt" : "wird nicht gezählt"}</dd>
          </div>
          {hatPruefung && (
            <div>
              <dt className="text-[13px] text-gedaempft">{s.pruefung.art ?? "Prüfung"}</dt>
              <dd className="mt-0.5 text-[15px] font-semibold">
                {s.pruefung.naechste ? `nächste ${datumText(s.pruefung.naechste)}` : "kein Termin"}
                {s.pruefung.intervall && <span className="font-normal text-gedaempft"> · alle {s.pruefung.intervall} Monate</span>}
              </dd>
            </div>
          )}
          {s.beschreibung && (
            <div className="sm:col-span-2">
              <dt className="text-[13px] text-gedaempft">Beschreibung</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[15px]">{s.beschreibung}</dd>
            </div>
          )}
        </dl>
      </Karte>

      <div className="grid grid-cols-2 gap-3">
        {kannBuchen && (
          <Knopf art="primaer" groesse="l" symbol={<ArrowRightLeft className="size-5" />} onClick={() => setWahl(true)}>
            Umbuchen
          </Knopf>
        )}
        {darf("stuecke_verwalten") && (
          <Knopf groesse="l" symbol={<Pencil className="size-5" />} onClick={() => setBearbeiten(true)}>
            Bearbeiten
          </Knopf>
        )}
        {kannBuchen && s.behaelter && (
          <KnopfLink to={`/scannen?modus=einlagern&behaelter=${s.id}`} groesse="l" symbol={<PackagePlus className="size-5" />}>
            Befüllen
          </KnopfLink>
        )}
        {kannBuchen && !s.ausleihe && (
          <Knopf groesse="l" symbol={<Handshake className="size-5" />} onClick={() => setAusgeben(true)}>
            Ausleihen
          </Knopf>
        )}
        {kannBuchen && hatPruefung && (
          <Knopf groesse="l" symbol={<ClipboardCheck className="size-5" />} onClick={() => setPruefen(true)}>
            Prüfung
          </Knopf>
        )}
        {kannBuchen && !s.vermisst_seit && (
          <Knopf
            groesse="l"
            laedt={laedt === "vermisst"}
            symbol={<SearchX className="size-5" />}
            onClick={() => void aktion("vermisst", "/vermisst", "Als vermisst gemeldet – wer es scannt, bekommt einen Hinweis")}
          >
            Vermisst
          </Knopf>
        )}
        {s.behaelter && darf("erfassen") && (
          <KnopfLink to={`/etiketten?behaelter=${s.id}`} groesse="l" symbol={<Printer className="size-5" />}>
            Etikett
          </KnopfLink>
        )}
      </div>

      {s.behaelter && (
        <Abschnitt titel={`Inhalt · ${inhalt.length}`}>
          {inhalt.length === 0 ? (
            <Leer symbol={<Box />} titel="Leer" text="Mit „Befüllen“ Stücke scannen und in diesen Behälter legen." />
          ) : (
            <Liste>
              {inhalt.map((i) => (
                <Zeile
                  key={i.id}
                  zu={`/stuecke/${i.id}`}
                  bild={<StueckBild stueck={i} className="size-12 rounded-xl" />}
                  titel={i.name}
                  unter={
                    <>
                      <span className="font-mono">{i.code}</span>
                      <StueckMerkmale stueck={i} max={2} mitBehaelter={false} className="mt-1" />
                    </>
                  }
                />
              ))}
            </Liste>
          )}
        </Abschnitt>
      )}

      {pruefungen.length > 0 && (
        <Abschnitt titel="Prüfungen">
          <Liste>
            {pruefungen.map((p) => (
              <div key={p.id} className="flex items-start gap-3 px-4 py-3">
                <div
                  className={kl(
                    "flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
                    p.ergebnis === "bestanden" ? "bg-erfolg-weich text-erfolg-text" : p.ergebnis === "mangel" ? "bg-warnung-weich text-warnung-text" : "bg-gefahr-weich text-gefahr-text",
                  )}
                >
                  <ClipboardCheck />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="text-[15px] font-semibold">{PRUEF_ERGEBNIS_NAME[p.ergebnis]}</span>
                    <span className="ml-auto shrink-0 text-[12px] text-gedaempft">{datumText(p.datum)}</span>
                  </div>
                  <div className="text-[13px] text-gedaempft">
                    {p.benutzer}
                    {p.naechste && ` · nächste ${datumText(p.naechste)}`}
                  </div>
                  {p.notiz && <div className="mt-0.5 whitespace-pre-wrap text-[13px]">{p.notiz}</div>}
                </div>
              </div>
            ))}
          </Liste>
        </Abschnitt>
      )}

      {ausleihen.length > 0 && (
        <Abschnitt titel="Ausleihen">
          <Liste>
            {ausleihen.map((a) => (
              <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-gedaempft [&_svg]:size-5">
                  <Handshake />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2">
                    <span className="truncate text-[15px] font-semibold">{a.an}</span>
                    {!a.zurueck_am && <Abzeichen ton={istUeberfaellig(a.bis) ? "gefahr" : "warnung"}>offen</Abzeichen>}
                  </div>
                  <div className="text-[13px] text-gedaempft">
                    {zeitpunkt(a.ausgegeben_am)} von {a.ausgegeben_von}
                    {a.bis && ` · bis ${datumText(a.bis)}`}
                  </div>
                  {a.zurueck_am && (
                    <div className="text-[13px] text-gedaempft">
                      zurück {zeitpunkt(a.zurueck_am)}
                      {a.zurueck_von && ` · ${a.zurueck_von}`}
                    </div>
                  )}
                  {a.notiz && <div className="mt-0.5 text-[13px]">„{a.notiz}“</div>}
                </div>
              </div>
            ))}
          </Liste>
        </Abschnitt>
      )}

      <Abschnitt
        titel="Verlauf"
        aktion={
          rueckgaengigMoeglich && (
            <Knopf
              art="leise"
              className="h-9 px-3 text-sm"
              laedt={laedt === "rueckgaengig"}
              onClick={async () => {
                setLaedt("rueckgaengig");
                try {
                  await senden("/buchungen/rueckgaengig", { vorgang_id: letzte.vorgang_id });
                  melden("Letzte Bewegung rückgängig gemacht", "info");
                  await neuLaden();
                } catch (e) {
                  melden(fehlerText(e), "fehler");
                } finally {
                  setLaedt(null);
                }
              }}
            >
              <Undo2 className="size-4" /> Rückgängig
            </Knopf>
          )
        }
      >
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
      <AusleiheBlatt
        stuecke={ausgeben ? [s] : null}
        schliessen={() => setAusgeben(false)}
        fertig={(_, an) => {
          setAusgeben(false);
          melden(`An ${an} ausgegeben`);
          void neuLaden();
        }}
      />
      {pruefen && (
        <PruefungBlatt
          stueck={s}
          schliessen={() => setPruefen(false)}
          fertig={() => {
            setPruefen(false);
            melden("Prüfung gespeichert");
            void neuLaden();
          }}
        />
      )}
      {bearbeiten && (
        <StueckBearbeiten
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

const HINWEIS_TON: Record<Extract<Ton, "gefahr" | "warnung">, string> = {
  gefahr: "border-gefahr/40 bg-gefahr-weich text-gefahr-text",
  warnung: "border-warnung/40 bg-warnung-weich text-warnung-text",
};

function Hinweis({
  ton,
  symbol,
  titel,
  text,
  children,
}: {
  ton: "gefahr" | "warnung";
  symbol: ReactNode;
  titel: string;
  text: string;
  children?: ReactNode;
}) {
  return (
    <div role="status" className={kl("flex flex-wrap items-center gap-3 rounded-2xl border p-4", HINWEIS_TON[ton])}>
      <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-flaeche/60 [&_svg]:size-5">{symbol}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[15px] font-bold">{titel}</div>
        <div className="text-[13px] opacity-90">{text}</div>
      </div>
      {children}
    </div>
  );
}
