import { Check, Search, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { PLATZ_TYP_NAME, type Platz } from "../../gemeinsam/typen";
import { useLaden } from "../lib/hooks";
import { Blatt } from "../ui/blatt";
import { Eingabe } from "../ui/formular";
import { kl } from "../ui/kl";
import { FehlerHinweis, SkelettListe } from "../ui/zustand";

export const natuerlich = (a: string, b: string) => a.localeCompare(b, "de", { numeric: true, sensitivity: "base" });

/** Plätze als Baum sortiert: Abteilung, darunter Regale, darunter Fächer. */
export function alsBaum(plaetze: Platz[]): (Platz & { tiefe: number })[] {
  const kinder = new Map<number | null, Platz[]>();
  for (const p of plaetze) {
    const k = p.eltern_id ?? null;
    kinder.set(k, [...(kinder.get(k) ?? []), p]);
  }
  const ergebnis: (Platz & { tiefe: number })[] = [];
  const besuchen = (eltern: number | null, tiefe: number) => {
    for (const p of (kinder.get(eltern) ?? []).sort((a, b) => natuerlich(a.name, b.name))) {
      ergebnis.push({ ...p, tiefe });
      besuchen(p.id, tiefe + 1);
    }
  };
  besuchen(null, 0);
  return ergebnis;
}

/** Auswahl eines Platzes aus der Liste (wenn kein Etikett zur Hand ist). */
export function PlatzWahl({
  offen,
  schliessen,
  waehlen,
  aktuell,
  titel = "Platz wählen",
  nurLagerplaetze = false,
}: {
  offen: boolean;
  schliessen: () => void;
  waehlen: (p: Platz) => void;
  aktuell?: number | null;
  titel?: string;
  /** nur Regale und Fächer anbieten */
  nurLagerplaetze?: boolean;
}) {
  const { daten, fehler, laedt, neuLaden } = useLaden<Platz[]>(offen ? "/plaetze" : null);
  const [suche, setSuche] = useState("");
  const baum = useMemo(() => alsBaum(daten ?? []), [daten]);
  const gefiltert = suche.trim()
    ? baum.filter((p) => p.pfad.toLowerCase().includes(suche.trim().toLowerCase()))
    : baum;

  return (
    <Blatt offen={offen} schliessen={schliessen} titel={titel}>
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 size-5 -translate-y-1/2 text-gedaempft" />
        <Eingabe
          value={suche}
          onChange={(e) => setSuche(e.target.value)}
          placeholder="Abteilung oder Regal suchen"
          aria-label="Platz suchen"
          className="pl-12"
        />
      </div>
      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
      {laedt && !daten && <SkelettListe zeilen={4} />}
      {daten && gefiltert.length === 0 && (
        <p className="py-8 text-center text-gedaempft">
          {daten.length ? "Nichts gefunden." : "Noch keine Plätze angelegt. Plätze legt die Leitung unter „Plätze“ an."}
        </p>
      )}
      <ul className="space-y-1">
        {gefiltert.map((p) => {
          const waehlbar = !nurLagerplaetze || p.typ !== "abteilung";
          const gewaehlt = p.id === aktuell;
          return (
            <li key={p.id}>
              <button
                type="button"
                disabled={!waehlbar}
                onClick={() => {
                  waehlen(p);
                  schliessen();
                }}
                style={{ paddingLeft: 12 + (suche ? 0 : p.tiefe * 20) }}
                className={kl(
                  "flex min-h-14 w-full items-center gap-3 rounded-xl pr-3 text-left transition",
                  waehlbar ? "hover:bg-flaeche-2 active:bg-flaeche-2" : "cursor-default opacity-70",
                  gewaehlt && "bg-primaer-weich",
                )}
              >
                <Warehouse className={kl("size-5 shrink-0", p.typ === "abteilung" ? "text-primaer-text" : "text-gedaempft")} />
                <span className="min-w-0 flex-1">
                  <span className={kl("block truncate text-[15px]", p.typ === "abteilung" ? "font-bold" : "font-semibold")}>
                    {suche ? p.pfad : p.name}
                  </span>
                  <span className="block text-[13px] text-gedaempft">
                    {PLATZ_TYP_NAME[p.typ]} · {p.anzahl} {p.anzahl === 1 ? "Stück" : "Stücke"}
                  </span>
                </span>
                {gewaehlt && <Check className="size-5 text-primaer-text" />}
              </button>
            </li>
          );
        })}
      </ul>
    </Blatt>
  );
}
