// Passwort-Hashing mit PBKDF2-SHA256 (WebCrypto, in Workers eingebaut).
// Format: pbkdf2$<runden>$<salt base64>$<hash base64>

// Rechenaufwand: Der kostenlose Workers-Tarif erlaubt nur ca. 10 ms CPU je Anfrage.
// 20 000 Runden ≈ 4 ms. Im bezahlten Tarif über die Variable PBKDF2_RUNDEN auf 100 000
// (Obergrenze in Workers) erhöhen; vorhandene Hashes bleiben gültig (Runden stehen im Hash).
export const PBKDF2_RUNDEN_STANDARD = 20_000;

export function runden(env: { PBKDF2_RUNDEN?: string }): number {
  const n = Number(env.PBKDF2_RUNDEN);
  return Number.isInteger(n) && n >= 10_000 && n <= 100_000 ? n : PBKDF2_RUNDEN_STANDARD;
}

const enc = new TextEncoder();

function zuBase64(bytes: ArrayBuffer | Uint8Array): string {
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  let s = "";
  for (const b of arr) s += String.fromCharCode(b);
  return btoa(s);
}

function vonBase64(text: string): Uint8Array {
  const s = atob(text);
  const arr = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) arr[i] = s.charCodeAt(i);
  return arr;
}

async function ableiten(passwort: string, salt: Uint8Array, runden: number): Promise<ArrayBuffer> {
  const schluessel = await crypto.subtle.importKey("raw", enc.encode(passwort), "PBKDF2", false, [
    "deriveBits",
  ]);
  return crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: runden },
    schluessel,
    256,
  );
}

export async function passwortHashen(passwort: string, anzahl: number): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await ableiten(passwort, salt, anzahl);
  return `pbkdf2$${anzahl}$${zuBase64(salt)}$${zuBase64(hash)}`;
}

export async function passwortPruefen(passwort: string, gespeichert: string): Promise<boolean> {
  const [verfahren, rundenText, saltText, hashText] = gespeichert.split("$");
  if (verfahren !== "pbkdf2" || !rundenText || !saltText || !hashText) return false;
  const erwartet = vonBase64(hashText);
  const ist = new Uint8Array(await ableiten(passwort, vonBase64(saltText), Number(rundenText)));
  if (ist.length !== erwartet.length) return false;
  // Vergleich in konstanter Zeit
  let unterschied = 0;
  for (let i = 0; i < ist.length; i++) unterschied |= ist[i]! ^ erwartet[i]!;
  return unterschied === 0;
}

/** Hash eines unbekannten Zufallspassworts: Bei unbekannten Benutzernamen wird dagegen
 *  geprüft, damit die Antwortzeit nicht verrät, ob es den Namen gibt. */
export const ATTRAPPEN_HASH =
  "pbkdf2$20000$omQHNDgnlHFJic5mUNOabQ==$LhhMlB667QOyQIgBhGFedjIpxlW63guAlBlmZoFNdgY=";

export async function sha256Hex(text: string): Promise<string> {
  const hash = await crypto.subtle.digest("SHA-256", enc.encode(text));
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

export function zufallsToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return zuBase64(bytes).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}
