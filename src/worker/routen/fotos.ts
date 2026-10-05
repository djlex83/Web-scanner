// Fotos von Stücken. Die Oberfläche verkleinert vor dem Hochladen (groß ≈ 1200 px, Vorschau 240 px),
// gespeichert wird direkt in D1 – kein zusätzlicher Speicherdienst nötig.
import { Hono } from "hono";
import { benutzerVon, braucht, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const fotoRouten = new Hono<AppEnv>();

const MAX_BILD = 700 * 1024;
const MAX_VORSCHAU = 80 * 1024;

/** Bildart anhand der ersten Bytes erkennen – nur JPEG, PNG und WebP sind erlaubt. */
function bildTyp(b: Uint8Array): string | null {
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return "image/png";
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) {
    return "image/webp";
  }
  return null;
}

async function datei(wert: unknown, max: number, name: string): Promise<{ daten: Uint8Array; typ: string }> {
  if (!(wert instanceof File)) fehler(400, `${name} fehlt`);
  if (wert.size === 0 || wert.size > max) fehler(400, `${name} ist zu groß`);
  const daten = new Uint8Array(await wert.arrayBuffer());
  const typ = bildTyp(daten);
  if (!typ) fehler(400, `${name}: nur JPEG, PNG oder WebP`);
  return { daten, typ };
}

fotoRouten.get("/:id{[0-9]+}/foto", braucht("abfragen"), async (c) => {
  const klein = c.req.query("groesse") !== "gross";
  const z = await c.env.DB.prepare(
    klein
      ? "SELECT vorschau AS daten, vorschau_typ AS typ FROM fotos WHERE stueck_id = ?"
      : "SELECT bild AS daten, bild_typ AS typ FROM fotos WHERE stueck_id = ?",
  )
    .bind(Number(c.req.param("id")))
    .first<{ daten: ArrayBuffer | number[]; typ: string }>();
  if (!z) fehler(404, "Kein Foto");
  const bytes = z.daten instanceof ArrayBuffer ? new Uint8Array(z.daten) : new Uint8Array(z.daten);
  // Die Adresse enthält die Foto-Version → darf lange im Browser bleiben
  return c.body(bytes, 200, {
    "content-type": z.typ,
    "cache-control": "private, max-age=31536000, immutable",
    "x-content-type-options": "nosniff",
  });
});

fotoRouten.post("/:id{[0-9]+}/foto", braucht("erfassen"), async (c) => {
  const ich = benutzerVon(c);
  const id = Number(c.req.param("id"));
  const stueck = await c.env.DB.prepare("SELECT name, code, foto_version FROM stuecke WHERE id = ?")
    .bind(id)
    .first<{ name: string; code: string; foto_version: number | null }>();
  if (!stueck) fehler(404, "Stück nicht gefunden");

  let form: FormData;
  try {
    form = await c.req.formData();
  } catch {
    fehler(400, "Ungültige Anfrage");
  }
  const bild = await datei(form.get("bild"), MAX_BILD, "Foto");
  const vorschau = await datei(form.get("vorschau"), MAX_VORSCHAU, "Vorschau");
  const version = (stueck.foto_version ?? 0) + 1;

  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO fotos (stueck_id, bild, bild_typ, vorschau, vorschau_typ, groesse, benutzer_id, erstellt_am)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(stueck_id) DO UPDATE SET bild = excluded.bild, bild_typ = excluded.bild_typ,
         vorschau = excluded.vorschau, vorschau_typ = excluded.vorschau_typ, groesse = excluded.groesse,
         benutzer_id = excluded.benutzer_id, erstellt_am = excluded.erstellt_am`,
    ).bind(id, bild.daten, bild.typ, vorschau.daten, vorschau.typ, bild.daten.length + vorschau.daten.length, ich.id, jetzt()),
    c.env.DB.prepare("UPDATE stuecke SET foto_version = ?, geaendert_am = ? WHERE id = ?").bind(version, jetzt(), id),
    protokollEintrag(c, {
      aktion: "foto_geaendert",
      objekt_typ: "stueck",
      objekt_id: id,
      text: `Foto ${stueck.foto_version ? "ersetzt" : "hinzugefügt"}: „${stueck.name}“ (${stueck.code})`,
    }),
  ]);
  return c.json({ foto_version: version });
});

fotoRouten.delete("/:id{[0-9]+}/foto", braucht("stuecke_verwalten"), async (c) => {
  const id = Number(c.req.param("id"));
  const stueck = await c.env.DB.prepare("SELECT name, code FROM stuecke WHERE id = ?")
    .bind(id)
    .first<{ name: string; code: string }>();
  if (!stueck) fehler(404, "Stück nicht gefunden");
  await c.env.DB.batch([
    c.env.DB.prepare("DELETE FROM fotos WHERE stueck_id = ?").bind(id),
    c.env.DB.prepare("UPDATE stuecke SET foto_version = NULL, geaendert_am = ? WHERE id = ?").bind(jetzt(), id),
    protokollEintrag(c, {
      aktion: "foto_entfernt",
      objekt_typ: "stueck",
      objekt_id: id,
      text: `Foto entfernt: „${stueck.name}“ (${stueck.code})`,
    }),
  ]);
  return c.json({ ok: true });
});
