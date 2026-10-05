import { useState } from "react";
import { heute, istDatum, plusMonate } from "../../gemeinsam/datum";
import { PRUEF_ERGEBNIS_NAME, type PruefErgebnis, type Pruefung, type Stueck } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Segmente, Textfeld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

/** Ohne eigenes Intervall: nächste Prüfung 1 Jahr nach dem Prüfdatum */
const STANDARD_INTERVALL = 12;

/** Durchgeführte Prüfung oder Wartung eintragen. */
export function PruefungBlatt({ stueck, schliessen, fertig }: { stueck: Stueck; schliessen: () => void; fertig: (s: Stueck) => void }) {
  const intervall = stueck.pruefung.intervall ?? STANDARD_INTERVALL;
  const [datum, setDatum] = useState(heute());
  const [ergebnis, setErgebnis] = useState<PruefErgebnis>("bestanden");
  const [naechste, setNaechste] = useState(plusMonate(heute(), intervall));
  const [selbst, setSelbst] = useState(false);
  const [notiz, setNotiz] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  function datumSetzen(d: string) {
    setDatum(d);
    // nächster Termin folgt dem Prüfdatum, solange er nicht von Hand geändert wurde
    if (!selbst && istDatum(d)) setNaechste(plusMonate(d, intervall));
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
          hinweis={
            (stueck.pruefung.intervall
              ? `Prüfdatum + ${intervall % 12 === 0 ? `${intervall / 12} ${intervall === 12 ? "Jahr" : "Jahre"}` : `${intervall} Monate`}`
              : "Prüfdatum + 1 Jahr") + " – änderbar; leer lassen, wenn keine weitere Prüfung nötig ist"
          }
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

/** Prüfung löschen (ab Leitung) – mit Begründung fürs Protokoll. */
export function PruefungLoeschenBlatt({
  pruefung,
  schliessen,
  fertig,
}: {
  pruefung: Pruefung;
  schliessen: () => void;
  fertig: () => void;
}) {
  const [grund, setGrund] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function loeschen() {
    setLaedt(true);
    setFehler(null);
    try {
      await senden(`/pruefungen/${pruefung.id}/loeschen`, { grund: grund || null });
      fertig();
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
      titel="Prüfung löschen?"
      fuss={
        <Knopf art="gefahr" groesse="l" breit laedt={laedt} onClick={() => void loeschen()}>
          Prüfung löschen
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <p className="text-[15px]">
          <b>{PRUEF_ERGEBNIS_NAME[pruefung.ergebnis]}</b> vom <b>{pruefung.datum.split("-").reverse().join(".")}</b> ({pruefung.benutzer})
        </p>
        <p className="text-[13px] text-gedaempft">
          Die Prüfung verschwindet aus der Liste. War es die letzte, gilt wieder der Termin von davor. Im Protokoll bleibt
          festgehalten, wer sie wann gelöscht hat. Ein Status „defekt“ bleibt bestehen.
        </p>
        <Feld beschriftung="Grund" hinweis="Optional, z. B. „doppelt eingetragen“">
          {(p) => <Textfeld {...p} rows={2} value={grund} onChange={(e) => setGrund(e.target.value)} maxLength={300} />}
        </Feld>
      </div>
    </Blatt>
  );
}
