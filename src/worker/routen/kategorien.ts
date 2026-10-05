import { Hono } from "hono";
import { FARBE_NAME, standardStil, type Kategorie } from "../../gemeinsam/kategorien";
import { kategorieStilSchema } from "../../gemeinsam/schemas";
import { braucht, eingabe, jetzt, protokollEintrag, type AppEnv } from "../kontext";

export const kategorienRouten = new Hono<AppEnv>();

/** Alle Kategorien: benutzte (aus den Stücken) plus solche mit eigenem Stil, mit Anzahl. */
kategorienRouten.get("/", braucht("abfragen"), async (c) => {
  const [benutzt, stile] = await Promise.all([
    c.env.DB.prepare(
      `SELECT kategorie AS name, COUNT(*) AS n FROM stuecke
       WHERE kategorie IS NOT NULL AND status != 'ausgemustert' GROUP BY kategorie COLLATE NOCASE`,
    ).all<{ name: string; n: number }>(),
    c.env.DB.prepare("SELECT name, symbol, farbe FROM kategorien").all<{ name: string; symbol: string; farbe: string }>(),
  ]);
  const ergebnis = new Map<string, Kategorie>();
  for (const b of benutzt.results) {
    ergebnis.set(b.name.toLowerCase(), { name: b.name, anzahl: b.n, eigen: false, ...standardStil(b.name) });
  }
  for (const s of stile.results) {
    const vorhanden = ergebnis.get(s.name.toLowerCase());
    const stil = standardStil(s.name);
    ergebnis.set(s.name.toLowerCase(), {
      name: vorhanden?.name ?? s.name,
      anzahl: vorhanden?.anzahl ?? 0,
      eigen: true,
      symbol: (s.symbol as Kategorie["symbol"]) ?? stil.symbol,
      farbe: (s.farbe as Kategorie["farbe"]) ?? stil.farbe,
    });
  }
  const liste = [...ergebnis.values()].sort(
    (a, b) => b.anzahl - a.anzahl || a.name.localeCompare(b.name, "de", { sensitivity: "base" }),
  );
  return c.json(liste);
});

/** Symbol und Farbe einer Kategorie festlegen. */
kategorienRouten.put("/:name", braucht("stuecke_verwalten"), async (c) => {
  const name = decodeURIComponent(c.req.param("name")).trim().slice(0, 80);
  const e = await eingabe(c, kategorieStilSchema);
  await c.env.DB.batch([
    c.env.DB.prepare(
      `INSERT INTO kategorien (name, symbol, farbe, geaendert_am) VALUES (?, ?, ?, ?)
       ON CONFLICT(name) DO UPDATE SET symbol = excluded.symbol, farbe = excluded.farbe, geaendert_am = excluded.geaendert_am`,
    ).bind(name, e.symbol, e.farbe, jetzt()),
    protokollEintrag(c, {
      aktion: "kategorie_geaendert",
      objekt_typ: "kategorie",
      text: `Kategorie „${name}“: Symbol ${e.symbol}, Farbe ${FARBE_NAME[e.farbe]}`,
      nachher: { name, ...e },
    }),
  ]);
  return c.json({ ok: true });
});
