import { ArrowRight, Box, CircleHelp, MapPin, Plus, Warehouse, X } from "lucide-react";
import { Link } from "react-router";
import { vorWann } from "../lib/format";
import { Abzeichen, StatusAbzeichen } from "../ui/abzeichen";
import { kl } from "../ui/kl";
import { Skelett } from "../ui/zustand";
import type { Eintrag } from "./useScanListe";

interface Props {
  eintrag: Eintrag;
  /** Zielplatz im Einlagern-Modus */
  zielId?: number | null;
  zielName?: string;
  erfassen?: (code: string) => void;
  entfernen?: (code: string) => void;
  neuErfasst?: boolean;
}

export function TrefferKarte({ eintrag, zielId, zielName, erfassen, entfernen, neuErfasst }: Props) {
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
  const schonDa = zielId != null && s.platz?.id === zielId;
  return (
    <div className={kl(rahmen, neuErfasst ? "border-erfolg/50" : "border-rand")}>
      <Link to={`/stuecke/${s.id}`} className="flex min-w-0 flex-1 items-start gap-3">
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-gedaempft">
          <Box className="size-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-[15px] font-semibold">{s.name}</span>
            {s.status !== "vorhanden" && <StatusAbzeichen status={s.status} />}
          </div>
          <div className="truncate font-mono text-[12px] text-gedaempft">{s.code}</div>

          {zielId == null ? (
            <div className="mt-2 flex items-start gap-1.5">
              <MapPin className={kl("mt-0.5 size-4 shrink-0", s.platz ? "text-primaer-text" : "text-warnung-text")} />
              <div className="min-w-0">
                <div className={kl("text-[15px] font-bold leading-snug", !s.platz && "text-warnung-text")}>
                  {s.platz?.pfad ?? "Kein Platz zugeordnet"}
                </div>
                {s.bewegt_am && (
                  <div className="text-[12px] text-gedaempft">
                    {vorWann(s.bewegt_am)}
                    {s.bewegt_von && ` · ${s.bewegt_von}`}
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
              {neuErfasst ? (
                <Abzeichen ton="erfolg">Neu erfasst</Abzeichen>
              ) : schonDa ? (
                <Abzeichen ton="neutral">Liegt schon hier</Abzeichen>
              ) : (
                <>
                  <span className="max-w-[45%] truncate text-gedaempft">{s.platz?.pfad ?? "ohne Platz"}</span>
                  <ArrowRight className="size-3.5 shrink-0 text-primaer-text" />
                  <span className="truncate font-semibold text-primaer-text">{zielName}</span>
                </>
              )}
            </div>
          )}
        </div>
      </Link>
      {weg}
    </div>
  );
}
