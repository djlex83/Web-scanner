import { useCallback, useEffect, useRef, useState } from "react";
import { fehlerText, holen } from "./api";

/** Lädt Daten von der API, mit Lade- und Fehlerzustand und Neu-Laden. */
export function useLaden<T>(pfad: string | null) {
  const [daten, setDaten] = useState<T | null>(null);
  const [fehler, setFehler] = useState<string | null>(null);
  const [laedt, setLaedt] = useState(pfad !== null);
  const zaehler = useRef(0);

  const laden = useCallback(async () => {
    if (pfad === null) return;
    const nr = ++zaehler.current;
    setLaedt(true);
    setFehler(null);
    try {
      const d = await holen<T>(pfad);
      if (nr === zaehler.current) setDaten(d);
    } catch (e) {
      if (nr === zaehler.current) setFehler(fehlerText(e));
    } finally {
      if (nr === zaehler.current) setLaedt(false);
    }
  }, [pfad]);

  useEffect(() => {
    void laden();
  }, [laden]);

  return { daten, setDaten, fehler, laedt, neuLaden: laden };
}

/** Verzögerter Wert, z. B. für Suchfelder. */
export function useVerzoegert<T>(wert: T, ms = 250): T {
  const [v, setV] = useState(wert);
  useEffect(() => {
    const t = setTimeout(() => setV(wert), ms);
    return () => clearTimeout(t);
  }, [wert, ms]);
  return v;
}

/** Wert im Browser speichern (nur Komfort, z. B. Einstellungen). */
export function useGespeichert<T>(schluessel: string, start: T) {
  const [wert, setWert] = useState<T>(() => {
    try {
      const s = localStorage.getItem(schluessel);
      return s === null ? start : (JSON.parse(s) as T);
    } catch {
      return start;
    }
  });
  const setzen = useCallback(
    (v: T) => {
      setWert(v);
      try {
        localStorage.setItem(schluessel, JSON.stringify(v));
      } catch {
        /* privater Modus – egal */
      }
    },
    [schluessel],
  );
  return [wert, setzen] as const;
}
