import { Box, Warehouse } from "lucide-react";
import { zielPfad, type Ziel } from "../lib/ziel";

/** Ziel im Einlagern-Modus: Regal-Etikett oder Behälter scannen, oder aus der Liste wählen. */
export function ZielKarte({ ziel, waehlen }: { ziel: Ziel | null; waehlen: () => void }) {
  if (!ziel) {
    return (
      <button
        onClick={waehlen}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primaer/40 bg-primaer-weich/40 p-4 text-left transition hover:bg-primaer-weich active:scale-[0.99]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primaer text-auf-primaer">
          <Warehouse className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold">Ziel: Regal oder Behälter scannen</span>
          <span className="block text-[13px] text-gedaempft">oder hier antippen und ein Regal aus der Liste wählen</span>
        </span>
      </button>
    );
  }
  return (
    <div className="anim-plopp flex items-center gap-4 rounded-2xl bg-primaer p-4 text-auf-primaer shadow-hoch">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
        {ziel.art === "behaelter" ? <Box className="size-6" /> : <Warehouse className="size-6" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium opacity-80">
          {ziel.art === "behaelter" ? "In den Behälter legen" : "Einlagern nach"}
        </span>
        <span className="block truncate text-lg font-bold">{ziel.art === "behaelter" ? ziel.stueck.name : zielPfad(ziel)}</span>
        {ziel.art === "behaelter" && ziel.stueck.platz && (
          <span className="block truncate text-[13px] opacity-80">{ziel.stueck.platz.pfad}</span>
        )}
      </span>
      <button onClick={waehlen} className="h-11 rounded-xl bg-white/20 px-4 text-sm font-semibold transition hover:bg-white/30 active:scale-95">
        Ändern
      </button>
    </div>
  );
}
