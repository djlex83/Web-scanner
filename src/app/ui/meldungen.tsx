import { CheckCircle2, Info, XCircle } from "lucide-react";
import { createContext, useCallback, useContext, useState, type ReactNode } from "react";
import { kl } from "./kl";

type Art = "erfolg" | "fehler" | "info";
interface Meldung {
  id: number;
  art: Art;
  text: string;
}

const Kontext = createContext<(text: string, art?: Art) => void>(() => {});

/** Kurze Rückmeldungen ("Toast") unten über der Navigation. */
export function MeldungenAnbieter({ children }: { children: ReactNode }) {
  const [liste, setListe] = useState<Meldung[]>([]);
  const zeigen = useCallback((text: string, art: Art = "erfolg") => {
    const id = Date.now() + Math.random();
    setListe((l) => [...l.slice(-2), { id, art, text }]);
    setTimeout(() => setListe((l) => l.filter((m) => m.id !== id)), art === "fehler" ? 6000 : 3500);
  }, []);

  return (
    <Kontext.Provider value={zeigen}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-[calc(12px+env(safe-area-inset-top))] z-[60] flex flex-col items-center gap-2 px-4 lg:top-auto lg:bottom-6"
      >
        {liste.map((m) => (
          <div
            key={m.id}
            role={m.art === "fehler" ? "alert" : "status"}
            className={kl(
              "anim-plopp pointer-events-auto flex max-w-md items-center gap-3 rounded-2xl px-4 py-3 text-[15px] font-medium shadow-hoch",
              "bg-text text-hg",
            )}
          >
            {m.art === "erfolg" && <CheckCircle2 className="size-5 shrink-0 text-erfolg" />}
            {m.art === "fehler" && <XCircle className="size-5 shrink-0 text-gefahr" />}
            {m.art === "info" && <Info className="size-5 shrink-0 text-primaer" />}
            {m.text}
          </div>
        ))}
      </div>
    </Kontext.Provider>
  );
}

export const useMeldung = () => useContext(Kontext);
