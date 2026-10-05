// Kalendertage als "JJJJ-MM-TT" (deutsche Zeit) – für Rückgabe- und Prüftermine.

/** Heutiges Datum in Deutschland. */
export function heute(jetzt = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Berlin" }).format(jetzt);
}

/** Tage dazuzählen (auch negativ). */
export function plusTage(datum: string, tage: number): string {
  const d = new Date(datum + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + tage);
  return d.toISOString().slice(0, 10);
}

/** Monate dazuzählen; der 31. wird bei kürzeren Monaten zum Monatsletzten. */
export function plusMonate(datum: string, monate: number): string {
  const [j, m, t] = datum.split("-").map(Number) as [number, number, number];
  const ziel = new Date(Date.UTC(j, m - 1 + monate, 1, 12));
  const letzter = new Date(Date.UTC(ziel.getUTCFullYear(), ziel.getUTCMonth() + 1, 0, 12)).getUTCDate();
  ziel.setUTCDate(Math.min(t, letzter));
  return ziel.toISOString().slice(0, 10);
}

/** Gültiges Datum im Format JJJJ-MM-TT? */
export function istDatum(s: string): boolean {
  return /^\d{4}-\d{2}-\d{2}$/.test(s) && new Date(s + "T12:00:00Z").toISOString().slice(0, 10) === s;
}
