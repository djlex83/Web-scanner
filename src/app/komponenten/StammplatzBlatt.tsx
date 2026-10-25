import { Box, House, MapPin, Trash2 } from "lucide-react";
import { useState } from "react";
import type { Platz, Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { stammPfad } from "../lib/ziel";
import { Blatt } from "../ui/blatt";
import { Liste, Zeile } from "../ui/karte";
import { useMeldung } from "../ui/meldungen";
import { FehlerHinweis } from "../ui/zustand";
import { PlatzWahl } from "./PlatzWahl";

/** Stammplatz eines Stücks festlegen: aktueller Ort, anderer Platz oder entfernen. */
export function StammplatzBlatt({ stueck: s, schliessen, fertig }: { stueck: Stueck; schliessen: () => void; fertig: () => void }) {
  const melden = useMeldung();
  const [wahl, setWahl] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const aktuellerOrt = s.in_behaelter ? `${s.platz?.pfad ?? ""} › ${s.in_behaelter.name}` : s.platz?.pfad;

  async function setzen(daten: Record<string, unknown>, text: string) {
    setFehler(null);
    try {
      await senden("/stuecke/stammplatz", { stueck_ids: [s.id], ...daten });
      melden(text);
      fertig();
    } catch (e) {
      setFehler(fehlerText(e));
    }
  }

  return (
    <>
      <Blatt offen={!wahl} schliessen={schliessen} titel="Stammplatz">
        <div className="space-y-4">
          <p className="text-[15px] text-gedaempft">
            Hierher gehört das Stück. Beim <b className="text-text">Aufräumen</b> wird es an diesen Platz zurückgebucht.
            {stammPfad(s) && (
              <>
                <br />
                Jetzt: <b className="text-text">{stammPfad(s)}</b>
              </>
            )}
          </p>
          {fehler && <FehlerHinweis text={fehler} />}
          <Liste>
            {aktuellerOrt && !s.am_stammplatz && (
              <Zeile
                symbol={s.in_behaelter ? <Box /> : <House />}
                titel="Aktuellen Ort übernehmen"
                unter={aktuellerOrt}
                onClick={() => void setzen({ aktuell: true }, "Stammplatz festgelegt")}
              />
            )}
            <Zeile symbol={<MapPin />} titel="Anderen Platz wählen" unter="aus der Liste der Plätze" onClick={() => setWahl(true)} />
            {s.am_stammplatz !== null && (
              <Zeile symbol={<Trash2 />} titel="Stammplatz entfernen" unter="Das Stück gehört nirgends fest hin" onClick={() => void setzen({}, "Stammplatz entfernt")} />
            )}
          </Liste>
        </div>
      </Blatt>
      <PlatzWahl
        offen={wahl}
        schliessen={() => setWahl(false)}
        waehlen={(p: Platz) => void setzen({ platz_id: p.id }, `Stammplatz: ${p.pfad}`)}
        aktuell={s.stammplatz?.id}
        titel="Wohin gehört das Stück?"
      />
    </>
  );
}
