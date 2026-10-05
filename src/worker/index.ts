import { Hono } from "hono";
import { csrf } from "hono/csrf";
import { HTTPException } from "hono/http-exception";
import { secureHeaders } from "hono/secure-headers";
import { sitzungLesen } from "./auth/sitzung";
import { schemaSicherstellen } from "./db/migrationen";
import type { AppEnv } from "./kontext";
import { ausleihenRouten } from "./routen/ausleihen";
import { authRouten } from "./routen/auth";
import { benutzerRouten } from "./routen/benutzer";
import { notfallRouten } from "./routen/notfall";
import { buchungenRouten } from "./routen/buchungen";
import { fotoRouten } from "./routen/fotos";
import { inventurRouten } from "./routen/inventur";
import { kategorienRouten } from "./routen/kategorien";
import { plaetzeRouten } from "./routen/plaetze";
import { protokollRouten } from "./routen/protokoll";
import { pruefungenRouten } from "./routen/pruefungen";
import { scanRouten } from "./routen/scan";
import { stueckeRouten } from "./routen/stuecke";
import { uebersichtRouten } from "./routen/uebersicht";
import { vermisstRouten } from "./routen/vermisst";

const app = new Hono<AppEnv>().basePath("/api");

app.use(secureHeaders());
app.use(csrf());
app.use(async (c, next) => {
  await schemaSicherstellen(c.env.DB);
  c.header("cache-control", "no-store");
  await next();
});
app.use(sitzungLesen);

app.route("/auth/notfall", notfallRouten);
app.route("/auth", authRouten);
app.route("/benutzer", benutzerRouten);
app.route("/plaetze", plaetzeRouten);
app.route("/stuecke", fotoRouten);
app.route("/stuecke", stueckeRouten);
app.route("/kategorien", kategorienRouten);
app.route("/scan", scanRouten);
app.route("/buchungen", buchungenRouten);
app.route("/protokoll", protokollRouten);
app.route("/ausleihen", ausleihenRouten);
app.route("/vermisst", vermisstRouten);
app.route("/pruefungen", pruefungenRouten);
app.route("/inventur", inventurRouten);
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
