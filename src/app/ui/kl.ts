/** Klassen zusammensetzen, falsche Werte weglassen. */
export function kl(...teile: (string | false | null | undefined)[]): string {
  return teile.filter(Boolean).join(" ");
}
