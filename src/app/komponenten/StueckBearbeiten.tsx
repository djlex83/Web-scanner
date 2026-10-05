import { Box } from "lucide-react";
import { useId, useState } from "react";
import { STATUS_NAME, type Stueck, type StueckStatus } from "../../gemeinsam/typen";
import { aendern, fehlerText } from "../lib/api";
import { Blatt } from "../ui/blatt";
import { Auswahl, Eingabe, Feld, Schalter, Segmente, Textfeld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

const PRUEF_ARTEN = ["Elektroprüfung (DGUV V3)", "Sichtprüfung", "Kalibrierung", "Wartung", "UVV-Prüfung", "Leiterprüfung"];
const INTERVALLE = [3, 6, 12, 24, 36, 48, 60];

/** Stück bearbeiten: Stammdaten, Inventur, Behälter, Prüfplan. */
export function StueckBearbeiten({ stueck, schliessen, gespeichert }: { stueck: Stueck; schliessen: () => void; gespeichert: () => void }) {
  const artenId = useId();
  const [name, setName] = useState(stueck.name);
  const [kategorie, setKategorie] = useState(stueck.kategorie ?? "");
  const [beschreibung, setBeschreibung] = useState(stueck.beschreibung ?? "");
  const [status, setStatus] = useState<StueckStatus>(stueck.status);
  const [inventur, setInventur] = useState(stueck.inventur);
  const [behaelter, setBehaelter] = useState(stueck.behaelter);
  const [pruefArt, setPruefArt] = useState(stueck.pruefung.art ?? "");
  const [intervall, setIntervall] = useState(stueck.pruefung.intervall ? String(stueck.pruefung.intervall) : "");
  const [naechste, setNaechste] = useState(stueck.pruefung.naechste ?? "");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      await aendern(`/stuecke/${stueck.id}`, {
        name,
        kategorie: kategorie || null,
        beschreibung: beschreibung || null,
        status,
        inventur,
        behaelter,
        pruef_art: pruefArt || null,
        pruef_intervall: intervall ? Number(intervall) : null,
        pruef_naechste: naechste || null,
      });
      gespeichert();
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
      titel={stueck.behaelter ? "Behälter bearbeiten" : "Stück bearbeiten"}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Name">{(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={150} />}</Feld>
        <Feld beschriftung="Kategorie">
          {(p) => <Eingabe {...p} value={kategorie} onChange={(e) => setKategorie(e.target.value)} maxLength={80} />}
        </Feld>
        <Feld beschriftung="Beschreibung">
          {(p) => <Textfeld {...p} value={beschreibung} onChange={(e) => setBeschreibung(e.target.value)} maxLength={1000} />}
        </Feld>
        <div className="space-y-1.5">
          <div className="px-1 text-sm font-semibold">Status</div>
          <Segmente
            beschriftung="Status"
            wert={status}
            aendern={setStatus}
            optionen={(["vorhanden", "defekt", "ausgemustert"] as const).map((w) => ({ wert: w, text: STATUS_NAME[w] }))}
          />
          {status === "ausgemustert" && (
            <p className="px-1 text-[13px] text-gedaempft">
              <Box className="mr-1 inline size-3.5" />
              Ausgemusterte Stücke verschwinden aus Bestand und Regalen, bleiben aber im Protokoll.
            </p>
          )}
        </div>

        <div className="divide-y divide-rand overflow-hidden rounded-2xl border border-rand">
          <Schalter
            an={inventur}
            aendern={setInventur}
            beschriftung="Bei der Inventur zählen"
            beschreibung="Aus = wird bei der Inventur nicht erwartet (z. B. Verbrauchsmaterial)"
          />
          <Schalter
            an={behaelter}
            aendern={setBehaelter}
            beschriftung="Ist ein Behälter"
            beschreibung="Kiste oder Koffer, in den andere Stücke gelegt werden"
          />
        </div>

        <fieldset className="space-y-4 rounded-2xl border border-rand p-4">
          <legend className="px-1 text-sm font-semibold">Prüfung und Wartung</legend>
          <Feld beschriftung="Art" hinweis="Leer lassen, wenn keine Prüfung nötig ist">
            {(p) => (
              <>
                <Eingabe {...p} list={artenId} value={pruefArt} onChange={(e) => setPruefArt(e.target.value)} maxLength={100} placeholder="z. B. Elektroprüfung (DGUV V3)" />
                <datalist id={artenId}>
                  {PRUEF_ARTEN.map((a) => (
                    <option key={a} value={a} />
                  ))}
                </datalist>
              </>
            )}
          </Feld>
          <div className="grid grid-cols-2 gap-3">
            <Feld beschriftung="Intervall">
              {(p) => (
                <Auswahl {...p} value={intervall} onChange={(e) => setIntervall(e.target.value)}>
                  <option value="">keins</option>
                  {INTERVALLE.map((m) => (
                    <option key={m} value={m}>
                      {m % 12 === 0 ? `${m / 12} ${m === 12 ? "Jahr" : "Jahre"}` : `${m} Monate`}
                    </option>
                  ))}
                </Auswahl>
              )}
            </Feld>
            <Feld beschriftung="Nächste fällig">
              {(p) => <Eingabe {...p} type="date" value={naechste} onChange={(e) => setNaechste(e.target.value)} />}
            </Feld>
          </div>
        </fieldset>
      </div>
    </Blatt>
  );
}
