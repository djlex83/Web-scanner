// Strichcodes: Plätze bekommen eigene QR-Codes mit Präfix, alles andere ist ein Stück.

export const PLATZ_PRAEFIX = "PLATZ:";

/** Entfernt Steuerzeichen (z. B. von Handscannern) und Leerraum am Rand. */
export function normalisiereCode(roh: string): string {
  // eslint-disable-next-line no-control-regex
  return roh.replace(/[\u0000-\u001f\u007f]/g, "").trim();
}

export function istPlatzCode(code: string): boolean {
  return code.toUpperCase().startsWith(PLATZ_PRAEFIX);
}

// Crockford-Base32 ohne leicht verwechselbare Zeichen (I, L, O, U)
const ZEICHEN = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export function zufallsKennung(laenge = 8): string {
  const bytes = new Uint8Array(laenge);
  crypto.getRandomValues(bytes);
  let s = "";
  for (const b of bytes) s += ZEICHEN[b % ZEICHEN.length];
  return s;
}

export function neuerPlatzCode(): string {
  return PLATZ_PRAEFIX + zufallsKennung(8);
}
