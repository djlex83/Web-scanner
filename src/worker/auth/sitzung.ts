import { deleteCookie, getCookie, setCookie } from "hono/cookie";
import type { MiddlewareHandler } from "hono";
import type { Rolle } from "../../gemeinsam/rechte";
import { geraet, jetzt, type AppEnv, type Ctx } from "../kontext";
import { sha256Hex, zufallsToken } from "./passwort";

export const COOKIE = "ws_sitzung";
const KURZ_SEK = 12 * 3600; // ohne "angemeldet bleiben": 12 h ab letzter Nutzung
const LANG_SEK = 30 * 24 * 3600; // mit "angemeldet bleiben": 30 Tage
const VERLAENGERN_AB_SEK = 10 * 60; // höchstens alle 10 min in die DB schreiben

function cookieSetzen(c: Ctx, token: string, sek: number) {
  setCookie(c, COOKIE, token, {
    httpOnly: true,
    secure: new URL(c.req.url).protocol === "https:",
    sameSite: "Strict",
    path: "/",
    maxAge: sek,
  });
}

export async function sitzungStarten(c: Ctx, benutzerId: number, lang: boolean): Promise<void> {
  const token = zufallsToken();
  const dauer = lang ? LANG_SEK : KURZ_SEK;
  const nun = new Date();
  await c.env.DB.prepare(
    "INSERT INTO sitzungen (token_hash, benutzer_id, erstellt_am, laeuft_ab, dauer_sek, geraet) VALUES (?, ?, ?, ?, ?, ?)",
  )
    .bind(
      await sha256Hex(token),
      benutzerId,
      nun.toISOString(),
      new Date(nun.getTime() + dauer * 1000).toISOString(),
      dauer,
      geraet(c),
    )
    .run();
  cookieSetzen(c, token, dauer);
}

export async function sitzungBeenden(c: Ctx): Promise<void> {
  const token = getCookie(c, COOKIE);
  if (token) {
    await c.env.DB.prepare("DELETE FROM sitzungen WHERE token_hash = ?")
      .bind(await sha256Hex(token))
      .run();
  }
  deleteCookie(c, COOKIE, { path: "/" });
}

export function alleSitzungenBeenden(c: Ctx, benutzerId: number): D1PreparedStatement {
  return c.env.DB.prepare("DELETE FROM sitzungen WHERE benutzer_id = ?").bind(benutzerId);
}

interface SitzungsZeile {
  token_hash: string;
  laeuft_ab: string;
  dauer_sek: number;
  id: number;
  benutzername: string;
  name: string;
  rolle: Rolle;
  passwort_aendern: number;
}

/** Middleware: liest die Sitzung aus dem Cookie und setzt c.var.benutzer. */
export const sitzungLesen: MiddlewareHandler<AppEnv> = async (c, next) => {
  c.set("benutzer", null);
  const token = getCookie(c, COOKIE);
  if (token) {
    const hash = await sha256Hex(token);
    const z = await c.env.DB.prepare(
      `SELECT s.token_hash, s.laeuft_ab, s.dauer_sek, b.id, b.benutzername, b.name, b.rolle, b.passwort_aendern
       FROM sitzungen s JOIN benutzer b ON b.id = s.benutzer_id
       WHERE s.token_hash = ? AND s.laeuft_ab > ? AND b.aktiv = 1`,
    )
      .bind(hash, jetzt())
      .first<SitzungsZeile>();
    if (z) {
      c.set("benutzer", {
        id: z.id,
        benutzername: z.benutzername,
        name: z.name,
        rolle: z.rolle,
        passwort_aendern: z.passwort_aendern === 1,
      });
      // gleitender Ablauf
      const neuAb = Date.now() + z.dauer_sek * 1000;
      if (neuAb - Date.parse(z.laeuft_ab) > VERLAENGERN_AB_SEK * 1000) {
        await c.env.DB.prepare("UPDATE sitzungen SET laeuft_ab = ? WHERE token_hash = ?")
          .bind(new Date(neuAb).toISOString(), hash)
          .run();
        cookieSetzen(c, token, z.dauer_sek);
      }
    } else {
      deleteCookie(c, COOKIE, { path: "/" });
    }
  }
  await next();
};
