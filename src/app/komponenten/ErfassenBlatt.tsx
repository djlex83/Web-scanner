import { MapPin, ScanBarcode } from "lucide-react";
import { useEffect, useState } from "react";
import type { Platz, PlatzKurz, Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { useLaden } from "../lib/hooks";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Textfeld } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";
import { PlatzWahl } from "./PlatzWahl";

/** Neues Stück zu einem gescannten Code anlegen – optional gleich auf einen Platz. */
export function ErfassenBlatt({
  code,
  platz: startPlatz,
  schliessen,
  fertig,
}: {
  code: string | null;
  platz?: PlatzKurz | null;
  schliessen: () => void;
  fertig: (s: Stueck) => void;
}) {
  const [name, setName] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [platz, setPlatz] = useState<PlatzKurz | Platz | null>(startPlatz ?? null);
  const [wahlOffen, setWahlOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const kategorien = useLaden<string[]>(code ? "/stuecke/kategorien" : null);

  useEffect(() => {
    if (code) {
      setName("");
      setBeschreibung("");
      setFehler(null);
      setPlatz(startPlatz ?? null);
    }
  }, [code, startPlatz]);

  async function speichern() {
    if (!code) return;
    if (!name.trim()) {
      setFehler("Bitte einen Namen eingeben");
      return;
    }
    setLaedt(true);
    setFehler(null);
    try {
      const s = await senden<Stueck>("/stuecke", {
        code,
        name,
        kategorie: kategorie || null,
        beschreibung: beschreibung || null,
        platz_id: platz?.id ?? null,
      });
      fertig(s);
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <>
      <Blatt
        offen={code !== null && !wahlOffen}
        schliessen={schliessen}
        titel="Neues Stück erfassen"
        fuss={
          <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
            {platz ? "Erfassen und einlagern" : "Erfassen"}
          </Knopf>
        }
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void speichern();
          }}
        >
          <div className="flex items-center gap-3 rounded-2xl bg-flaeche-2 px-4 py-3">
            <ScanBarcode className="size-5 shrink-0 text-gedaempft" />
            <span className="min-w-0 flex-1 truncate font-mono text-[15px] font-semibold">{code}</span>
          </div>
          {fehler && <FehlerHinweis text={fehler} />}
          <Feld beschriftung="Name">
            {(p) => (
              <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Akkuschrauber Makita" maxLength={150} enterKeyHint="done" />
            )}
          </Feld>
          <Feld beschriftung="Kategorie" hinweis="Optional – hilft beim Suchen und Filtern">
            {(p) => (
              <div className="space-y-2">
                <Eingabe {...p} value={kategorie} onChange={(e) => setKategorie(e.target.value)} placeholder="z. B. Werkzeug" maxLength={80} />
                {!!kategorien.daten?.length && (
                  <div className="flex flex-wrap gap-2">
                    {kategorien.daten.slice(0, 8).map((k) => (
                      <button
                        key={k}
                        type="button"
                        onClick={() => setKategorie(k)}
                        className={kl(
                          "h-9 rounded-full border px-3.5 text-sm font-semibold transition",
                          k === kategorie ? "border-transparent bg-primaer text-auf-primaer" : "border-rand text-gedaempft hover:text-text",
                        )}
                      >
                        {k}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </Feld>
          <Feld beschriftung="Platz">
            {(p) => (
              <button
                {...p}
                type="button"
                onClick={() => setWahlOffen(true)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rand-stark bg-flaeche px-4 py-2 text-left transition hover:bg-flaeche-2"
              >
                <MapPin className="size-5 shrink-0 text-gedaempft" />
                <span className={kl("flex-1 text-[15px]", platz ? "font-semibold" : "text-gedaempft")}>
                  {platz ? platz.pfad : "Noch keinem Platz zuordnen"}
                </span>
                <span className="text-sm font-semibold text-primaer-text">Ändern</span>
              </button>
            )}
          </Feld>
          <Feld beschriftung="Beschreibung" hinweis="Optional">
            {(p) => (
              <Textfeld {...p} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} maxLength={1000} placeholder="Seriennummer, Zustand, Zubehör …" />
            )}
          </Feld>
        </form>
      </Blatt>
      <PlatzWahl
        offen={wahlOffen}
        schliessen={() => setWahlOffen(false)}
        waehlen={(p) => setPlatz(p)}
        aktuell={platz?.id}
        titel="Platz für das Stück"
      />
    </>
  );
}
