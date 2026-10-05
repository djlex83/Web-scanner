import { Hono } from "hono";
import { anmeldenSchema, einrichtenSchema, passwortAendernSchema } from "../../gemeinsam/schemas";
import { ATTRAPPEN_HASH, passwortHashen, passwortPruefen, runden } from "../auth/passwort";
import { clientIp, drosseln } from "../auth/drossel";
import { alleSitzungenBeenden, sitzungBeenden, sitzungStarten } from "../auth/sitzung";
import { benutzerVon, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

const MAX_FEHLVERSUCHE = 5;
const SPERRE_MIN = 15;

export const authRouten = new Hono<AppEnv>();

/** Muss noch ein erster Admin angelegt werden? */
authRouten.get("/einrichten", async (c) => {
  const z = await c.env.DB.prepare("SELECT COUNT(*) AS n FROM benutzer").first<{ n: number }>();
  return c.json({ noetig: (z?.n ?? 0) === 0 });
});

/** Legt den ersten Admin an – nur möglich, solange es noch keinen Benutzer gibt. */
authRouten.post("/einrichten", async (c) => {
  const e = await eingabe(c, einrichtenSchema);
  const hash = await passwortHashen(e.passwort, runden(c.env));
  const erg = await c.env.DB.prepare(
    `INSERT INTO benutzer (benutzername, name, rolle, passwort_hash, erstellt_am, letzte_anmeldung)
     SELECT ?, ?, 'admin', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM benutzer)`,
  )
    .bind(e.benutzername, e.name, hash, jetzt(), jetzt())
    .run();
  if (!erg.meta.changes) fehler(409, "Die App ist bereits eingerichtet");
  const id = erg.meta.last_row_id;
  await protokollEintrag(c, {
    benutzer_id: id,
    aktion: "einrichten",
    objekt_typ: "benutzer",
    objekt_id: id,
    text: `App eingerichtet, Admin „${e.name}“ angelegt`,
  }).run();
  await sitzungStarten(c, id, false);
  return c.json({ ok: true });
});

interface AnmeldeZeile {
  id: number;
  name: string;
  passwort_hash: string;
  aktiv: number;
  fehlversuche: number;
  gesperrt_bis: string | null;
}

authRouten.post("/anmelden", async (c) => {
  const e = await eingabe(c, anmeldenSchema);
  await drosseln(c, "ip:" + clientIp(c), 30, 15, "Zu viele Anmeldeversuche. Bitte später erneut versuchen.");
  const b = await c.env.DB.prepare(
    "SELECT id, name, passwort_hash, aktiv, fehlversuche, gesperrt_bis FROM benutzer WHERE benutzername = ?",
  )
    .bind(e.benutzername)
    .first<AnmeldeZeile>();

  if (!b || !b.aktiv) {
    await passwortPruefen(e.passwort, ATTRAPPEN_HASH); // gleiche Antwortzeit
    fehler(401, "Benutzername oder Passwort falsch");
  }
  if (b.gesperrt_bis && b.gesperrt_bis > jetzt()) {
    const min = Math.ceil((Date.parse(b.gesperrt_bis) - Date.now()) / 60_000);
    fehler(429, `Zu viele Fehlversuche. Konto für ${min} min gesperrt.`);
  }
  if (!(await passwortPruefen(e.passwort, b.passwort_hash))) {
    const versuche = b.fehlversuche + 1;
    const sperren = versuche >= MAX_FEHLVERSUCHE;
    await c.env.DB.batch([
      c.env.DB.prepare("UPDATE benutzer SET fehlversuche = ?, gesperrt_bis = ? WHERE id = ?").bind(
        sperren ? 0 : versuche,
        sperren ? new Date(Date.now() + SPERRE_MIN * 60_000).toISOString() : null,
        b.id,
      ),
      protokollEintrag(c, {
        benutzer_id: b.id,
        aktion: sperren ? "konto_gesperrt" : "anmeldung_fehlgeschlagen",
        objekt_typ: "benutzer",
        objekt_id: b.id,
        text: sperren
          ? `Konto „${b.name}“ nach ${MAX_FEHLVERSUCHE} Fehlversuchen für ${SPERRE_MIN} min gesperrt`
          : `Fehlgeschlagene Anmeldung für „${b.name}“`,
      }),
    ]);
    fehler(401, "Benutzername oder Passwort falsch");
  }

  await c.env.DB.batch([
    c.env.DB.prepare(
      "UPDATE benutzer SET fehlversuche = 0, gesperrt_bis = NULL, letzte_anmeldung = ? WHERE id = ?",
    ).bind(jetzt(), b.id),
    protokollEintrag(c, {
      benutzer_id: b.id,
      aktion: "anmeldung",
      objekt_typ: "benutzer",
      objekt_id: b.id,
      text: `${b.name} hat sich angemeldet`,
    }),
  ]);
  await sitzungStarten(c, b.id, e.angemeldet_bleiben);
  return c.json({ ok: true });
});

authRouten.post("/abmelden", async (c) => {
  await sitzungBeenden(c);
  return c.json({ ok: true });
});

authRouten.get("/ich", (c) => {
  return c.json({ benutzer: c.get("benutzer") });
});

authRouten.post("/passwort", async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, passwortAendernSchema);
  const z = await c.env.DB.prepare("SELECT passwort_hash FROM benutzer WHERE id = ?")
    .bind(ich.id)
    .first<{ passwort_hash: string }>();
  if (!z || !(await passwortPruefen(e.alt, z.passwort_hash))) {
    fehler(400, "Das bisherige Passwort stimmt nicht");
  }
  if (e.alt === e.neu) fehler(400, "Das neue Passwort muss sich vom bisherigen unterscheiden");
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE benutzer SET passwort_hash = ?, passwort_aendern = 0 WHERE id = ?").bind(
      await passwortHashen(e.neu, runden(c.env)),
      ich.id,
    ),
    alleSitzungenBeenden(c, ich.id),
    protokollEintrag(c, {
      aktion: "passwort_geaendert",
      objekt_typ: "benutzer",
      objekt_id: ich.id,
      text: `${ich.name} hat das eigene Passwort geändert`,
    }),
  ]);
  await sitzungStarten(c, ich.id, false);
  return c.json({ ok: true });
});
