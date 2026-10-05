import type { Context, MiddlewareHandler } from "hono";
import { HTTPException } from "hono/http-exception";
import type { ZodType } from "zod";
import { darf, type Recht, type Rolle } from "../gemeinsam/rechte";

export interface AktuellerBenutzer {
  id: number;
  benutzername: string;
  name: string;
  rolle: Rolle;
  passwort_aendern: boolean;
}

export type AppEnv = {
  Bindings: Env;
  Variables: {
    benutzer: AktuellerBenutzer | null;
  };
};

export type Ctx = Context<AppEnv>;

export const jetzt = () => new Date().toISOString();

export function fehler(status: 400 | 401 | 403 | 404 | 409 | 429, meldung: string): never {
  throw new HTTPException(status, { message: meldung });
}

/** Liest und prüft den JSON-Körper; bei Fehlern 400 mit verständlicher Meldung. */
export async function eingabe<T>(c: Ctx, schema: ZodType<T>): Promise<T> {
  let roh: unknown;
  try {
    roh = await c.req.json();
  } catch {
    fehler(400, "Ungültige Anfrage");
  }
  const erg = schema.safeParse(roh);
  if (!erg.success) {
    const p = erg.error.issues[0];
    fehler(400, p ? `${p.path.join(".") || "Eingabe"}: ${p.message}` : "Ungültige Eingabe");
  }
  return erg.data;
}

export function benutzerVon(c: Ctx): AktuellerBenutzer {
  const b = c.get("benutzer");
  if (!b) fehler(401, "Bitte anmelden");
  return b;
}

/** Middleware: angemeldet und (optional) mit Recht. */
export function braucht(recht?: Recht): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const b = benutzerVon(c);
    if (b.passwort_aendern && !c.req.path.startsWith("/api/auth/")) {
      fehler(403, "Bitte zuerst ein neues Passwort festlegen");
    }
    if (recht && !darf(b.rolle, recht)) fehler(403, "Dafür fehlt die Berechtigung");
    await next();
  };
}

export function geraet(c: Ctx): string | null {
  return c.req.header("user-agent")?.slice(0, 200) ?? null;
}

export function protokollEintrag(
  c: Ctx,
  e: {
    aktion: string;
    objekt_typ: string;
    objekt_id?: number | null;
    text: string;
    vorher?: unknown;
    nachher?: unknown;
    benutzer_id?: number | null;
  },
): D1PreparedStatement {
  return c.env.DB.prepare(
    `INSERT INTO protokoll (zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id, text, vorher_json, nachher_json, geraet)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  ).bind(
    jetzt(),
    e.benutzer_id !== undefined ? e.benutzer_id : (c.get("benutzer")?.id ?? null),
    e.aktion,
    e.objekt_typ,
    e.objekt_id ?? null,
    e.text,
    e.vorher === undefined ? null : JSON.stringify(e.vorher),
    e.nachher === undefined ? null : JSON.stringify(e.nachher),
    geraet(c),
  );
}
