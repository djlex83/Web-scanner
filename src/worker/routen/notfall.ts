// Notfall-Zugang: Admin-Passwort mit einem geheimen Code neu setzen, z. B. wenn der
// einzige Admin sein Passwort vergessen hat. Der Code liegt nur als Secret NOTFALL_CODE
// in Cloudflare – ohne Secret ist die Funktion abgeschaltet.
import { Hono } from "hono";
import { notfallSchema } from "../../gemeinsam/schemas";
import { clientIp, drosseln } from "../auth/drossel";
import { passwortHashen, runden, sha256Hex } from "../auth/passwort";
import { alleSitzungenBeenden, sitzungStarten } from "../auth/sitzung";
import { eingabe, fehler, protokollEintrag, type AppEnv } from "../kontext";

export const NOTFALL_CODE_MIN = 16;

export const notfallRouten = new Hono<AppEnv>();

function hinterlegterCode(env: Env): string | null {
  const code = env.NOTFALL_CODE?.trim();
  return code && code.length >= NOTFALL_CODE_MIN ? code : null;
}

/** Vergleich über Hashes in konstanter Zeit – verrät nichts über die Länge oder Teile des Codes. */
async function gleich(a: string, b: string): Promise<boolean> {
  const [x, y] = await Promise.all([sha256Hex(a), sha256Hex(b)]);
  let unterschied = 0;
  for (let i = 0; i < x.length; i++) unterschied |= x.charCodeAt(i) ^ y.charCodeAt(i);
  return unterschied === 0;
}

notfallRouten.get("/", (c) => c.json({ verfuegbar: hinterlegterCode(c.env) !== null }));

notfallRouten.post("/", async (c) => {
  const code = hinterlegterCode(c.env);
  if (!code) fehler(404, "Notfall-Zugang ist nicht eingerichtet");
  const e = await eingabe(c, notfallSchema);

  // Streng begrenzt: 5 Versuche je Gerät/IP in 15 min, 10 Versuche insgesamt pro Stunde
  const zuViele = "Zu viele Versuche. Bitte später erneut versuchen.";
  await drosseln(c, "notfall:" + clientIp(c), 5, 15, zuViele);
  await drosseln(c, "notfall:alle", 10, 60, zuViele);

  if (!(await gleich(e.code, code))) {
    await protokollEintrag(c, {
      benutzer_id: null,
      aktion: "notfall_fehlgeschlagen",
      objekt_typ: "system",
      text: `Notfall-Zugang mit falschem Code versucht (Benutzername „${e.benutzername}“)`,
    }).run();
    fehler(401, "Notfall-Code falsch");
  }

  const admin = await c.env.DB.prepare("SELECT id, name, rolle FROM benutzer WHERE benutzername = ?")
    .bind(e.benutzername)
    .first<{ id: number; name: string; rolle: string }>();
  if (!admin || admin.rolle !== "admin") fehler(400, "Kein Admin-Konto mit diesem Benutzernamen");

  await c.env.DB.batch([
    c.env.DB.prepare(
      `UPDATE benutzer SET passwort_hash = ?, passwort_aendern = 0, aktiv = 1,
         fehlversuche = 0, gesperrt_bis = NULL, letzte_anmeldung = ? WHERE id = ?`,
    ).bind(await passwortHashen(e.neues_passwort, runden(c.env)), new Date().toISOString(), admin.id),
    alleSitzungenBeenden(c, admin.id),
    protokollEintrag(c, {
      benutzer_id: admin.id,
      aktion: "notfall_zugang",
      objekt_typ: "benutzer",
      objekt_id: admin.id,
      text: `Admin-Zugang für „${admin.name}“ mit dem Notfall-Code wiederhergestellt`,
    }),
  ]);
  await sitzungStarten(c, admin.id, false);
  return c.json({ ok: true });
});
