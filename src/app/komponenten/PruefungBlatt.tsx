import { useState } from "react";
import { heute, istDatum, plusMonate } from "../../gemeinsam/datum";
import { PRUEF_ERGEBNIS_NAME, type PruefErgebnis, type Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Segmente, Textfeld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

/** Durchgeführte Prüfung oder Wartung eintragen. */
export function PruefungBlatt({ stueck, schliessen, fertig }: { stueck: Stueck; schliessen: () => void; fertig: (s: Stueck) => void }) {
  const intervall = stueck.pruefung.intervall;
  const [datum, setDatum] = useState(heute());
  const [ergebnis, setErgebnis] = useState<PruefErgebnis>("bestanden");
  const [naechste, setNaechste] = useState(intervall ? plusMonate(heute(), intervall) : "");
  const [selbst, setSelbst] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function datumSetzen(d: string) {
    setDatum(d);
    // nächster Termin folgt dem Prüfdatum, solange er nicht von Hand geändert wurde
    if (!selbst && intervall && istDatum(d)) setNaechste(plusMonate(d, intervall));
  }

  async function speichern() {
    if (!istDatum(datum)) return setFehler("Bitte ein Prüfdatum wählen");
    setLaedt(true);
    setFehler(null);
    try {
      fertig(
        await senden<Stueck>("/pruefungen", {
          stueck_id: stueck.id,
          datum,
          ergebnis,
          notiz: notiz || null,
          naechste: naechste || null,
        }),
      );
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
      titel={stueck.pruefung.art ? `${stueck.pruefung.art} eintragen` : "Prüfung eintragen"}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Prüfung speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Geprüft am">
          {(p) => <Eingabe {...p} type="date" value={datum} max={heute()} onChange={(e) => datumSetzen(e.target.value)} />}
        </Feld>
        <div className="space-y-1.5">
          <div className="px-1 text-sm font-semibold">Ergebnis</div>
          <Segmente
            beschriftung="Ergebnis"
            wert={ergebnis}
            aendern={setErgebnis}
            optionen={(["bestanden", "mangel", "nicht_bestanden"] as const).map((w) => ({
              wert: w,
              text: w === "nicht_bestanden" ? "Nicht best." : PRUEF_ERGEBNIS_NAME[w],
            }))}
          />
          {ergebnis === "nicht_bestanden" && stueck.status === "vorhanden" && (
            <p className="px-1 text-[13px] font-medium text-gefahr-text">Das Stück wird als defekt markiert.</p>
          )}
        </div>
        <Feld
          beschriftung="Nächste Prüfung"
          hinweis={intervall ? `Alle ${intervall} Monate – aus dem Prüfdatum berechnet, änderbar` : "Optional – leer lassen, wenn keine weitere Prüfung nötig ist"}
        >
          {(p) => (
            <Eingabe
              {...p}
              type="date"
              value={naechste}
              min={datum}
              onChange={(e) => {
                setNaechste(e.target.value);
                setSelbst(true);
              }}
            />
          )}
        </Feld>
        <Feld beschriftung="Notiz" hinweis="Optional, z. B. Messwerte oder Mängel">
          {(p) => <Textfeld {...p} rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={1000} />}
        </Feld>
      </div>
    </Blatt>
  );
}
