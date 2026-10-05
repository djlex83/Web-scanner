import { ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";
import { useNavigate } from "react-router";
import { SymbolKnopf } from "./knopf";

/** Seitenüberschrift mit optionalem Zurück-Knopf und Aktionen rechts. */
export function SeitenKopf({
  titel,
  unter,
  zurueck,
  aktionen,
}: {
  titel: ReactNode;
  unter?: ReactNode;
  zurueck?: boolean;
  aktionen?: ReactNode;
}) {
  const navigate = useNavigate();
  return (
    <header className="flex items-start gap-2 pb-5 pt-2">
      {zurueck && (
        <SymbolKnopf beschriftung="Zurück" onClick={() => navigate(-1)} className="-ml-3">
          <ArrowLeft className="size-6" />
        </SymbolKnopf>
      )}
      <div className="min-w-0 flex-1 pt-1.5">
        <h1 className="text-[28px] font-bold leading-tight tracking-tight sm:text-3xl">{titel}</h1>
        {unter && <div className="mt-1 text-[15px] text-gedaempft">{unter}</div>}
      </div>
      {aktionen && <div className="flex shrink-0 items-center gap-2 pt-1">{aktionen}</div>}
    </header>
  );
}
