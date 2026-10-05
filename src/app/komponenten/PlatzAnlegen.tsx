import { useEffect, useState } from "react";
import { PLATZ_TYP_NAME, type Platz, type PlatzTyp } from "../../gemeinsam/typen";
import { aendern, fehlerText, senden } from "../lib/api";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Segmente, Textfeld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

type Art = "einzeln" | "reihe";

/** Platz anlegen – Regale und Fächer auch als Reihe ("Regal 1" bis "Regal 20"). */
export function PlatzAnlegen({
  typ,
  eltern,
  schliessen,
  fertig,
}: {
  typ: PlatzTyp | null;
  eltern?: Platz | null;
  schliessen: () => void;
  fertig: (anzahl: number) => void;
}) {
  const [art, setArt] = useState<Art>("einzeln");
  const [name, setName] = useState("");
  const [notiz, setNotiz] = useState("");
  const [praefix, setPraefix] = useState("");
  const [von, setVon] = useState("1");
  const [bis, setBis] = useState("10");
  const [laedt, setLaedt] = useState<string | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);

  useEffect(() => {
    if (typ) {
      setArt("einzeln");
      setName("");
      setNotiz("");
      setPraefix(typ === "fach" ? "Fach " : "Regal ");
      setFehler(null);
    }
  }, [typ]);

  if (!typ) return null;
  const typName = PLATZ_TYP_NAME[typ];
  const reiheMoeglich = typ !== "abteilung";
  const a = Number(von);
  const b = Number(bis);
  const reiheOk = Number.isInteger(a) && Number.isInteger(b) && a >= 0 && b >= a && b - a < 100;

  async function speichern() {
    setFehler(null);
    try {
      if (art === "einzeln") {
        if (!name.trim()) return setFehler("Bitte einen Namen eingeben");
        setLaedt("Speichert …");
        await senden("/plaetze", { name, typ, eltern_id: eltern?.id ?? null, notiz: notiz || null });
        fertig(1);
      } else {
        if (!reiheOk) return setFehler("Bitte einen gültigen Bereich angeben (höchstens 100 auf einmal)");
        let n = 0;
        for (let i = a; i <= b; i++) {
          setLaedt(`${i - a + 1} von ${b - a + 1} …`);
          try {
            await senden("/plaetze", { name: `${praefix}${i}`.trim(), typ, eltern_id: eltern?.id ?? null });
            n++;
          } catch (e) {
            // schon vorhandene überspringen, andere Fehler abbrechen
            if (!fehlerText(e).includes("gibt es hier schon")) throw e;
          }
        }
        fertig(n);
      }
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(null);
    }
  }

  return (
    <Blatt
      offen
      schliessen={schliessen}
      titel={`${typName} anlegen`}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt !== null} onClick={() => void speichern()}>
          {laedt ?? (art === "reihe" && reiheOk ? `${b - a + 1} ${typ === "fach" ? "Fächer" : "Regale"} anlegen` : "Anlegen")}
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
        {eltern && (
          <p className="rounded-2xl bg-flaeche-2 px-4 py-3 text-[15px]">
            in <span className="font-semibold">{eltern.pfad}</span>
          </p>
        )}
        {fehler && <FehlerHinweis text={fehler} />}
        {reiheMoeglich && (
          <Segmente
            beschriftung="Wie viele?"
            wert={art}
            aendern={setArt}
            optionen={[
              { wert: "einzeln", text: "Einzeln" },
              { wert: "reihe", text: "Mehrere auf einmal" },
            ]}
          />
        )}
        {art === "einzeln" ? (
          <>
            <Feld beschriftung="Name" hinweis={typ === "abteilung" ? "z. B. Montage, Lager, Werkstatt" : "z. B. Regal 12 oder Hochregal A"}>
              {(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}
            </Feld>
            <Feld beschriftung="Notiz" hinweis="Optional, z. B. Lage in der Halle">
              {(p) => <Textfeld {...p} rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} />}
            </Feld>
          </>
        ) : (
          <>
            <Feld beschriftung="Name vor der Nummer">
              {(p) => <Eingabe {...p} value={praefix} onChange={(e) => setPraefix(e.target.value)} maxLength={80} />}
            </Feld>
            <div className="grid grid-cols-2 gap-3">
              <Feld beschriftung="Von">
                {(p) => <Eingabe {...p} inputMode="numeric" value={von} onChange={(e) => setVon(e.target.value)} />}
              </Feld>
              <Feld beschriftung="Bis">
                {(p) => <Eingabe {...p} inputMode="numeric" value={bis} onChange={(e) => setBis(e.target.value)} />}
              </Feld>
            </div>
            {reiheOk && (
              <p className="px-1 text-[13px] text-gedaempft">
                Ergibt: „{praefix}
                {a}“, „{praefix}
                {a + 1}“ … „{praefix}
                {b}“
              </p>
            )}
          </>
        )}
      </form>
    </Blatt>
  );
}

/** Platz umbenennen, Notiz ändern oder deaktivieren. */
export function PlatzBearbeiten({ platz, schliessen, fertig }: { platz: Platz; schliessen: () => void; fertig: () => void }) {
  const [name, setName] = useState(platz.name);
  const [notiz, setNotiz] = useState(platz.notiz ?? "");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern(daten: Record<string, unknown>) {
    setLaedt(true);
    setFehler(null);
    try {
      await aendern(`/plaetze/${platz.id}`, daten);
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
      titel={`${PLATZ_TYP_NAME[platz.typ]} bearbeiten`}
      fuss={
        <div className="space-y-2">
          <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern({ name, notiz: notiz || null })}>
            Speichern
          </Knopf>
          <Knopf art="gefahr" breit disabled={laedt} onClick={() => void speichern({ aktiv: !platz.aktiv })}>
            {platz.aktiv ? "Deaktivieren" : "Wieder aktivieren"}
          </Knopf>
        </div>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Name">{(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} maxLength={100} />}</Feld>
        <Feld beschriftung="Notiz">
          {(p) => <Textfeld {...p} rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} />}
        </Feld>
        <p className="px-1 text-[13px] text-gedaempft">
          Deaktivieren geht nur, wenn der Platz leer ist. Das Etikett bleibt gültig, falls er wieder aktiviert wird.
        </p>
      </div>
    </Blatt>
  );
}
