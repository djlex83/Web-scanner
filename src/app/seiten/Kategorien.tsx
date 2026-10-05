import { Check, Shapes } from "lucide-react";
import { useState } from "react";
import { FARBE_NAME, FARBEN, SYMBOLE, type Farbe, type Kategorie, type Symbol } from "../../gemeinsam/kategorien";
import { KategorieSymbol, kategorienAktualisieren, SYMBOL, useKategorien } from "../komponenten/kategorie";
import { ersetzen, fehlerText } from "../lib/api";
import { anzahl } from "../lib/format";
import { Abzeichen } from "../ui/abzeichen";
import { Blatt } from "../ui/blatt";
import { Liste, Zeile } from "../ui/karte";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

export default function Kategorien() {
  const kategorien = useKategorien();
  const [auswahl, setAuswahl] = useState<Kategorie | null>(null);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <SeitenKopf
        zurueck
        titel="Kategorien"
        unter="Symbol und Farbe je Kategorie – erscheinen überall, wo ein Stück kein Foto hat"
      />
      {!kategorien ? (
        <SkelettListe zeilen={4} />
      ) : kategorien.length === 0 ? (
        <Leer
          symbol={<Shapes />}
          titel="Noch keine Kategorien"
          text="Kategorien entstehen beim Erfassen von Stücken (Feld „Kategorie“)."
        />
      ) : (
        <Liste>
          {kategorien.map((k) => (
            <Zeile
              key={k.name}
              onClick={() => setAuswahl(k)}
              bild={<KategorieSymbol stil={k} className="size-12 rounded-xl" />}
              titel={k.name}
              unter={`${anzahl(k.anzahl, "Stück", "Stücke")} · ${SYMBOL[k.symbol]?.name ?? k.symbol}, ${FARBE_NAME[k.farbe]}`}
              rechts={!k.eigen && <Abzeichen>automatisch</Abzeichen>}
            />
          ))}
        </Liste>
      )}
      {auswahl && <StilBlatt kategorie={auswahl} schliessen={() => setAuswahl(null)} />}
    </div>
  );
}

function StilBlatt({ kategorie, schliessen }: { kategorie: Kategorie; schliessen: () => void }) {
  const melden = useMeldung();
  const [symbol, setSymbol] = useState<Symbol>(kategorie.symbol);
  const [farbe, setFarbe] = useState<Farbe>(kategorie.farbe);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      await ersetzen(`/kategorien/${encodeURIComponent(kategorie.name)}`, { symbol, farbe });
      await kategorienAktualisieren();
      melden("Gespeichert");
      schliessen();
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
      titel={kategorie.name}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Speichern
        </Knopf>
      }
    >
      <div className="space-y-6">
        {fehler && <FehlerHinweis text={fehler} />}
        <div className="flex items-center gap-4 rounded-2xl bg-flaeche-2 p-4">
          <KategorieSymbol stil={{ symbol, farbe }} className="size-16 rounded-2xl" />
          <div>
            <div className="text-[15px] font-semibold">Vorschau</div>
            <div className="text-[13px] text-gedaempft">
              {SYMBOL[symbol].name}, {FARBE_NAME[farbe]}
            </div>
          </div>
        </div>

        <fieldset>
          <legend className="mb-2 px-1 text-sm font-semibold">Farbe</legend>
          <div className="flex flex-wrap gap-2.5">
            {FARBEN.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFarbe(f)}
                aria-label={FARBE_NAME[f]}
                aria-pressed={f === farbe}
                title={FARBE_NAME[f]}
                className={kl(
                  "flex size-12 items-center justify-center rounded-full border-2 transition active:scale-95",
                  f === farbe ? "border-text" : "border-transparent",
                )}
                style={{ background: `var(--kat-${f}-bg)`, color: `var(--kat-${f}-fg)` }}
              >
                {f === farbe ? <Check className="size-5" /> : <span className="size-4 rounded-full" style={{ background: `var(--kat-${f}-fg)` }} />}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-2 px-1 text-sm font-semibold">Symbol</legend>
          <div className="grid grid-cols-6 gap-2 sm:grid-cols-8">
            {SYMBOLE.map((s) => {
              const Bild = SYMBOL[s].bild;
              const gewaehlt = s === symbol;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => setSymbol(s)}
                  aria-label={SYMBOL[s].name}
                  aria-pressed={gewaehlt}
                  title={SYMBOL[s].name}
                  className={kl(
                    "flex aspect-square min-h-12 items-center justify-center rounded-xl border transition active:scale-95",
                    gewaehlt ? "border-primaer bg-primaer-weich text-primaer-text" : "border-rand text-gedaempft hover:bg-flaeche-2 hover:text-text",
                  )}
                >
                  <Bild className="size-6" />
                </button>
              );
            })}
          </div>
        </fieldset>
      </div>
    </Blatt>
  );
}
