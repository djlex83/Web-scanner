import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { sitzungLesen } from "./auth/sitzung";
import { schemaSicherstellen } from "./db/migrationen";
import type { AppEnv } from "./kontext";
import { authRouten } from "./routen/auth";
import { benutzerRouten } from "./routen/benutzer";
import { buchungenRouten } from "./routen/buchungen";
import { plaetzeRouten } from "./routen/plaetze";
import { protokollRouten } from "./routen/protokoll";
import { scanRouten } from "./routen/scan";
import { stueckeRouten } from "./routen/stuecke";
import { uebersichtRouten } from "./routen/uebersicht";

const app = new Hono<AppEnv>().basePath("/api");

app.use(secureHeaders());
app.use(csrf());
app.use(async (c, next) => {
  await schemaSicherstellen(c.env.DB);
  c.header("cache-control", "no-store");
  await next();
});
app.use(sitzungLesen);

app.route("/auth", authRouten);
app.route("/benutzer", benutzerRouten);
app.route("/plaetze", plaetzeRouten);
app.route("/stuecke", stueckeRouten);
app.route("/scan", scanRouten);
app.route("/buchungen", buchungenRouten);
app.route("/protokoll", protokollRouten);
app.route("/uebersicht", uebersichtRouten);

app.notFound((c) => c.json({ fehler: "Nicht gefunden" }, 404));
app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ fehler: err.message }, err.status);
  }
  console.error(err);
  return c.json({ fehler: "Interner Fehler. Bitte erneut versuchen." }, 500);
});

export default app;
