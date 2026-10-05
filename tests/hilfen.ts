import { exports } from "cloudflare:workers";

/** Kleiner API-Client mit eigenem Cookie – simuliert einen angemeldeten Browser. */
export class Client {
  cookie = "";

  async anfrage(methode: string, pfad: string, koerper?: unknown) {
    const kopf: Record<string, string> = { "user-agent": "vitest", origin: "https://scanner.test" };
    if (this.cookie) kopf.cookie = this.cookie;
    const formular = koerper instanceof FormData;
    if (koerper !== undefined && !formular) kopf["content-type"] = "application/json";
    const res = await exports.default.fetch(
      new Request("https://scanner.test/api" + pfad, {
        method: methode,
        headers: kopf,
        body: koerper === undefined ? undefined : formular ? koerper : JSON.stringify(koerper),
      }),
    );
    const gesetzt = res.headers.get("set-cookie");
    if (gesetzt) {
      const [paar] = gesetzt.split(";");
      this.cookie = paar!.endsWith("=") ? "" : paar!;
    }
    const typ = res.headers.get("content-type") ?? "";
    const daten = typ.includes("json") ? await res.json<any>() : await res.text();
    return { status: res.status, daten, res };
  }

  get = (pfad: string) => this.anfrage("GET", pfad);
  post = (pfad: string, k: unknown) => this.anfrage("POST", pfad, k);
  patch = (pfad: string, k: unknown) => this.anfrage("PATCH", pfad, k);
  put = (pfad: string, k: unknown) => this.anfrage("PUT", pfad, k);
  loeschen = (pfad: string) => this.anfrage("DELETE", pfad);
}

export async function adminEinrichten(): Promise<Client> {
  const admin = new Client();
  const r = await admin.post("/auth/einrichten", {
    benutzername: "chef",
    name: "Chef Admin",
    passwort: "geheim-12345",
  });
  if (r.status !== 200) throw new Error("Einrichten fehlgeschlagen: " + JSON.stringify(r.daten));
  return admin;
}

/** Legt einen Benutzer an und meldet ihn an (Passwortwechsel erledigt). */
export async function benutzerMit(admin: Client, benutzername: string, rolle: string): Promise<Client> {
  const r = await admin.post("/benutzer", { benutzername, name: benutzername, rolle, passwort: "start-12345" });
  if (r.status !== 201) throw new Error(JSON.stringify(r.daten));
  const c = new Client();
  await c.post("/auth/anmelden", { benutzername, passwort: "start-12345" });
  const p = await c.post("/auth/passwort", { alt: "start-12345", neu: "neu-passwort-1" });
  if (p.status !== 200) throw new Error(JSON.stringify(p.daten));
  return c;
}
