import { Hono } from "hono";
import { stueckListeSchema } from "../../gemeinsam/schemas";
import { alsJson } from "../db/abfragen";
import { stueckeLaden } from "../db/bewegen";
import { braucht, eingabe, fehler, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const vermisstRouten = new Hono<AppEnv>();

/** Stücke als vermisst melden – wer sie später scannt, bekommt einen Hinweis. */
vermisstRouten.post("/", braucht("buchen"), async (c) => {
  const e = await eingabe(c, stueckListeSchema);
  const stuecke = (await stueckeLaden(c.env.DB, e.stueck_ids)).filter((s) => !s.vermisst_seit && s.status !== "ausgemustert");
  if (!stuecke.length) fehler(409, "Schon als vermisst gemeldet");
  const ids = stuecke.map((s) => s.id);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE stuecke SET vermisst_seit = ? WHERE id IN (SELECT value FROM json_each(?))").bind(jetzt(), alsJson(ids)),
    protokollEintrag(c, {
      aktion: "vermisst",
      objekt_typ: "stueck",
      objekt_id: ids.length === 1 ? ids[0] : null,
      text:
        (ids.length === 1 ? `„${stuecke[0]!.name}“ (${stuecke[0]!.code}) als vermisst gemeldet` : `${ids.length} Stücke als vermisst gemeldet`) +
        (e.notiz ? `: ${e.notiz}` : ""),
      nachher: { stuecke: stuecke.map((s) => ({ code: s.code, name: s.name })), notiz: e.notiz },
    }),
  ]);
  return c.json({ gemeldet: ids.length });
});

/** Gefunden, liegt aber am eingetragenen Platz – ohne Umbuchung. */
vermisstRouten.post("/gefunden", braucht("buchen"), async (c) => {
  const e = await eingabe(c, stueckListeSchema);
  const stuecke = (await stueckeLaden(c.env.DB, e.stueck_ids)).filter((s) => s.vermisst_seit);
  if (!stuecke.length) fehler(409, "Keines der Stücke ist als vermisst gemeldet");
  const ids = stuecke.map((s) => s.id);
  await c.env.DB.batch([
    c.env.DB.prepare("UPDATE stuecke SET vermisst_seit = NULL WHERE id IN (SELECT value FROM json_each(?))").bind(alsJson(ids)),
    protokollEintrag(c, {
      aktion: "gefunden",
      objekt_typ: "stueck",
      objekt_id: ids.length === 1 ? ids[0] : null,
      text: ids.length === 1 ? `„${stuecke[0]!.name}“ (${stuecke[0]!.code}) wieder gefunden` : `${ids.length} vermisste Stücke wieder gefunden`,
      nachher: { stuecke: stuecke.map((s) => ({ code: s.code, name: s.name })) },
    }),
  ]);
  return c.json({ gefunden: ids.length });
});
