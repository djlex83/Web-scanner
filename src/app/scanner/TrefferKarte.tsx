import { ArrowRight, Box, CircleHelp, MapPin, Plus, SearchCheck, Warehouse, X } from "lucide-react";
import { Link } from "react-router";
import type { Stueck } from "../../gemeinsam/typen";
import { StueckBild } from "../komponenten/kategorie";
import { datumText, StueckMerkmale } from "../komponenten/StueckMerkmale";
import { vorWann } from "../lib/format";
import { nichtMoeglich, schonDort, zielName, type Ziel } from "../lib/ziel";
import { Abzeichen } from "../ui/abzeichen";
import { kl } from "../ui/kl";
import { Skelett } from "../ui/zustand";
import type { Eintrag } from "./useScanListe";

interface Props {
  eintrag: Eintrag;
  /** Darstellung je Modus: wo liegt es / wohin kommt es / verliehen oder frei */
  modus?: "suchen" | "einlagern" | "ausleihe";
  /** Ziel im Einlagern-Modus (null = noch keins) */
  ziel?: Ziel | null;
  erfassen?: (code: string) => void;
  entfernen?: (code: string) => void;
  /** Vermisstes Stück als gefunden melden */
  gefunden?: (s: Stueck) => void;
  neuErfasst?: boolean;
}

export function TrefferKarte({ eintrag, modus = "suchen", ziel = null, erfassen, entfernen, gefunden, neuErfasst }: Props) {
  const t = eintrag.treffer;
  const rahmen = "anim-ein relative flex items-start gap-3 rounded-2xl border bg-flaeche p-3.5 pr-2 shadow-karte";

  const weg = entfernen && (
    <button
      type="button"
      onClick={() => entfernen(eintrag.code)}
      aria-label={`${eintrag.code} aus der Liste entfernen`}
      className="-my-1 flex size-11 shrink-0 items-center justify-center rounded-full text-gedaempft transition hover:bg-flaeche-2 active:scale-95"
    >
      <X className="size-5" />
    </button>
  );

  if (!t) {
    return (
      <div className={kl(rahmen, "border-rand")}>
        <Skelett className="size-11 shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <div className="font-mono text-sm text-gedaempft">{eintrag.code}</div>
          {eintrag.fehler ? (
            <div className="text-sm font-medium text-gefahr-text">{eintrag.fehler}</div>
          ) : (
            <Skelett className="h-4 w-2/3" />
          )}
        </div>
        {weg}
      </div>
    );
  }

  if (t.art === "unbekannt") {
    return (
      <div className={kl(rahmen, "border-warnung/50")}>
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-warnung-weich text-warnung-text">
          <CircleHelp className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">Unbekannter Code</div>
          <div className="truncate font-mono text-[13px] text-gedaempft">{t.code}</div>
          {erfassen && (
            <button
              type="button"
              onClick={() => erfassen(t.code)}
              className="mt-2.5 inline-flex h-10 items-center gap-1.5 rounded-xl bg-primaer px-3.5 text-sm font-semibold text-auf-primaer transition active:scale-95"
            >
              <Plus className="size-4" /> Neu erfassen
            </button>
          )}
        </div>
        {weg}
      </div>
    );
  }

  if (t.art === "platz") {
    const p = t.platz;
    return (
      <div className={kl(rahmen, "border-rand")}>
        <Link to={`/plaetze/${p.id}`} className="flex min-w-0 flex-1 items-start gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primaer-weich text-primaer-text">
            <Warehouse className="size-5" />
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{p.pfad}</div>
            <div className="text-[13px] text-gedaempft">
              Platz · {p.anzahl} {p.anzahl === 1 ? "Stück" : "Stücke"} – antippen für Inhalt
            </div>
          </div>
        </Link>
        {weg}
      </div>
    );
  }

  const s = t.stueck;
  const sperre = ziel ? nichtMoeglich(ziel, s) : null;
  const da = ziel ? schonDort(ziel, s) : false;
  return (
    <div className={kl(rahmen, s.vermisst_seit ? "border-gefahr/50" : neuErfasst ? "border-erfolg/50" : "border-rand")}>
      <div className="flex min-w-0 flex-1 flex-col gap-2.5">
        <Link to={`/stuecke/${s.id}`} className="flex min-w-0 items-start gap-3">
          <StueckBild stueck={s} className="size-14 rounded-xl" />
          <div className="min-w-0 flex-1">
            <div className="truncate text-[15px] font-semibold">{s.name}</div>
            <div className="truncate font-mono text-[12px] text-gedaempft">{s.code}</div>
            <StueckMerkmale stueck={s} max={3} mitBehaelter={modus !== "suchen"} className="mt-1.5" />

            {modus === "suchen" && (
              <div className="mt-2 flex items-start gap-1.5">
                <MapPin className={kl("mt-0.5 size-4 shrink-0", s.platz ? "text-primaer-text" : "text-warnung-text")} />
                <div className="min-w-0">
                  <div className={kl("text-[15px] font-bold leading-snug", !s.platz && "text-warnung-text")}>
                    {s.platz?.pfad ?? "Kein Platz zugeordnet"}
                  </div>
                  {s.in_behaelter && (
                    <div className="flex items-center gap-1 text-[13px] font-semibold text-primaer-text">
                      <Box className="size-3.5" /> im Behälter „{s.in_behaelter.name}“
                    </div>
                  )}
                  {s.behaelter && (
                    <div className="text-[13px] font-semibold text-primaer-text">
                      Behälter mit {s.inhalt} {s.inhalt === 1 ? "Stück" : "Stücken"}
                    </div>
                  )}
                  {s.bewegt_am && (
                    <div className="text-[12px] text-gedaempft">
                      {vorWann(s.bewegt_am)}
                      {s.bewegt_von && ` · ${s.bewegt_von}`}
                    </div>
                  )}
                </div>
              </div>
            )}

            {modus === "einlagern" && (
              <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
                {neuErfasst ? (
                  <Abzeichen ton="erfolg">Neu erfasst</Abzeichen>
                ) : sperre ? (
                  <Abzeichen ton="warnung">{sperre}</Abzeichen>
                ) : da ? (
                  <Abzeichen ton="neutral">Liegt schon hier</Abzeichen>
                ) : (
                  <>
                    <span className="max-w-[45%] truncate text-gedaempft">
                      {s.in_behaelter ? s.in_behaelter.name : (s.platz?.pfad ?? "ohne Platz")}
                    </span>
                    <ArrowRight className="size-3.5 shrink-0 text-primaer-text" />
                    <span className="truncate font-semibold text-primaer-text">{ziel ? zielName(ziel) : "Ziel wählen"}</span>
                  </>
                )}
              </div>
            )}

            {modus === "ausleihe" && (
              <div className="mt-2 text-[13px]">
                {s.ausleihe ? (
                  <span className="font-semibold text-warnung-text">
                    Bei {s.ausleihe.an}
                    {s.ausleihe.bis && ` bis ${datumText(s.ausleihe.bis)}`} – wird zurückgenommen
                  </span>
                ) : s.status === "ausgemustert" ? (
                  <span className="text-gedaempft">Ausgemustert – kann nicht verliehen werden</span>
                ) : (
                  <span className="font-semibold text-erfolg-text">Verfügbar – wird ausgegeben</span>
                )}
              </div>
            )}
          </div>
        </Link>
        {s.vermisst_seit && modus === "suchen" && (
          <div className="flex items-center gap-3 rounded-xl bg-gefahr-weich px-3 py-2 text-gefahr-text">
            <span className="min-w-0 flex-1 text-[13px] font-semibold">Wird vermisst – gefunden?</span>
            {gefunden && (
              <button
                type="button"
                onClick={() => gefunden(s)}
                className="inline-flex h-10 shrink-0 items-center gap-1.5 rounded-lg bg-flaeche px-3 text-sm font-semibold text-text shadow-karte active:scale-95"
              >
                <SearchCheck className="size-4" /> Gefunden
              </button>
            )}
          </div>
        )}
      </div>
      {weg}
    </div>
  );
}
