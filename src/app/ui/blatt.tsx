import { X } from "lucide-react";
import { useEffect, useId, useRef, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { SymbolKnopf } from "./knopf";

/**
 * Blatt: auf dem Handy von unten hochgleitend, ab Tablet als zentrierter Dialog.
 * Escape und Tippen auf den Hintergrund schließen; Fokus bleibt im Blatt.
 */
export function Blatt({
  offen,
  schliessen,
  titel,
  children,
  fuss,
}: {
  offen: boolean;
  schliessen: () => void;
  titel: string;
  children: ReactNode;
  fuss?: ReactNode;
}) {
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!offen) return;
    const vorher = document.activeElement as HTMLElement | null;
    const t = setTimeout(() => {
      const erstes = ref.current?.querySelector<HTMLElement>("input, select, textarea, [data-autofocus]");
      (erstes ?? ref.current)?.focus();
    }, 60);
    const taste = (e: KeyboardEvent) => {
      if (e.key === "Escape") schliessen();
      if (e.key === "Tab" && ref.current) {
        const f = ref.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])',
        );
        const erstes = f[0];
        const letztes = f[f.length - 1];
        if (e.shiftKey && document.activeElement === erstes) (e.preventDefault(), letztes?.focus());
        else if (!e.shiftKey && document.activeElement === letztes) (e.preventDefault(), erstes?.focus());
      }
    };
    document.addEventListener("keydown", taste);
    const ueberlauf = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = ueberlauf;
      vorher?.focus?.();
    };
  }, [offen, schliessen]);

  if (!offen) return null;
  return createPortal(
    <div className="fixed inset-0 z-50 flex items-end justify-center sm:items-center sm:p-6">
      <div className="anim-ein absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={schliessen} aria-hidden />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={id}
        tabIndex={-1}
        className="anim-hoch sm:anim-plopp relative flex max-h-[92dvh] w-full flex-col rounded-t-[28px] bg-flaeche shadow-hoch outline-none sm:max-w-lg sm:rounded-[28px]"
      >
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-rand sm:hidden" aria-hidden />
        <div className="flex items-center gap-3 px-5 pb-2 pt-3 sm:pt-5">
          <h2 id={id} className="flex-1 text-xl font-bold tracking-tight">
            {titel}
          </h2>
          <SymbolKnopf beschriftung="Schließen" onClick={schliessen} className="-mr-2">
            <X className="size-5" />
          </SymbolKnopf>
        </div>
        <div className="overflow-y-auto px-5 pb-5">{children}</div>
        {fuss && <div className="sicher-unten border-t border-rand px-5 py-4">{fuss}</div>}
      </div>
    </div>,
    document.body,
  );
}
