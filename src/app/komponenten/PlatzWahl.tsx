import { Check, CheckCircle2, CircleAlert, Search, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { GEZAEHLT_TAGE, gezaehltePlaetze } from "../../gemeinsam/inventur";
import { PLATZ_TYP_NAME, type InventurEintrag, type Platz } from "../../gemeinsam/typen";
import { vorWann } from "../lib/format";
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
  inventurStand = false,
}: {
  offen: boolean;
  schliessen: () => void;
  waehlen: (p: Platz) => void;
  aktuell?: number | null;
  titel?: string;
  /** nur Regale und Fächer anbieten */
  nurLagerplaetze?: boolean;
  /** gezählte Plätze farbig zeigen (grün = vollständig, orange = Lücken) – für die Inventur */
  inventurStand?: boolean;
}) {
  const { daten, fehler, laedt, neuLaden } = useLaden<Platz[]>(offen ? "/plaetze" : null);
  const { daten: inventuren } = useLaden<InventurEintrag[]>(offen && inventurStand ? "/inventur/stand" : null);
  const [suche, setSuche] = useState("");
  const baum = useMemo(() => alsBaum(daten ?? []), [daten]);
  const gezaehlt = useMemo(() => gezaehltePlaetze(daten ?? [], inventuren ?? []), [daten, inventuren]);
  const anzahlGezaehlt = baum.filter((p) => p.typ !== "abteilung" && gezaehlt.has(p.id)).length;
  const anzahlLager = baum.filter((p) => p.typ !== "abteilung").length;
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
      {inventurStand && daten && anzahlLager > 0 && (
        <p className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-[13px] text-gedaempft">
          <span className="font-semibold text-text">
            {anzahlGezaehlt} von {anzahlLager} gezählt
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-full bg-erfolg" /> vollständig
          </span>
          <span className="flex items-center gap-1">
            <span aria-hidden className="size-2.5 rounded-full bg-warnung" /> mit Lücken
          </span>
          <span>· letzte {GEZAEHLT_TAGE} Tage</span>
        </p>
      )}
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
          const g = inventurStand ? gezaehlt.get(p.id) : undefined;
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
                  waehlbar ? "hover:brightness-95 active:brightness-95" : "cursor-default opacity-70",
                  waehlbar && !g && "hover:bg-flaeche-2 active:bg-flaeche-2",
                  g?.stand === "vollstaendig" && "bg-erfolg-weich",
                  g?.stand === "luecken" && "bg-warnung-weich",
                  gewaehlt && "bg-primaer-weich",
                )}
              >
                <Warehouse
                  className={kl(
                    "size-5 shrink-0",
                    g?.stand === "vollstaendig" ? "text-erfolg-text" : g?.stand === "luecken" ? "text-warnung-text" : p.typ === "abteilung" ? "text-primaer-text" : "text-gedaempft",
                  )}
                />
                <span className="min-w-0 flex-1">
                  <span className={kl("block truncate text-[15px]", p.typ === "abteilung" ? "font-bold" : "font-semibold")}>
                    {suche ? p.pfad : p.name}
                  </span>
                  <span className="block text-[13px] text-gedaempft">
                    {PLATZ_TYP_NAME[p.typ]} · {p.anzahl} {p.anzahl === 1 ? "Stück" : "Stücke"}
                    {g && (
                      <span className={g.stand === "vollstaendig" ? "text-erfolg-text" : "text-warnung-text"}>
                        {" · gezählt "}
                        {vorWann(g.eintrag.zeitpunkt)}
                        {g.ueber && ` (mit ${g.ueber})`}
                        {g.stand === "luecken" && ` · ${[g.eintrag.fehlend && `${g.eintrag.fehlend} fehlen`, g.eintrag.zusaetzlich && `${g.eintrag.zusaetzlich} zusätzlich`].filter(Boolean).join(", ")}`}
                      </span>
                    )}
                  </span>
                </span>
                {gewaehlt ? (
                  <Check className="size-5 text-primaer-text" />
                ) : g?.stand === "vollstaendig" ? (
                  <CheckCircle2 className="size-5 shrink-0 text-erfolg-text" aria-label="gezählt, vollständig" />
                ) : g?.stand === "luecken" ? (
                  <CircleAlert className="size-5 shrink-0 text-warnung-text" aria-label="gezählt, mit Lücken" />
                ) : null}
              </button>
            </li>
          );
        })}
      </ul>
    </Blatt>
  );
}
