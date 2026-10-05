import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { darf as darfRolle, type Recht, type Rolle } from "../../gemeinsam/rechte";
import { beiSitzungsende, holen, senden } from "./api";

export interface Ich {
  id: number;
  benutzername: string;
  name: string;
  rolle: Rolle;
  passwort_aendern: boolean;
}

interface SitzungsKontext {
  ich: Ich | null;
  bereit: boolean;
  einrichtungNoetig: boolean;
  neuLaden: () => Promise<void>;
  abmelden: () => Promise<void>;
  darf: (recht: Recht) => boolean;
}

const Kontext = createContext<SitzungsKontext | null>(null);

export function SitzungsAnbieter({ children }: { children: ReactNode }) {
  const [ich, setIch] = useState<Ich | null>(null);
  const [bereit, setBereit] = useState(false);
  const [einrichtungNoetig, setEinrichtungNoetig] = useState(false);

  const neuLaden = useCallback(async () => {
    try {
      const { benutzer } = await holen<{ benutzer: Ich | null }>("/auth/ich");
      setIch(benutzer);
      if (!benutzer) {
        const { noetig } = await holen<{ noetig: boolean }>("/auth/einrichten");
        setEinrichtungNoetig(noetig);
      } else {
        setEinrichtungNoetig(false);
      }
    } catch {
      setIch(null);
    } finally {
      setBereit(true);
    }
  }, []);

  const abmelden = useCallback(async () => {
    try {
      await senden("/auth/abmelden", {});
    } finally {
      setIch(null);
    }
  }, []);

  useEffect(() => {
    void neuLaden();
    beiSitzungsende(() => setIch(null));
  }, [neuLaden]);

  const darf = useCallback((recht: Recht) => darfRolle(ich?.rolle, recht), [ich]);

  return (
    <Kontext.Provider value={{ ich, bereit, einrichtungNoetig, neuLaden, abmelden, darf }}>
      {children}
    </Kontext.Provider>
  );
}

export function useSitzung(): SitzungsKontext {
  const k = useContext(Kontext);
  if (!k) throw new Error("SitzungsAnbieter fehlt");
  return k;
}

/** Nur für angemeldete Benutzer: gibt den aktuellen Benutzer zurück. */
export function useIch(): Ich {
  const { ich } = useSitzung();
  if (!ich) throw new Error("nicht angemeldet");
  return ich;
}
