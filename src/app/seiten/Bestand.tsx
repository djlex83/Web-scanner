import { Box, PackageSearch, Search, X } from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Seite, Stueck } from "../../gemeinsam/typen";
import { abfrage, fehlerText, holen } from "../lib/api";
import { useVerzoegert } from "../lib/hooks";
import { StatusAbzeichen } from "../ui/abzeichen";
import { Chips, Eingabe } from "../ui/formular";
import { Liste, Zeile } from "../ui/karte";
import { Knopf, KnopfLink } from "../ui/knopf";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

const FILTER = [
  { wert: "", text: "Alle" },
  { wert: "ohne", text: "Ohne Platz" },
  { wert: "defekt", text: "Defekt" },
  { wert: "ausgemustert", text: "Ausgemustert" },
];

export default function Bestand() {
  const [param, setParam] = useSearchParams();
  const [suche, setSuche] = useState(param.get("q") ?? "");
  const q = useVerzoegert(suche.trim(), 250);
  const filter = param.get("platz") === "ohne" ? "ohne" : (param.get("status") ?? "");

  const [liste, setListe] = useState<Stueck[] | null>(null);
  const [weitere, setWeitere] = useState(false);
  const [seite, setSeite] = useState(0);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const pfad = (s: number) =>
    "/stuecke" +
    abfrage({
      q,
      status: filter === "ohne" ? undefined : filter,
      platz: filter === "ohne" ? "ohne" : undefined,
      seite: s,
    });

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
    const p = new URLSearchParams();
    if (w === "ohne") p.set("platz", "ohne");
    else if (w) p.set("status", w);
    setParam(p, { replace: true });
  }

  return (
    <div className="space-y-4">
      <SeitenKopf titel="Bestand" unter="Alle Stücke – suchen, filtern, Details ansehen" />
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
                symbol={<Box />}
                titel={s.name}
                unter={
                  <>
                    <span className="font-medium text-text">{s.platz?.pfad ?? "Kein Platz"}</span>
                    <span className="font-mono"> · {s.code}</span>
                  </>
                }
                rechts={s.status !== "vorhanden" && <StatusAbzeichen status={s.status} />}
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
    </div>
  );
}
