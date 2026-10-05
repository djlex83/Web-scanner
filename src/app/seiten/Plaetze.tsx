import { ChevronRight, Plus, Printer, Warehouse } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router";
import type { Platz, PlatzTyp } from "../../gemeinsam/typen";
import { PlatzAnlegen } from "../komponenten/PlatzAnlegen";
import { natuerlich } from "../komponenten/PlatzWahl";
import { anzahl } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Karte } from "../ui/karte";
import { Knopf, KnopfLink } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, Skelett } from "../ui/zustand";

export default function Plaetze() {
  const { darf } = useSitzung();
  const melden = useMeldung();
  const { daten, fehler, neuLaden } = useLaden<Platz[]>("/plaetze");
  const [anlegen, setAnlegen] = useState<{ typ: PlatzTyp; eltern?: Platz } | null>(null);
  const verwalten = darf("plaetze_verwalten");

  const abteilungen = useMemo(() => {
    const alle = daten ?? [];
    return alle
      .filter((p) => p.typ === "abteilung")
      .sort((a, b) => natuerlich(a.name, b.name))
      .map((a) => {
        const regale = alle.filter((p) => p.eltern_id === a.id).sort((x, y) => natuerlich(x.name, y.name));
        const regalIds = new Set(regale.map((r) => r.id));
        const faecher = alle.filter((p) => p.eltern_id != null && regalIds.has(p.eltern_id));
        const gesamt = a.anzahl + regale.reduce((s, r) => s + r.anzahl, 0) + faecher.reduce((s, f) => s + f.anzahl, 0);
        return { abteilung: a, regale, faecher, gesamt };
      });
  }, [daten]);

  return (
    <div className="space-y-5">
      <SeitenKopf
        titel="Plätze"
        unter="Abteilungen und Regale"
        aktionen={
          verwalten && (
            <Knopf art="primaer" symbol={<Plus className="size-5" />} onClick={() => setAnlegen({ typ: "abteilung" })}>
              <span className="sr-only sm:not-sr-only">Abteilung</span>
            </Knopf>
          )
        }
      />
      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
      {!daten && !fehler && (
        <div className="grid gap-4 md:grid-cols-2">
          <Skelett className="h-56 rounded-karte" />
          <Skelett className="h-56 rounded-karte" />
        </div>
      )}
      {daten && abteilungen.length === 0 && (
        <Leer
          symbol={<Warehouse />}
          titel="Noch keine Plätze"
          text={verwalten ? "Lege zuerst eine Abteilung an, dann die Regale darin." : "Die Leitung legt Abteilungen und Regale an."}
          aktion={
            verwalten && (
              <Knopf art="primaer" symbol={<Plus className="size-5" />} onClick={() => setAnlegen({ typ: "abteilung" })}>
                Erste Abteilung anlegen
              </Knopf>
            )
          }
        />
      )}

      <div className="grid items-start gap-4 md:grid-cols-2">
        {abteilungen.map(({ abteilung: a, regale, gesamt }) => (
          <Karte key={a.id} className="anim-ein overflow-hidden">
            <Link to={`/plaetze/${a.id}`} className="flex items-center gap-4 p-5 transition hover:bg-flaeche-2">
              <div className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-primaer-weich text-primaer-text">
                <Warehouse className="size-6" />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="truncate text-lg font-bold">{a.name}</h2>
                <p className="text-[13px] text-gedaempft">
                  {anzahl(regale.length, "Regal", "Regale")} · {anzahl(gesamt, "Stück", "Stücke")}
                </p>
              </div>
              <ChevronRight className="size-5 text-gedaempft" />
            </Link>
            {regale.length > 0 && (
              <div className="flex flex-wrap gap-2 border-t border-rand p-4">
                {regale.map((r) => (
                  <Link
                    key={r.id}
                    to={`/plaetze/${r.id}`}
                    className="flex h-11 items-center gap-2 rounded-xl border border-rand bg-flaeche-2/60 px-3.5 text-sm font-semibold transition hover:border-primaer/40 hover:bg-primaer-weich active:scale-95"
                  >
                    {r.name}
                    <span className="zahlen rounded-md bg-flaeche px-1.5 text-xs text-gedaempft">{r.anzahl}</span>
                  </Link>
                ))}
              </div>
            )}
            {verwalten && (
              <div className="flex gap-2 border-t border-rand p-3">
                <Knopf art="leise" className="flex-1" symbol={<Plus className="size-5" />} onClick={() => setAnlegen({ typ: "regal", eltern: a })}>
                  Regale
                </Knopf>
                {regale.length > 0 && (
                  <KnopfLink
                    art="leise"
                    className="flex-1"
                    to={`/etiketten?ids=${regale.map((r) => r.id).join(",")}`}
                    symbol={<Printer className="size-5" />}
                  >
                    Etiketten
                  </KnopfLink>
                )}
              </div>
            )}
          </Karte>
        ))}
      </div>

      <PlatzAnlegen
        typ={anlegen?.typ ?? null}
        eltern={anlegen?.eltern}
        schliessen={() => setAnlegen(null)}
        fertig={(n) => {
          setAnlegen(null);
          melden(n === 1 ? "Angelegt" : `${n} angelegt`);
          void neuLaden();
        }}
      />
    </div>
  );
}
