import { RefreshCw } from "lucide-react";

const VERSION = typeof __APP_VERSION__ === "undefined" ? { kennung: "dev", gebaut: "" } : __APP_VERSION__;

/** Welche Fassung läuft: Commit-Kennung und Bauzeit. Antippen lädt die Seite neu, falls eine neuere da ist. */
export function Version({ className }: { className?: string }) {
  const gebaut = VERSION.gebaut ? new Date(VERSION.gebaut) : null;
  const zeit = gebaut && !Number.isNaN(gebaut.getTime()) ? new Intl.DateTimeFormat("de-DE", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(gebaut) : null;
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      title={`Fassung ${VERSION.kennung}${zeit ? `, gebaut ${zeit}` : ""} – antippen lädt die App neu`}
      className={
        "inline-flex h-8 items-center gap-1.5 rounded-full border border-rand bg-flaeche px-2.5 font-mono text-[11px] text-gedaempft hover:bg-flaeche-2 " +
        (className ?? "")
      }
    >
      <RefreshCw className="size-3.5" aria-hidden />
      <span>{VERSION.kennung}</span>
      {zeit && <span className="hidden sm:inline">· {zeit}</span>}
    </button>
  );
}
