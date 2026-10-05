const datumZeit = new Intl.DateTimeFormat("de-DE", { dateStyle: "medium", timeStyle: "short" });
const nurZeit = new Intl.DateTimeFormat("de-DE", { timeStyle: "short" });
const nurDatum = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" });
const relativ = new Intl.RelativeTimeFormat("de-DE", { numeric: "auto" });

export function zeitpunkt(iso: string | null | undefined): string {
  return iso ? datumZeit.format(new Date(iso)) : "–";
}

export function uhrzeit(iso: string): string {
  return nurZeit.format(new Date(iso));
}

/** "vor 5 Minuten", "gestern", … */
export function vorWann(iso: string | null | undefined): string {
  if (!iso) return "–";
  const sek = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(sek);
  if (abs < 45) return "gerade eben";
  if (abs < 3600) return relativ.format(Math.round(sek / 60), "minute");
  if (abs < 86400) return relativ.format(Math.round(sek / 3600), "hour");
  if (abs < 86400 * 30) return relativ.format(Math.round(sek / 86400), "day");
  return datumZeit.format(new Date(iso));
}

export function tagesUeberschrift(iso: string): string {
  const d = new Date(iso);
  const heute = new Date();
  const gestern = new Date(Date.now() - 86400_000);
  if (d.toDateString() === heute.toDateString()) return "Heute";
  if (d.toDateString() === gestern.toDateString()) return "Gestern";
  return nurDatum.format(d);
}

export function anzahl(n: number, einzahl: string, mehrzahl: string): string {
  return `${n.toLocaleString("de-DE")} ${n === 1 ? einzahl : mehrzahl}`;
}
