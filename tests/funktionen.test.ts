import { env } from "cloudflare:workers";
import { describe, expect, it } from "vitest";
import { plusMonate } from "../src/gemeinsam/datum";
import { adminEinrichten, benutzerMit } from "./hilfen";

async function aufbau() {
  const admin = await adminEinrichten();
  const abt = (await admin.post("/plaetze", { name: "Lager", typ: "abteilung" })).daten;
  const r1 = (await admin.post("/plaetze", { name: "Regal 1", typ: "regal", eltern_id: abt.id })).daten;
  const r2 = (await admin.post("/plaetze", { name: "Regal 2", typ: "regal", eltern_id: abt.id })).daten;
  const ids: Record<string, number> = {};
  for (const [code, name] of [
    ["A-1", "Akkuschrauber"],
    ["A-2", "Wasserwaage"],
    ["A-3", "Flex"],
  ]) {
    ids[code] = (await admin.post("/stuecke", { code, name, platz_id: r1.id })).daten.id;
  }
  return { admin, abt, r1, r2, ids };
}

describe("Behälter", () => {
  it("Behälter mit eigenem Code anlegen, befüllen und samt Inhalt umbuchen", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const kiste = await admin.post("/stuecke", { name: "Kiste 1", behaelter: true, platz_id: r1.id });
    expect(kiste.status).toBe(201);
    expect(kiste.daten.code).toMatch(/^KISTE-[0-9A-Z]{8}$/);

    const rein = await admin.post("/buchungen", { nach_behaelter_id: kiste.daten.id, stueck_ids: [ids["A-1"], ids["A-2"]] });
    expect(rein.daten).toMatchObject({ gebucht: 2, ziel: "Behälter „Kiste 1“ (Lager › Regal 1)" });

    const raus = await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [kiste.daten.id] });
    expect(raus.daten.gebucht).toBe(1);

    const detail = await admin.get(`/stuecke/${kiste.daten.id}`);
    expect(detail.daten.stueck).toMatchObject({ behaelter: true, inhalt: 2, platz: { pfad: "Lager › Regal 2" } });
    expect(detail.daten.inhalt.map((s: any) => [s.name, s.platz.pfad])).toEqual([
      ["Akkuschrauber", "Lager › Regal 2"],
      ["Wasserwaage", "Lager › Regal 2"],
    ]);
    const akku = await admin.get(`/stuecke/${ids["A-1"]}`);
    expect(akku.daten.stueck.in_behaelter).toMatchObject({ name: "Kiste 1" });
    expect(akku.daten.verlauf[0]).toMatchObject({ mitgefuehrt: true, von: "Lager › Regal 1 › Kiste 1", nach: "Lager › Regal 2 › Kiste 1" });

    // Stück aus der Kiste aufs Regal: nicht mehr im Behälter
    await admin.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [ids["A-1"]] });
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck.in_behaelter).toBeNull();
  });

  it("verhindert Behälter in Behältern und Ausmustern voller Behälter", async () => {
    const { admin, r1, ids } = await aufbau();
    const k1 = (await admin.post("/stuecke", { name: "K1", behaelter: true, platz_id: r1.id })).daten;
    const k2 = (await admin.post("/stuecke", { name: "K2", behaelter: true })).daten;
    expect((await admin.post("/buchungen", { nach_behaelter_id: k1.id, stueck_ids: [k2.id] })).status).toBe(400);
    expect((await admin.post("/buchungen", { nach_behaelter_id: k1.id, stueck_ids: [k1.id] })).status).toBe(400);
    expect((await admin.post("/buchungen", { nach_behaelter_id: ids["A-1"], stueck_ids: [ids["A-2"]] })).status).toBe(400);
    await admin.post("/buchungen", { nach_behaelter_id: k1.id, stueck_ids: [ids["A-3"]] });
    expect((await admin.patch(`/stuecke/${k1.id}`, { status: "ausgemustert" })).status).toBe(409);
    expect((await admin.patch(`/stuecke/${k1.id}`, { behaelter: false })).status).toBe(409);
    expect((await admin.patch(`/stuecke/${ids["A-3"]}`, { behaelter: true })).status).toBe(409);
    // direkt in einen Behälter erfassen
    const neu = await admin.post("/stuecke", { code: "N-1", name: "Neu", in_behaelter_id: k1.id });
    expect(neu.daten).toMatchObject({ in_behaelter: { id: k1.id }, platz: { id: r1.id } });
  });
});

describe("Rückgängig", () => {
  it("macht eine Buchung durch Gegenbuchung rückgängig", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const b = await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"], ids["A-2"]] });
    const r = await admin.post("/buchungen/rueckgaengig", { vorgang_id: b.daten.vorgang_id });
    expect(r.daten).toMatchObject({ zurueck: 2, uebersprungen: 0 });
    expect((await admin.get(`/plaetze/${r1.id}`)).daten.stuecke).toHaveLength(3);
    // zweites Mal geht nicht
    expect((await admin.post("/buchungen/rueckgaengig", { vorgang_id: b.daten.vorgang_id })).status).toBe(409);
    const verlauf = (await admin.get(`/stuecke/${ids["A-1"]}`)).daten.verlauf;
    expect(verlauf).toHaveLength(3);
    expect(verlauf[0]).toMatchObject({ notiz: "Rückgängig", nach: "Lager › Regal 1" });
  });

  it("überspringt inzwischen bewegte Stücke; fremde Buchungen nur mit Leitung", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const ma = await benutzerMit(admin, "mia", "mitarbeiter");
    const b = await ma.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"], ids["A-2"]] });
    await admin.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [ids["A-2"]] });
    const ma2 = await benutzerMit(admin, "max", "mitarbeiter");
    expect((await ma2.post("/buchungen/rueckgaengig", { vorgang_id: b.daten.vorgang_id })).status).toBe(403);
    const r = await ma.post("/buchungen/rueckgaengig", { vorgang_id: b.daten.vorgang_id });
    expect(r.daten).toMatchObject({ zurueck: 1, uebersprungen: 1 });
  });
});

describe("Ausleihen", () => {
  it("ausgeben, Liste, doppelt verhindern, zurücknehmen", async () => {
    const { admin, ids } = await aufbau();
    const ma = await benutzerMit(admin, "mia", "mitarbeiter");
    const leser = await benutzerMit(admin, "lea", "leser");
    const daten = { stueck_ids: [ids["A-1"], ids["A-2"]], an: "Max Mustermann", bis: "2020-01-31" };
    expect((await leser.post("/ausleihen", daten)).status).toBe(403);
    expect((await ma.post("/ausleihen", daten)).daten).toEqual({ ausgegeben: 2 });
    expect((await ma.post("/ausleihen", { ...daten, stueck_ids: [ids["A-1"]] })).status).toBe(409);

    const offen = await leser.get("/ausleihen");
    expect(offen.daten.map((a: any) => [a.stueck.name, a.an, a.ausgegeben_von])).toEqual([
      ["Akkuschrauber", "Max Mustermann", "mia"],
      ["Wasserwaage", "Max Mustermann", "mia"],
    ]);
    expect((await ma.get("/ausleihen/namen")).daten).toEqual(["Max Mustermann"]);
    const ueb = (await admin.get("/uebersicht")).daten;
    expect(ueb).toMatchObject({ verliehen: 2, verliehen_ueberfaellig: 2 });
    expect((await admin.get("/stuecke?merkmal=ueberfaellig")).daten.eintraege).toHaveLength(2);

    expect((await ma.post("/ausleihen/zurueck", { stueck_ids: [ids["A-1"]] })).daten).toMatchObject({ zurueck: 1 });
    expect((await leser.get("/ausleihen")).daten).toHaveLength(1);
    const alle = (await leser.get("/ausleihen?alle=1")).daten;
    expect(alle.find((a: any) => a.stueck.name === "Akkuschrauber")).toMatchObject({ zurueck_von: "mia" });
  });

  it("Einbuchen beendet die Ausleihe", async () => {
    const { admin, r2, ids } = await aufbau();
    await admin.post("/ausleihen", { stueck_ids: [ids["A-1"]], an: "Anna" });
    const b = await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"]] });
    expect(b.daten.gebucht).toBe(1);
    expect((await admin.get("/ausleihen")).daten).toHaveLength(0);
    expect((await admin.get("/protokoll")).daten.eintraege[0].text).toContain("1 Ausleihe beendet");
  });
});

describe("Vermisst", () => {
  it("melden, beim Einbuchen gefunden, oder ohne Umbuchen gefunden", async () => {
    const { admin, r2, ids } = await aufbau();
    expect((await admin.post("/vermisst", { stueck_ids: [ids["A-1"], ids["A-2"]], notiz: "seit Montag weg" })).daten).toEqual({ gemeldet: 2 });
    expect((await admin.get("/uebersicht")).daten.vermisst).toBe(2);
    const scan = await admin.post("/scan", { codes: ["A-1"] });
    expect(scan.daten[0].stueck.vermisst_seit).not.toBeNull();

    await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"]] });
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck.vermisst_seit).toBeNull();

    expect((await admin.post("/vermisst/gefunden", { stueck_ids: [ids["A-2"]] })).daten).toEqual({ gefunden: 1 });
    expect((await admin.get("/stuecke?merkmal=vermisst")).daten.eintraege).toHaveLength(0);
  });
});

describe("Prüfung und Wartung", () => {
  it("Intervall einrichten, Prüfung eintragen, nächster Termin, nicht bestanden = defekt", async () => {
    const { admin, ids } = await aufbau();
    const ma = await benutzerMit(admin, "mia", "mitarbeiter");
    expect((await ma.patch(`/stuecke/${ids["A-1"]}`, { pruef_intervall: 12 })).status).toBe(403);
    const plan = await admin.patch(`/stuecke/${ids["A-1"]}`, {
      pruef_art: "Elektroprüfung",
      pruef_intervall: 12,
      pruef_naechste: "2020-03-01",
    });
    expect(plan.daten.pruefung).toEqual({ art: "Elektroprüfung", intervall: 12, naechste: "2020-03-01" });
    expect((await admin.get("/uebersicht")).daten.pruefung_ueberfaellig).toBe(1);
    expect((await admin.get("/pruefungen")).daten.map((s: any) => s.name)).toEqual(["Akkuschrauber"]);

    const p = await ma.post("/pruefungen", { stueck_id: ids["A-1"], datum: "2026-01-31", ergebnis: "bestanden" });
    expect(p.status).toBe(201);
    expect(p.daten.pruefung.naechste).toBe(plusMonate("2026-01-31", 12));

    const n = await ma.post("/pruefungen", { stueck_id: ids["A-1"], datum: "2026-02-10", ergebnis: "nicht_bestanden", naechste: "2026-03-01" });
    expect(n.daten).toMatchObject({ status: "defekt", pruefung: { naechste: "2026-03-01" } });

    const detail = await admin.get(`/stuecke/${ids["A-1"]}`);
    expect(detail.daten.pruefungen.map((x: any) => [x.datum, x.ergebnis, x.benutzer])).toEqual([
      ["2026-02-10", "nicht_bestanden", "mia"],
      ["2026-01-31", "bestanden", "mia"],
    ]);
    await expect(env.DB.prepare("DELETE FROM pruefungen").run()).rejects.toThrow(/unveraenderbar/);
  });

  it("Monate dazuzählen am Monatsende", () => {
    expect(plusMonate("2026-01-31", 1)).toBe("2026-02-28");
    expect(plusMonate("2024-01-31", 1)).toBe("2024-02-29");
    expect(plusMonate("2026-11-15", 3)).toBe("2027-02-15");
  });
});

describe("Inventur", () => {
  it("vergleicht Soll und Ist, bucht Zusätzliche um und meldet Fehlende als vermisst", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const fremd = (await admin.post("/stuecke", { code: "B-1", name: "Leiter", platz_id: r2.id })).daten;
    const egal = (await admin.post("/stuecke", { code: "C-1", name: "Schrauben", platz_id: r1.id, inventur: false })).daten;
    const kiste = (await admin.post("/stuecke", { name: "Kiste", behaelter: true, platz_id: r1.id })).daten;
    await admin.post("/buchungen", { nach_behaelter_id: kiste.id, stueck_ids: [ids["A-3"]] });
    await admin.post("/ausleihen", { stueck_ids: [ids["A-2"]], an: "Anna" });

    const soll = await admin.get(`/inventur/${r1.id}`);
    expect(soll.daten.stuecke.map((s: any) => s.name).sort()).toEqual(
      ["Akkuschrauber", "Flex", "Kiste", "Schrauben", "Wasserwaage"].sort(),
    );

    // gescannt: nur die Kiste (Inhalt zählt mit) und die Leiter von Regal 2
    const r = await admin.post("/inventur", {
      platz_id: r1.id,
      gefunden_ids: [kiste.id, fremd.id],
      zusaetzliche_buchen: true,
      fehlende_vermisst: true,
    });
    expect(r.status).toBe(201);
    expect(r.daten).toMatchObject({ erwartet: 4, gefunden: 2, fehlend: 1, zusaetzlich: 1, verliehen: 1 });
    expect(r.daten.fehlende.map((s: any) => s.name)).toEqual(["Akkuschrauber"]);
    expect(r.daten.zusaetzliche.map((s: any) => s.name)).toEqual(["Leiter"]);
    expect(r.daten.vorgang_id).toBeTruthy();

    expect((await admin.get(`/stuecke/${fremd.id}`)).daten.stueck.platz.id).toBe(r1.id);
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck.vermisst_seit).not.toBeNull();
    expect((await admin.get(`/stuecke/${egal.id}`)).daten.stueck.vermisst_seit).toBeNull();
    const liste = await admin.get("/inventur");
    expect(liste.daten[0]).toMatchObject({ platz: { pfad: "Lager › Regal 1" }, fehlend: 1, benutzer: "Chef Admin" });

    // Rückgängig der Inventur-Buchung
    expect((await admin.post("/buchungen/rueckgaengig", { vorgang_id: r.daten.vorgang_id })).daten.zurueck).toBe(1);
  });

  it("ohne Umbuchen und ohne Vermisst-Meldung", async () => {
    const { admin, r1, ids } = await aufbau();
    const r = await admin.post("/inventur", {
      platz_id: r1.id,
      gefunden_ids: [ids["A-1"]],
      zusaetzliche_buchen: false,
      fehlende_vermisst: false,
    });
    expect(r.daten).toMatchObject({ erwartet: 3, gefunden: 1, fehlend: 2, vorgang_id: null });
    expect((await admin.get("/uebersicht")).daten.vermisst).toBe(0);
  });
});

describe("Bestand exportieren", () => {
  it("CSV mit Filter, Platz und Ausleihe", async () => {
    const { admin, r1, ids } = await aufbau();
    await admin.post("/ausleihen", { stueck_ids: [ids["A-1"]], an: "Anna", bis: "2030-12-24" });
    const alle = await admin.get(`/stuecke/csv?platz=${r1.id}`);
    expect(alle.res.headers.get("content-type")).toContain("text/csv");
    const zeilen = (alle.daten as string).trim().split("\r\n");
    expect(zeilen).toHaveLength(4);
    expect(zeilen[0]).toContain("Code;Name;Kategorie;Status;Platz");
    expect(zeilen.find((z) => z.startsWith("A-1"))).toContain("Anna;24.12.2030");
    const verliehen = await admin.get("/stuecke/csv?merkmal=verliehen");
    expect((verliehen.daten as string).trim().split("\r\n")).toHaveLength(2);
  });
});
