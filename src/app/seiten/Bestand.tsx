import { Download, House, PackagePlus, PackageSearch, Search, Shapes, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Seite, Stueck } from "../../gemeinsam/typen";
import { BehaelterAnlegen } from "../komponenten/BehaelterAnlegen";
import { StueckBild } from "../komponenten/kategorie";
import { StueckMerkmale } from "../komponenten/StueckMerkmale";
import { abfrage, fehlerText, holen } from "../lib/api";
import { useVerzoegert } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Chips, Eingabe } from "../ui/formular";
import { Liste, Zeile } from "../ui/karte";
import { Knopf, KnopfLink, knopfKlassen } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

const FILTER = [
  { wert: "", text: "Alle" },
  { wert: "ohne", text: "Ohne Platz" },
  { wert: "fremd", text: "Nicht am Stammplatz" },
  { wert: "vermisst", text: "Vermisst" },
  { wert: "verliehen", text: "Verliehen" },
  { wert: "pruefung", text: "Prüfung fällig" },
  { wert: "defekt", text: "Defekt" },
  { wert: "behaelter", text: "Behälter" },
  { wert: "ohne_inventur", text: "Ohne Inventur" },
  { wert: "ausgemustert", text: "Ausgemustert" },
];
const STATUS_FILTER = ["defekt", "ausgemustert"];

/** Filter-Chip ↔ Adresse (platz=ohne, status=…, merkmal=…) */
function filterAusAdresse(p: URLSearchParams): string {
  if (p.get("platz") === "ohne") return "ohne";
  return p.get("merkmal") ?? p.get("status") ?? "";
}
function filterFelder(f: string) {
  return {
    platz: f === "ohne" ? "ohne" : undefined,
    status: STATUS_FILTER.includes(f) ? f : undefined,
    merkmal: f && f !== "ohne" && !STATUS_FILTER.includes(f) ? f : undefined,
  };
}

export default function Bestand() {
  const { darf } = useSitzung();
  const navigate = useNavigate();
  const melden = useMeldung();
  const [param, setParam] = useSearchParams();
  const [suche, setSuche] = useState(param.get("q") ?? "");
  const q = useVerzoegert(suche.trim(), 250);
  const filter = filterAusAdresse(param);
  const [neuerBehaelter, setNeuerBehaelter] = useState(false);

  const [liste, setListe] = useState<Stueck[] | null>(null);
  const [weitere, setWeitere] = useState(false);
  const [seite, setSeite] = useState(0);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const pfad = (s: number) => "/stuecke" + abfrage({ q, ...filterFelder(filter), seite: s });

  useEffect(() => {
    let aktiv = true;
    setLaedt(true);
    setFehler(null);
    holen<Seite<Stueck>>(pfad(0))
      .then((r) => {
        if (!aktiv) return;
        setListe(r.eintraege);
        setWeitere(r.weitere);
        setSeite(0);
      })
      .catch((e) => aktiv && setFehler(fehlerText(e)))
      .finally(() => aktiv && setLaedt(false));
    return () => {
      aktiv = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, filter]);

  async function mehr() {
    setLaedt(true);
    try {
      const r = await holen<Seite<Stueck>>(pfad(seite + 1));
      setListe((l) => [...(l ?? []), ...r.eintraege]);
      setWeitere(r.weitere);
      setSeite(seite + 1);
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  function filterSetzen(w: string) {
    setParam(new URLSearchParams(abfrage(filterFelder(w))), { replace: true });
  }

  return (
    <div className="space-y-4">
      <SeitenKopf
        titel="Bestand"
        unter="Alle Stücke – suchen, filtern, Details ansehen"
        aktionen={
          <>
            <a
              href={"/api/stuecke/csv" + abfrage({ q, ...filterFelder(filter) })}
              download
              title="Als Excel-Tabelle (CSV) herunterladen"
              className={knopfKlassen("zweit")}
            >
              <Download className="size-5" />
              <span className="sr-only sm:not-sr-only">Export</span>
            </a>
            {darf("erfassen") && (
              <Knopf symbol={<PackagePlus className="size-5" />} onClick={() => setNeuerBehaelter(true)}>
                <span className="sr-only sm:not-sr-only">Behälter</span>
              </Knopf>
            )}
            {darf("stuecke_verwalten") && (
              <KnopfLink to="/kategorien" symbol={<Shapes className="size-5" />}>
                <span className="sr-only sm:not-sr-only">Kategorien</span>
              </KnopfLink>
            )}
          </>
        }
      />
      <div className="relative">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gedaempft" />
        <Eingabe
          type="search"
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Name, Code oder Kategorie"
          aria-label="Bestand durchsuchen"
          className="h-14 rounded-2xl pl-12 pr-12 shadow-karte"
        />
        {suche && (
          <button
            onClick={() => setSuche("")}
            aria-label="Suche leeren"
            className="absolute right-2 top-1/2 flex size-10 -translate-y-1/2 items-center justify-center rounded-full text-gedaempft hover:bg-flaeche-2"
          >
            <X className="size-5" />
          </button>
        )}
      </div>
      <Chips optionen={FILTER} wert={filter} aendern={filterSetzen} />

      {filter === "fremd" && darf("buchen") && liste && liste.length > 0 && (
        <div className="flex items-center gap-3 rounded-2xl bg-primaer-weich p-4 text-primaer-text">
          <House className="size-5 shrink-0" />
          <p className="min-w-0 flex-1 text-[14px] font-medium">Diese Stücke liegen nicht an ihrem Stammplatz. Einsammeln, scannen, mit einem Tipp zurückräumen.</p>
          <KnopfLink to="/scannen?modus=zurueck" art="primaer" className="shrink-0">
            Aufräumen
          </KnopfLink>
        </div>
      )}
      {fehler && <FehlerHinweis text={fehler} />}
      {liste === null ? (
        <SkelettListe />
      ) : liste.length === 0 ? (
        <Leer
          symbol={<PackageSearch />}
          titel={q || filter ? "Nichts gefunden" : "Noch keine Stücke"}
          text={q || filter ? "Andere Suche oder anderen Filter versuchen." : "Stücke werden beim Scannen im Modus „Einlagern“ erfasst."}
          aktion={!q && !filter && <KnopfLink to="/scannen?modus=einlagern" art="primaer">Jetzt einlagern</KnopfLink>}
        />
      ) : (
        <>
          <Liste>
            {liste.map((s) => (
              <Zeile
                key={s.id}
                zu={`/stuecke/${s.id}`}
                bild={<StueckBild stueck={s} className="size-12 rounded-xl" />}
                titel={s.name}
                unter={
                  <>
                    <span className="font-medium text-text">
                      {s.platz?.pfad ?? "Kein Platz"}
                      {s.in_behaelter && ` › ${s.in_behaelter.name}`}
                    </span>
                    <span className="font-mono"> · {s.code}</span>
                    <StueckMerkmale stueck={s} max={2} className="mt-1 sm:hidden" />
                  </>
                }
                rechts={<StueckMerkmale stueck={s} max={2} className="hidden justify-end sm:flex" />}
              />
            ))}
          </Liste>
          {weitere && (
            <Knopf breit laedt={laedt} onClick={() => void mehr()}>
              Weitere laden
            </Knopf>
          )}
        </>
      )}
      {neuerBehaelter && (
        <BehaelterAnlegen
          schliessen={() => setNeuerBehaelter(false)}
          fertig={(b) => {
            setNeuerBehaelter(false);
            melden(`Behälter „${b.name}“ angelegt – jetzt Etikett drucken`);
            navigate(`/stuecke/${b.id}`);
          }}
        />
      )}
    </div>
  );
}
