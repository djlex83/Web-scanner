import { useCallback, useRef, useState } from "react";
import type { ScanTreffer } from "../../gemeinsam/typen";
import { fehlerText, senden } from "../lib/api";
import { signalTreffer, signalUnbekannt } from "../lib/rueckmeldung";

export interface Eintrag {
  code: string;
  zeit: number;
  treffer: ScanTreffer | null; // null = wird gerade aufgelöst
  fehler?: string;
}

/**
 * Liste gescannter Codes. Neue Codes werden kurz gesammelt (mehrere Codes pro Kamerabild)
 * und dann mit einer einzigen Anfrage aufgelöst. Doppelte Codes werden ignoriert.
 */
export function useScanListe(beiTreffer?: (t: ScanTreffer) => void) {
  const [eintraege, setEintraege] = useState<Eintrag[]>([]);
  const bekannt = useRef(new Set<string>());
  const warteschlange = useRef<string[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rueckruf = useRef(beiTreffer);
  rueckruf.current = beiTreffer;

  const aufloesen = useCallback(async () => {
    timer.current = null;
    const codes = warteschlange.current.splice(0);
    if (!codes.length) return;
    try {
      const treffer = await senden<ScanTreffer[]>("/scan", { codes });
      const nachCode = new Map(treffer.map((t) => [t.code, t]));
      if (treffer.some((t) => t.art === "unbekannt")) signalUnbekannt();
      setEintraege((liste) =>
        liste.map((e) => (nachCode.has(e.code) ? { ...e, treffer: nachCode.get(e.code)!, fehler: undefined } : e)),
      );
      treffer.forEach((t) => rueckruf.current?.(t));
    } catch (err) {
      const meldung = fehlerText(err);
      setEintraege((liste) => liste.map((e) => (codes.includes(e.code) ? { ...e, fehler: meldung } : e)));
      codes.forEach((c) => bekannt.current.delete(c)); // erneut scannbar
    }
  }, []);

  const hinzufuegen = useCallback(
    (codes: string[]) => {
      const neu = codes.filter((c) => !bekannt.current.has(c));
      if (!neu.length) return;
      signalTreffer();
      neu.forEach((c) => bekannt.current.add(c));
      const zeit = Date.now();
      setEintraege((liste) => [
        ...neu.map((code) => ({ code, zeit, treffer: null })),
        ...liste.filter((e) => !neu.includes(e.code)),
      ]);
      warteschlange.current.push(...neu);
      timer.current ??= setTimeout(() => void aufloesen(), 180);
    },
    [aufloesen],
  );

  const entfernen = useCallback((code: string) => {
    bekannt.current.delete(code);
    setEintraege((l) => l.filter((e) => e.code !== code));
  }, []);

  const ersetzen = useCallback((code: string, treffer: ScanTreffer) => {
    setEintraege((l) => l.map((e) => (e.code === code ? { ...e, treffer } : e)));
  }, []);

  const leeren = useCallback((nur?: (e: Eintrag) => boolean) => {
    setEintraege((l) => {
      const bleiben = nur ? l.filter((e) => !nur(e)) : [];
      bekannt.current = new Set(bleiben.map((e) => e.code));
      return bleiben;
    });
  }, []);

  return { eintraege, hinzufuegen, entfernen, ersetzen, leeren, neuAufloesen: aufloesen };
}
