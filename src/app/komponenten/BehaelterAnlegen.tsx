import { MapPin } from "lucide-react";
import { useState } from "react";
import type { Platz, Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";
import { PlatzWahl } from "./PlatzWahl";

/** Behälter ohne vorhandenen Strichcode anlegen – die App vergibt einen Code für das Etikett. */
export function BehaelterAnlegen({ schliessen, fertig }: { schliessen: () => void; fertig: (s: Stueck) => void }) {
  const [name, setName] = useState("");
  const [platz, setPlatz] = useState<Platz | null>(null);
  const [wahl, setWahl] = useState(false);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function anlegen() {
    if (!name.trim()) return setFehler("Bitte einen Namen eingeben");
    setLaedt(true);
    setFehler(null);
    try {
      fertig(await senden<Stueck>("/stuecke", { name: name.trim(), behaelter: true, platz_id: platz?.id ?? null }));
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <>
      <Blatt
        offen={!wahl}
        schliessen={schliessen}
        titel="Neuer Behälter"
        fuss={
          <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void anlegen()}>
            Anlegen
          </Knopf>
        }
      >
        <form
          className="space-y-5"
          onSubmit={(e) => {
            e.preventDefault();
            void anlegen();
          }}
        >
          <p className="text-[15px] text-gedaempft">
            Für Kisten, Koffer oder Boxen. Die App vergibt einen eigenen Code – danach das Etikett drucken und aufkleben. Hat der
            Behälter schon einen Strichcode, einfach scannen und beim Erfassen „Ist ein Behälter“ einschalten.
          </p>
          {fehler && <FehlerHinweis text={fehler} />}
          <Feld beschriftung="Name">
            {(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="z. B. Kiste Elektro 1" maxLength={150} />}
          </Feld>
          <Feld beschriftung="Platz">
            {(p) => (
              <button
                {...p}
                type="button"
                onClick={() => setWahl(true)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl border border-rand-stark bg-flaeche px-4 py-2 text-left transition hover:bg-flaeche-2"
              >
                <MapPin className="size-5 shrink-0 text-gedaempft" />
                <span className={kl("flex-1 text-[15px]", platz ? "font-semibold" : "text-gedaempft")}>{platz?.pfad ?? "Noch keinem Platz zuordnen"}</span>
                <span className="text-sm font-semibold text-primaer-text">Ändern</span>
              </button>
            )}
          </Feld>
        </form>
      </Blatt>
      <PlatzWahl offen={wahl} schliessen={() => setWahl(false)} waehlen={setPlatz} aktuell={platz?.id} titel="Wo steht der Behälter?" />
    </>
  );
}
