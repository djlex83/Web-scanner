import { AlertTriangle, RotateCw } from "lucide-react";
import type { ReactNode } from "react";
import { ScanLader } from "./bewegung";
import { kl } from "./kl";

export function Kreisel({ klein, className }: { klein?: boolean; className?: string }) {
  return (
    <span
      role="status"
      aria-label="Lädt"
      className={kl(
        "inline-block animate-spin rounded-full border-current border-r-transparent",
        klein ? "size-4 border-2" : "size-7 border-[3px] text-primaer",
        className,
      )}
    />
  );
}

export function Laden({ text = "Lädt …" }: { text?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 py-16 text-gedaempft">
      <ScanLader />
      <span className="text-sm">{text}</span>
    </div>
  );
}

export function Skelett({ className }: { className?: string }) {
  return <div className={kl("animate-pulse rounded-xl bg-flaeche-2", className)} />;
}

export function SkelettListe({ zeilen = 5 }: { zeilen?: number }) {
  return (
    <div className="space-y-2">
      {Array.from({ length: zeilen }, (_, i) => (
        <Skelett key={i} className="h-[72px]" />
      ))}
    </div>
  );
}

export function Leer({
  symbol,
  titel,
  text,
  aktion,
}: {
  symbol: ReactNode;
  titel: string;
  text?: string;
  aktion?: ReactNode;
}) {
  return (
    <div className="anim-ein flex flex-col items-center px-6 py-14 text-center">
      <div className="anim-schweben mb-4 flex size-16 items-center justify-center rounded-2xl bg-primaer-weich text-primaer-text [&_svg]:size-7">
        {symbol}
      </div>
      <h2 className="text-lg font-semibold">{titel}</h2>
      {text && <p className="mt-1 max-w-sm text-[15px] text-gedaempft">{text}</p>}
      {aktion && <div className="mt-5">{aktion}</div>}
    </div>
  );
}

export function FehlerHinweis({ text, nochmal }: { text: string; nochmal?: () => void }) {
  return (
    <div
      role="alert"
      className="anim-ein flex items-start gap-3 rounded-2xl border border-gefahr/30 bg-gefahr-weich p-4 text-gefahr-text"
    >
      <AlertTriangle className="mt-0.5 size-5 shrink-0" />
      <p className="flex-1 text-[15px] font-medium">{text}</p>
      {nochmal && (
        <button onClick={nochmal} className="-my-1 flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold hover:bg-gefahr/10">
          <RotateCw className="size-4" /> Erneut
        </button>
      )}
    </div>
  );
}
