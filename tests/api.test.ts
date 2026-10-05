import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { adminEinrichten, benutzerMit, Client } from "./hilfen";

describe("Einrichten und Anmelden", () => {
  it("erster Admin nur einmal, danach Anmeldung nötig", async () => {
    const gast = new Client();
    expect((await gast.get("/auth/einrichten")).daten).toEqual({ noetig: true });
    expect((await gast.get("/uebersicht")).status).toBe(401);

    const admin = await adminEinrichten();
    expect((await admin.get("/auth/ich")).daten.benutzer).toMatchObject({ rolle: "admin", name: "Chef Admin" });
    const liste = await admin.get("/benutzer");
    expect(liste.daten[0].letzte_anmeldung).not.toBeNull();
    expect((await gast.get("/auth/einrichten")).daten).toEqual({ noetig: false });

    const zweiter = await gast.post("/auth/einrichten", { benutzername: "xy", name: "X", passwort: "geheim-12345" });
    expect(zweiter.status).toBe(409);
  });

  it("falsches Passwort, Sperre nach 5 Fehlversuchen", async () => {
    await adminEinrichten();
    const c = new Client();
    for (let i = 0; i < 5; i++) {
      expect((await c.post("/auth/anmelden", { benutzername: "chef", passwort: "falsch" })).status).toBe(401);
    }
    const gesperrt = await c.post("/auth/anmelden", { benutzername: "chef", passwort: "geheim-12345" });
    expect(gesperrt.status).toBe(429);
  });

  it("neuer Benutzer muss zuerst das Passwort ändern", async () => {
    const admin = await adminEinrichten();
    await admin.post("/benutzer", { benutzername: "anna", name: "Anna", rolle: "mitarbeiter", passwort: "start-12345" });
    const anna = new Client();
    expect((await anna.post("/auth/anmelden", { benutzername: "ANNA", passwort: "start-12345" })).status).toBe(200);
    expect((await anna.get("/uebersicht")).status).toBe(403);
    expect((await anna.post("/auth/passwort", { alt: "start-12345", neu: "neu-passwort-1" })).status).toBe(200);
    expect((await anna.get("/uebersicht")).status).toBe(200);
  });

  it("Abmelden beendet die Sitzung", async () => {
    const admin = await adminEinrichten();
    const cookie = admin.cookie;
    await admin.post("/auth/abmelden", {});
    const alt = new Client();
    alt.cookie = cookie;
    expect((await alt.get("/auth/ich")).daten.benutzer).toBeNull();
  });
});

describe("Rollen", () => {
  it("Leser darf nur abfragen, Mitarbeiter buchen, Leitung Plätze anlegen", async () => {
    const admin = await adminEinrichten();
    const leser = await benutzerMit(admin, "leser1", "leser");
    const ma = await benutzerMit(admin, "ma1", "mitarbeiter");
    const leitung = await benutzerMit(admin, "leit1", "leitung");

    const platz = { name: "Montage", typ: "abteilung" };
    expect((await leser.post("/plaetze", platz)).status).toBe(403);
    expect((await ma.post("/plaetze", platz)).status).toBe(403);
    const abt = await leitung.post("/plaetze", platz);
    expect(abt.status).toBe(201);
    const regal = await leitung.post("/plaetze", { name: "Regal 1", typ: "regal", eltern_id: abt.daten.id });

    const stueck = { code: "4006381333931", name: "Bohrmaschine", platz_id: regal.daten.id };
    expect((await leser.post("/stuecke", stueck)).status).toBe(403);
    expect((await ma.post("/stuecke", stueck)).status).toBe(201);
    expect((await leser.post("/scan", { codes: ["4006381333931"] })).status).toBe(200);
    expect((await ma.get("/benutzer")).status).toBe(403);
    expect((await leitung.get("/benutzer")).status).toBe(403);
    expect((await admin.get("/benutzer")).status).toBe(200);
  });

  it("der letzte Admin kann sich nicht selbst entfernen", async () => {
    const admin = await adminEinrichten();
    const ich = (await admin.get("/auth/ich")).daten.benutzer;
    expect((await admin.patch(`/benutzer/${ich.id}`, { rolle: "leser" })).status).toBe(409);
  });
});

describe("Scannen und Buchen", () => {
  async function aufbau() {
    const admin = await adminEinrichten();
    const abt = (await admin.post("/plaetze", { name: "Lager", typ: "abteilung" })).daten;
    const r1 = (await admin.post("/plaetze", { name: "Regal 1", typ: "regal", eltern_id: abt.id })).daten;
    const r2 = (await admin.post("/plaetze", { name: "Regal 2", typ: "regal", eltern_id: abt.id })).daten;
    for (const [code, name] of [
      ["A-1", "Akkuschrauber"],
      ["A-2", "Wasserwaage"],
      ["A-3", "Flex"],
    ]) {
      await admin.post("/stuecke", { code, name, platz_id: r1.id });
    }
    return { admin, abt, r1, r2 };
  }

  it("löst Stücke, Plätze und unbekannte Codes auf", async () => {
    const { admin, r1 } = await aufbau();
    const r = await admin.post("/scan", { codes: ["A-2", r1.code, "GIBTSNICHT", " A-2 "] });
    expect(r.daten).toHaveLength(3);
    expect(r.daten[0]).toMatchObject({ art: "stueck", stueck: { name: "Wasserwaage", platz: { pfad: "Lager › Regal 1" } } });
    expect(r.daten[1]).toMatchObject({ art: "platz", platz: { name: "Regal 1", anzahl: 3 } });
    expect(r.daten[2]).toEqual({ code: "GIBTSNICHT", art: "unbekannt" });
  });

  it("bucht mehrere Stücke in einem Vorgang und protokolliert alles", async () => {
    const { admin, r1, r2 } = await aufbau();
    const scan = await admin.post("/scan", { codes: ["A-1", "A-2"] });
    const ids = scan.daten.map((t: any) => t.stueck.id);
    const b = await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: ids, notiz: "Umzug" });
    expect(b.daten).toMatchObject({ gebucht: 2, schon_dort: 0, ziel: "Lager › Regal 2" });

    const nochmal = await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: ids });
    expect(nochmal.daten).toMatchObject({ gebucht: 0, schon_dort: 2 });

    const detail = await admin.get(`/stuecke/${ids[0]}`);
    expect(detail.daten.stueck.platz.pfad).toBe("Lager › Regal 2");
    expect(detail.daten.stueck.bewegt_von).toBe("Chef Admin");
    expect(detail.daten.verlauf.map((v: any) => [v.art, v.von, v.nach])).toEqual([
      ["umbuchen", "Lager › Regal 1", "Lager › Regal 2"],
      ["erfassen", null, "Lager › Regal 1"],
    ]);

    const regal1 = await admin.get(`/plaetze/${r1.id}`);
    expect(regal1.daten.stuecke.map((s: any) => s.name)).toEqual(["Flex"]);

    const prot = await admin.get("/protokoll");
    expect(prot.daten.eintraege[0]).toMatchObject({ aktion: "umgebucht", text: "2 Stücke → Lager › Regal 2" });

    const csv = await admin.get("/protokoll/bewegungen/csv");
    expect(csv.res.headers.get("content-type")).toContain("text/csv");
    expect(csv.daten).toContain("Wasserwaage");
  });

  it("Protokoll und Buchungen lassen sich nicht ändern oder löschen", async () => {
    await aufbau();
    await expect(env.DB.prepare("DELETE FROM protokoll").run()).rejects.toThrow(/unveraenderbar/);
    await expect(env.DB.prepare("UPDATE buchungen SET notiz = 'x'").run()).rejects.toThrow(/unveraenderbar/);
  });

  it("doppelte Codes werden abgelehnt, Platz mit Inhalt nicht deaktivierbar", async () => {
    const { admin, r1 } = await aufbau();
    expect((await admin.post("/stuecke", { code: "A-1", name: "Doppelt" })).status).toBe(409);
    expect((await admin.post("/stuecke", { code: r1.code, name: "Platzcode" })).status).toBe(400);
    expect((await admin.patch(`/plaetze/${r1.id}`, { aktiv: false })).status).toBe(409);
  });

  it("Mitarbeiter sieht nur das eigene Protokoll", async () => {
    const { admin, r2 } = await aufbau();
    const ma = await benutzerMit(admin, "max", "mitarbeiter");
    const id = (await ma.post("/scan", { codes: ["A-3"] })).daten[0].stueck.id;
    await ma.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [id] });
    const eigen = await ma.get("/protokoll");
    expect(eigen.daten.eintraege.every((e: any) => e.benutzer === "max")).toBe(true);
    const bew = await ma.get("/protokoll/bewegungen");
    expect(bew.daten.eintraege).toHaveLength(1);
  });

  it("Suche im Bestand", async () => {
    const { admin } = await aufbau();
    const r = await admin.get("/stuecke?q=" + encodeURIComponent("waag"));
    expect(r.daten.eintraege.map((s: any) => s.name)).toEqual(["Wasserwaage"]);
    const ue = await admin.get("/uebersicht");
    expect(ue.daten).toMatchObject({ stuecke: 3, plaetze: 3, bewegungen_heute: 3 });
  });
});
