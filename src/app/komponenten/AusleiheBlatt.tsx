import { useEffect, useId, useState } from "react";
import { heute, plusMonate, plusTage } from "../../gemeinsam/datum";
import type { Stueck } from "../../gemeinsam/typen";
import { fehlerText, holen, senden } from "../lib/api";
import { anzahl } from "../lib/format";
import { Blatt } from "../ui/blatt";
import { Chips, Eingabe, Feld, Textfeld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

const DAUER = [
  { wert: "7", text: "1 Woche" },
  { wert: "14", text: "2 Wochen" },
  { wert: "m1", text: "1 Monat" },
  { wert: "", text: "Ohne Datum" },
];

/** Stücke an eine Person ausgeben – mit Rückgabedatum. */
export function AusleiheBlatt({
  stuecke,
  schliessen,
  fertig,
}: {
  stuecke: Stueck[] | null;
  schliessen: () => void;
  fertig: (anzahl: number, an: string) => void;
}) {
  const listeId = useId();
  const [an, setAn] = useState("");
  const [dauer, setDauer] = useState("14");
  const [bis, setBis] = useState(plusTage(heute(), 14));
  const [notiz, setNotiz] = useState("");
  const [namen, setNamen] = useState<string[]>([]);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const offen = stuecke !== null && stuecke.length > 0;

  useEffect(() => {
    if (!offen) return;
    setFehler(null);
    holen<string[]>("/ausleihen/namen").then(setNamen).catch(() => {});
  }, [offen]);

  function dauerWaehlen(w: string) {
    setDauer(w);
    setBis(w === "" ? "" : w === "m1" ? plusMonate(heute(), 1) : plusTage(heute(), Number(w)));
  }

  async function ausgeben() {
    if (!stuecke) return;
    if (!an.trim()) return setFehler("Bitte angeben, wer die Stücke bekommt");
    setLaedt(true);
    setFehler(null);
    try {
      await senden("/ausleihen", { stueck_ids: stuecke.map((s) => s.id), an: an.trim(), bis: bis || null, notiz: notiz || null });
      fertig(stuecke.length, an.trim());
      setNotiz("");
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Blatt
      offen={offen}
      schliessen={schliessen}
      titel={stuecke?.length === 1 ? `„${stuecke[0]!.name}“ ausgeben` : `${anzahl(stuecke?.length ?? 0, "Stück", "Stücke")} ausgeben`}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void ausgeben()}>
          Ausgeben
        </Knopf>
      }
    >
      <form
        className="space-y-5"
        onSubmit={(e) => {
          e.preventDefault();
          void ausgeben();
        }}
      >
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="An wen?" hinweis="Name der Person oder Firma">
          {(p) => (
            <>
              <Eingabe {...p} list={listeId} value={an} onChange={(e) => setAn(e.target.value)} maxLength={100} autoComplete="off" placeholder="z. B. Max Mustermann" />
              <datalist id={listeId}>
                {namen.map((n) => (
                  <option key={n} value={n} />
                ))}
              </datalist>
            </>
          )}
        </Feld>
        <div className="space-y-2">
          <Feld beschriftung="Rückgabe bis">
            {(p) => <Eingabe {...p} type="date" value={bis} min={heute()} onChange={(e) => (setBis(e.target.value), setDauer("x"))} />}
          </Feld>
          <Chips optionen={DAUER} wert={dauer} aendern={dauerWaehlen} />
        </div>
        <Feld beschriftung="Notiz" hinweis="Optional, z. B. Baustelle oder Zweck">
          {(p) => <Textfeld {...p} rows={2} value={notiz} onChange={(e) => setNotiz(e.target.value)} maxLength={500} />}
        </Feld>
      </form>
    </Blatt>
  );
}
