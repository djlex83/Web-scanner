// Kleine Motion Graphics: reines SVG/CSS, keine Bibliothek. Bei „Bewegung reduzieren“ ruhig.
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { kl } from "./kl";

const BALKEN = [3, 1, 2, 1, 3, 2, 1, 1, 3, 1, 2, 3, 1, 2, 1, 3];

/** Strichcode-Balken als SVG-Rechtecke (Breiten in Einheiten). */
function Balken({ x, y, hoehe, einheit }: { x: number; y: number; hoehe: number; einheit: number }) {
  let pos = x;
  return (
    <>
      {BALKEN.map((b, i) => {
        const r = i % 2 === 0 ? <rect key={i} x={pos} y={y} width={b * einheit} height={hoehe} rx={0.4} /> : null;
        pos += b * einheit + einheit;
        return r;
      })}
    </>
  );
}

/** Lade-Anzeige: Mini-Strichcode mit wanderndem Laser. */
export function ScanLader({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 56 40" role="img" aria-label="Lädt" className={kl("h-10 w-14", className)}>
      <g className="fill-current opacity-35">
        <Balken x={6} y={6} hoehe={28} einheit={1.1} />
      </g>
      <g className="anim-laser" style={{ ["--laser-weg" as string]: "26px" }}>
        <rect x={2} y={6} width={52} height={2} rx={1} fill="var(--erfolg)" />
        <rect x={2} y={4.5} width={52} height={5} rx={2.5} fill="var(--erfolg)" opacity={0.25} />
      </g>
    </svg>
  );
}

/** Erfolgs-Haken: Kreis ploppt auf, Haken zeichnet sich, Ring pulsiert nach außen. */
export function ErfolgsHaken({ className }: { className?: string }) {
  return (
    <span className={kl("relative inline-flex size-12 shrink-0", className)} aria-hidden>
      <span className="anim-ring absolute inset-0 rounded-full bg-erfolg" />
      <svg viewBox="0 0 52 52" className="relative size-full">
        <circle cx={26} cy={26} r={25} fill="var(--erfolg)" className="anim-kreis" />
        <path
          d="M15.5 27.5l7 7 14-16"
          fill="none"
          stroke="white"
          strokeWidth={4.5}
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          className="anim-zeichnen"
        />
      </svg>
    </span>
  );
}

/** Große Illustration für den leeren Scan-Bildschirm: Sucher-Ecken, Strichcode, Laser. */
export function ScanBild({ className }: { className?: string }) {
  const ecke = "fill-none stroke-primaer";
  return (
    <svg viewBox="0 0 120 84" aria-hidden className={kl("h-[84px] w-[120px]", className)}>
      <g strokeWidth={3.5} strokeLinecap="round" className={ecke}>
        <path d="M6 22V12a6 6 0 0 1 6-6h10" />
        <path d="M98 6h10a6 6 0 0 1 6 6v10" />
        <path d="M114 62v10a6 6 0 0 1-6 6H98" />
        <path d="M22 78H12a6 6 0 0 1-6-6V62" />
      </g>
      <g className="fill-current text-text opacity-80">
        <Balken x={25} y={20} hoehe={44} einheit={2.1} />
      </g>
      <g className="anim-laser" style={{ ["--laser-weg" as string]: "44px" }}>
        <rect x={14} y={19} width={92} height={2.5} rx={1.25} fill="var(--erfolg)" />
        <rect x={14} y={16.5} width={92} height={7.5} rx={3.75} fill="var(--erfolg)" opacity={0.22} />
      </g>
    </svg>
  );
}

const reduziert = () =>
  typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Zahl, die vom letzten Wert (anfangs 0) weich hochzählt. */
export function Hochzaehler({ wert, dauer = 700 }: { wert: number; dauer?: number }) {
  const [anzeige, setAnzeige] = useState(() => (reduziert() ? wert : 0));
  const zuletzt = useRef(reduziert() ? wert : 0);
  useEffect(() => {
    const von = zuletzt.current;
    if (von === wert || reduziert()) {
      zuletzt.current = wert;
      setAnzeige(wert);
      return;
    }
    let start: number | null = null;
    let rahmen = 0;
    const schritt = (t: number) => {
      start ??= t;
      const p = Math.min(1, (t - start) / dauer);
      const n = Math.round(von + (wert - von) * (1 - Math.pow(1 - p, 3)));
      setAnzeige(n);
      zuletzt.current = n;
      if (p < 1) rahmen = requestAnimationFrame(schritt);
    };
    rahmen = requestAnimationFrame(schritt);
    return () => cancelAnimationFrame(rahmen);
  }, [wert, dauer]);
  return <>{anzeige.toLocaleString("de-DE")}</>;
}

const ErfolgKontext = createContext<(text?: string) => void>(() => {});

/** Kurze Erfolgs-Blase in der Bildmitte nach einer abgeschlossenen Aktion (zusätzlich zur Meldung). */
export function ErfolgsAnbieter({ children }: { children: ReactNode }) {
  const [blase, setBlase] = useState<{ id: number; text?: string } | null>(null);
  const zeigen = useCallback((text?: string) => {
    const id = Date.now();
    setBlase({ id, text });
    setTimeout(() => setBlase((b) => (b?.id === id ? null : b)), 1200);
  }, []);
  return (
    <ErfolgKontext.Provider value={zeigen}>
      {children}
      {blase && (
        <div aria-hidden className="pointer-events-none fixed inset-0 z-[70] flex items-center justify-center">
          <div key={blase.id} className="anim-blase flex flex-col items-center gap-3 rounded-[28px] bg-flaeche/95 px-8 py-6 shadow-hoch backdrop-blur-xl">
            <ErfolgsHaken className="size-16" />
            {blase.text && <span className="max-w-56 text-center text-[15px] font-semibold">{blase.text}</span>}
          </div>
        </div>
      )}
    </ErfolgKontext.Provider>
  );
}

export const useErfolg = () => useContext(ErfolgKontext);
