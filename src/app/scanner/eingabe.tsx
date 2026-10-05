import { CornerDownLeft, Keyboard } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { normalisiereCode } from "../../gemeinsam/codes";

/**
 * Handscanner (USB/Bluetooth im Tastaturmodus): tippen sehr schnell und schließen mit Enter ab.
 * Wird nur ausgewertet, wenn kein Eingabefeld den Fokus hat.
 */
export function useHandscanner(beiCode: (code: string) => void) {
  const rueckruf = useRef(beiCode);
  rueckruf.current = beiCode;
  useEffect(() => {
    let puffer = "";
    let letzte = 0;
    const taste = (e: KeyboardEvent) => {
      const ziel = e.target as HTMLElement | null;
      if (ziel && (ziel.tagName === "INPUT" || ziel.tagName === "TEXTAREA" || ziel.isContentEditable)) return;
      const nun = performance.now();
      if (nun - letzte > 80) puffer = ""; // zu langsam für einen Scanner → neu beginnen
      letzte = nun;
      if (e.key === "Enter" || e.key === "Tab") {
        const code = normalisiereCode(puffer);
        puffer = "";
        if (code.length >= 3) {
          e.preventDefault();
          rueckruf.current(code);
        }
      } else if (e.key.length === 1) {
        puffer += e.key;
      }
    };
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, []);
}

/** Code von Hand eintippen. */
export function ManuelleEingabe({ beiCode }: { beiCode: (code: string) => void }) {
  const [wert, setWert] = useState("");
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const code = normalisiereCode(wert);
        if (code) beiCode(code);
        setWert("");
      }}
      className="flex items-center gap-2 rounded-2xl border border-rand-stark bg-flaeche p-1.5 pl-4 shadow-karte focus-within:border-primaer focus-within:ring-4 focus-within:ring-primaer/15"
    >
      <Keyboard className="size-5 shrink-0 text-gedaempft" aria-hidden />
      <input
        value={wert}
        onChange={(e) => setWert(e.target.value)}
        placeholder="Code eintippen oder Handscanner nutzen"
        aria-label="Code eintippen"
        enterKeyHint="go"
        autoCapitalize="characters"
        autoCorrect="off"
        spellCheck={false}
        className="h-11 min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-gedaempft/70"
      />
      <button
        type="submit"
        disabled={!wert.trim()}
        aria-label="Code übernehmen"
        className="flex h-11 items-center gap-1.5 rounded-xl bg-primaer px-4 text-sm font-semibold text-auf-primaer transition active:scale-95 disabled:opacity-40"
      >
        <CornerDownLeft className="size-4" />
      </button>
    </form>
  );
}
