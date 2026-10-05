import { Download, FileClock, History, KeyRound, PackagePlus, Pencil, Repeat2, ShieldAlert, UserPlus, Warehouse } from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import type { Buchung, ProtokollEintrag, Seite } from "../../gemeinsam/typen";
import { BewegungsZeile } from "../komponenten/BewegungsZeile";
import { abfrage, fehlerText, holen } from "../lib/api";
import { tagesUeberschrift, uhrzeit, zeitpunkt } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Auswahl, Chips, Segmente } from "../ui/formular";
import { Liste } from "../ui/karte";
import { kl } from "../ui/kl";
import { Knopf, knopfKlassen } from "../ui/knopf";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

type Ansicht = "bewegungen" | "aktionen";
type Zeitraum = "heute" | "7" | "30" | "alle";

function vonDatum(z: Zeitraum): string | undefined {
  if (z === "alle") return undefined;
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (z !== "heute") d.setDate(d.getDate() - Number(z) + 1);
  return d.toISOString();
}

const AKTION_SYMBOL: Record<string, ReactNode> = {
  umgebucht: <Repeat2 />,
  stueck_erfasst: <PackagePlus />,
  stueck_geaendert: <Pencil />,
  platz_angelegt: <Warehouse />,
  platz_geaendert: <Warehouse />,
  benutzer_angelegt: <UserPlus />,
  benutzer_geaendert: <UserPlus />,
  passwort_geaendert: <KeyRound />,
  anmeldung_fehlgeschlagen: <ShieldAlert />,
  konto_gesperrt: <ShieldAlert />,
};

export default function Protokoll() {
  const { darf } = useSitzung();
  const alle = darf("protokoll_alle");
  const [ansicht, setAnsicht] = useState<Ansicht>("bewegungen");
  const [zeitraum, setZeitraum] = useState<Zeitraum>("7");
  const [benutzer, setBenutzer] = useState("");
  const namen = useLaden<{ id: number; name: string }[]>(alle ? "/benutzer/namen" : null);

  const filter = { von: vonDatum(zeitraum), benutzer_id: benutzer || undefined };
  const basis = ansicht === "bewegungen" ? "/protokoll/bewegungen" : "/protokoll";

  const [eintraege, setEintraege] = useState<(Buchung | ProtokollEintrag)[] | null>(null);
  const [weitere, setWeitere] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function laden(anhaengen: boolean) {
    setLaedt(true);
    setFehler(null);
    try {
      const vor = anhaengen && eintraege?.length ? eintraege[eintraege.length - 1]!.id : undefined;
      const r = await holen<Seite<Buchung | ProtokollEintrag>>(basis + abfrage({ ...filter, vor_id: vor }));
      setEintraege((l) => (anhaengen ? [...(l ?? []), ...r.eintraege] : r.eintraege));
      setWeitere(r.weitere);
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  useEffect(() => {
    setEintraege(null);
    void laden(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ansicht, zeitraum, benutzer]);

  // nach Tagen gruppieren
  const gruppen: [string, (Buchung | ProtokollEintrag)[]][] = [];
  for (const e of eintraege ?? []) {
    const tag = tagesUeberschrift(e.zeitpunkt);
    const letzte = gruppen[gruppen.length - 1];
    if (letzte && letzte[0] === tag) letzte[1].push(e);
    else gruppen.push([tag, [e]]);
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SeitenKopf
        titel="Protokoll"
        unter={alle ? "Wer hat was wann wohin gebracht – lückenlos" : "Deine eigenen Buchungen und Aktionen"}
        aktionen={
          <a href={"/api" + basis + "/csv" + abfrage(filter)} download className={knopfKlassen("zweit", "m")}>
            <Download className="size-5" />
            <span className="sr-only sm:not-sr-only">Excel / CSV</span>
          </a>
        }
      />
      <Segmente
        beschriftung="Ansicht"
        wert={ansicht}
        aendern={setAnsicht}
        optionen={[
          { wert: "bewegungen", text: "Bewegungen", symbol: <Repeat2 /> },
          { wert: "aktionen", text: "Alle Aktionen", symbol: <FileClock /> },
        ]}
      />
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="min-w-0 flex-1">
          <Chips
            wert={zeitraum}
            aendern={(w) => setZeitraum(w as Zeitraum)}
            optionen={[
              { wert: "heute", text: "Heute" },
              { wert: "7", text: "7 Tage" },
              { wert: "30", text: "30 Tage" },
              { wert: "alle", text: "Alles" },
            ]}
          />
        </div>
        {alle && (
          <Auswahl value={benutzer} onChange={(e) => setBenutzer(e.target.value)} aria-label="Benutzer filtern" className="sm:w-56">
            <option value="">Alle Benutzer</option>
            {namen.daten?.map((n) => (
              <option key={n.id} value={n.id}>
                {n.name}
              </option>
            ))}
          </Auswahl>
        )}
      </div>

      {fehler && <FehlerHinweis text={fehler} nochmal={() => void laden(false)} />}
      {eintraege === null ? (
        <SkelettListe />
      ) : eintraege.length === 0 ? (
        <Leer symbol={<History />} titel="Keine Einträge" text="Im gewählten Zeitraum ist nichts passiert." />
      ) : (
        <div className="space-y-5">
          {gruppen.map(([tag, liste]) => (
            <section key={tag} className="space-y-2">
              <h2 className="px-1 text-sm font-semibold">{tag}</h2>
              <Liste>
                {liste.map((e) =>
                  ansicht === "bewegungen" ? (
                    <BewegungsZeile key={e.id} b={e as Buchung} exakt />
                  ) : (
                    <AktionsZeile key={e.id} e={e as ProtokollEintrag} />
                  ),
                )}
              </Liste>
            </section>
          ))}
          {weitere && (
            <Knopf breit laedt={laedt} onClick={() => void laden(true)}>
              Ältere laden
            </Knopf>
          )}
        </div>
      )}
    </div>
  );
}

function AktionsZeile({ e }: { e: ProtokollEintrag }) {
  const warnung = e.aktion === "anmeldung_fehlgeschlagen" || e.aktion === "konto_gesperrt";
  return (
    <div className="flex items-start gap-3 px-4 py-3" title={zeitpunkt(e.zeitpunkt)}>
      <div
        className={kl(
          "flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
          warnung ? "bg-gefahr-weich text-gefahr-text" : "bg-flaeche-2 text-gedaempft",
        )}
      >
        {AKTION_SYMBOL[e.aktion] ?? <FileClock />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="text-[15px] font-medium">{e.text}</span>
          <span className="ml-auto shrink-0 text-[12px] text-gedaempft">{uhrzeit(e.zeitpunkt)}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-gedaempft">{e.benutzer ?? "System"}</div>
      </div>
    </div>
  );
}
