import { Box, MapPin, ScanBarcode } from "lucide-react";
import { useEffect, useState } from "react";
import type { Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { fotoHochladen } from "../lib/bild";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Schalter, Textfeld } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";
import { FotoFeld } from "./FotoBereich";
import { KategorieSymbol, kategorienAktualisieren, useKategorien } from "./kategorie";
import { PlatzWahl } from "./PlatzWahl";
import { useMeldung } from "../ui/meldungen";
import { zielPfad, type Ziel } from "../lib/ziel";

/** Neues Stück zu einem gescannten Code anlegen – optional gleich auf einen Platz oder in einen Behälter. */
export function ErfassenBlatt({
  code,
  ziel: startZiel,
  schliessen,
  fertig,
}: {
  code: string | null;
  ziel?: Ziel | null;
  schliessen: () => void;
  fertig: (s: Stueck) => void;
}) {
  const [name, setName] = useState("");
  const [kategorie, setKategorie] = useState("");
  const [beschreibung, setBeschreibung] = useState("");
  const [ziel, setZiel] = useState<Ziel | null>(startZiel ?? null);
  const [inventur, setInventur] = useState(true);
  const [behaelter, setBehaelter] = useState(false);
  const [wahlOffen, setWahlOffen] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const kategorien = useKategorien();
  // Vorschläge: beim Tippen passend gefiltert, sonst die häufigsten
  const suche = kategorie.trim().toLowerCase();
  const vorschlaege = (kategorien ?? [])
    .filter((k) => !suche || k.name.toLowerCase().includes(suche))
    .slice(0, 10);
  const [foto, setFoto] = useState<File | null>(null);
  const melden = useMeldung();

  useEffect(() => {
    if (code) {
      setName("");
      setBeschreibung("");
      setFoto(null);
      setFehler(null);
      setZiel(startZiel ?? null);
      setInventur(true);
      setBehaelter(false);
    }
  }, [code, startZiel]);

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
        platz_id: ziel?.art === "platz" ? ziel.platz.id : null,
        in_behaelter_id: ziel?.art === "behaelter" ? ziel.stueck.id : null,
        inventur,
        behaelter,
      });
      let ergebnis = s;
      if (foto) {
        try {
          ergebnis = { ...s, foto_version: await fotoHochladen(s.id, foto) };
        } catch (e) {
          melden(`Stück erfasst, aber Foto nicht gespeichert: ${fehlerText(e)}`, "fehler");
        }
      }
      void kategorienAktualisieren();
      fertig(ergebnis);
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
            {ziel ? "Erfassen und einlagern" : "Erfassen"}
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
                {vorschlaege.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {vorschlaege.map((k) => (
                      <button
                        key={k.name}
                        type="button"
                        onClick={() => setKategorie(k.name)}
                        aria-pressed={k.name === kategorie}
                        className={kl(
                          "flex h-10 items-center gap-2 rounded-full border pl-1.5 pr-3.5 text-sm font-semibold transition",
                          k.name === kategorie ? "border-primaer bg-primaer-weich text-primaer-text" : "border-rand text-gedaempft hover:text-text",
                        )}
                      >
                        <KategorieSymbol stil={k} className="size-7 rounded-full" />
                        {k.name}
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
                {ziel?.art === "behaelter" ? (
                  <Box className="size-5 shrink-0 text-gedaempft" />
                ) : (
                  <MapPin className="size-5 shrink-0 text-gedaempft" />
                )}
                <span className={kl("flex-1 text-[15px]", ziel ? "font-semibold" : "text-gedaempft")}>
                  {ziel ? zielPfad(ziel) : "Noch keinem Platz zuordnen"}
                </span>
                <span className="text-sm font-semibold text-primaer-text">Ändern</span>
              </button>
            )}
          </Feld>
          <div className="space-y-1.5">
            <div className="px-1 text-sm font-semibold">Foto <span className="font-normal text-gedaempft">(optional)</span></div>
            <FotoFeld datei={foto} setDatei={setFoto} />
          </div>
          <div className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand">
            <Schalter
              an={inventur}
              aendern={setInventur}
              beschriftung="Bei der Inventur zählen"
              beschreibung="Aus z. B. für Verbrauchsmaterial"
            />
            {ziel?.art !== "behaelter" && (
              <Schalter
                an={behaelter}
                aendern={setBehaelter}
                beschriftung="Ist ein Behälter"
                beschreibung="Kiste oder Koffer, in den andere Stücke kommen"
              />
            )}
          </div>
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
        waehlen={(p) => setZiel({ art: "platz", platz: p })}
        aktuell={ziel?.art === "platz" ? ziel.platz.id : undefined}
        titel="Platz für das Stück"
      />
    </>
  );
}
