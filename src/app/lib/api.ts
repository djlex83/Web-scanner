// Zugriff auf die Server-Schnittstelle. Fehler kommen als ApiFehler mit deutscher Meldung.

export class ApiFehler extends Error {
  constructor(
    public status: number,
    meldung: string,
  ) {
    super(meldung);
  }
}

type Abmelden = () => void;
let beiAbmeldung: Abmelden | null = null;
export function beiSitzungsende(fn: Abmelden) {
  beiAbmeldung = fn;
}

export async function api<T>(pfad: string, optionen: { methode?: string; daten?: unknown } = {}): Promise<T> {
  let res: Response;
  try {
    res = await fetch("/api" + pfad, {
      method: optionen.methode ?? (optionen.daten === undefined ? "GET" : "POST"),
      headers: optionen.daten === undefined ? undefined : { "content-type": "application/json" },
      body: optionen.daten === undefined ? undefined : JSON.stringify(optionen.daten),
      credentials: "same-origin",
    });
  } catch {
    throw new ApiFehler(0, "Keine Verbindung. Bitte Netz prüfen und erneut versuchen.");
  }
  const json = res.headers.get("content-type")?.includes("json") ? await res.json() : null;
  if (!res.ok) {
    if (res.status === 401 && !pfad.startsWith("/auth/")) beiAbmeldung?.();
    throw new ApiFehler(res.status, (json as { fehler?: string } | null)?.fehler ?? `Fehler ${res.status}`);
  }
  return json as T;
}

export const holen = <T>(pfad: string) => api<T>(pfad);
export const senden = <T>(pfad: string, daten: unknown) => api<T>(pfad, { daten });
export const aendern = <T>(pfad: string, daten: unknown) => api<T>(pfad, { methode: "PATCH", daten });

export function fehlerText(e: unknown): string {
  return e instanceof Error ? e.message : "Unbekannter Fehler";
}

/** Baut eine Abfragezeichenkette ohne leere Werte. */
export function abfrage(werte: Record<string, string | number | null | undefined>): string {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(werte)) if (v !== undefined && v !== null && v !== "") p.set(k, String(v));
  const s = p.toString();
  return s ? "?" + s : "";
}
