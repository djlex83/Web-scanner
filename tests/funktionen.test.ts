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

describe("Einrichtung einer neuen Datenbank", () => {
  it("verteilt viele Migrationen auf mehrere Aufrufe", async () => {
    const { schemaVergessen } = await import("../src/worker/db/migrationen");
    const { Client } = await import("./hilfen");
    const { results } = await env.DB.prepare(
      "SELECT name FROM sqlite_master WHERE type = 'table' AND name NOT LIKE 'sqlite_%' AND name NOT LIKE '_cf_%'",
    ).all<{ name: string }>();
    for (const r of results) await env.DB.prepare(`DROP TABLE IF EXISTS "${r.name}"`).run();
    schemaVergessen();
    const gast = new Client();
    const erster = await gast.get("/auth/einrichten");
    expect(erster.status).toBe(503);
    expect(erster.daten.fehler).toContain("neu laden");
    // jeder Aufruf spielt einen Teil ein; die App wiederholt bis zu 4-mal
    let versuche = 1;
    let r = erster;
    while (r.status === 503 && versuche < 5) (r = await gast.get("/auth/einrichten")), versuche++;
    expect(r.daten).toEqual({ noetig: true });
    expect(versuche).toBeLessThanOrEqual(4);
  });
});

describe("Stammplatz und Zurückräumen", () => {
  it("erster Ort wird Stammplatz; Zurückräumen bucht jedes Stück an seinen eigenen Stammplatz", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const leiter = (await admin.post("/stuecke", { code: "L-1", name: "Leiter", platz_id: r2.id })).daten;
    const neu = (await admin.post("/stuecke", { code: "N-1", name: "Ohne Platz" })).daten;
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck).toMatchObject({ stammplatz: { id: r1.id }, am_stammplatz: true });
    expect(neu.am_stammplatz).toBeNull();

    // alles durcheinander: A-1, A-2 nach Regal 2, Leiter nach Regal 1
    await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"], ids["A-2"]] });
    await admin.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [leiter.id] });
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck).toMatchObject({ stammplatz: { id: r1.id }, am_stammplatz: false });
    expect((await admin.get("/uebersicht")).daten.nicht_am_stammplatz).toBe(3);
    expect((await admin.get("/stuecke?merkmal=fremd")).daten.eintraege).toHaveLength(3);

    const r = await admin.post("/buchungen/zurueckraeumen", { stueck_ids: [ids["A-1"], ids["A-2"], ids["A-3"], leiter.id, neu.id] });
    expect(r.status).toBe(200);
    expect(r.daten).toMatchObject({ gebucht: 3, schon_dort: 1, ohne_stammplatz: [{ name: "Ohne Platz" }] });
    expect((await admin.get(`/stuecke/${leiter.id}`)).daten.stueck.platz.id).toBe(r2.id);
    expect((await admin.get(`/stuecke/${ids["A-2"]}`)).daten.stueck.platz.id).toBe(r1.id);
    expect((await admin.get("/uebersicht")).daten.nicht_am_stammplatz).toBe(0);
    expect((await admin.get("/protokoll")).daten.eintraege[0]).toMatchObject({ aktion: "zurueckgeraeumt" });

    // Rückgängig bringt alles wieder durcheinander, Stammplatz bleibt
    await admin.post("/buchungen/rueckgaengig", { vorgang_id: r.daten.vorgang_id });
    expect((await admin.get(`/stuecke/${leiter.id}`)).daten.stueck).toMatchObject({ platz: { id: r1.id }, stammplatz: { id: r2.id } });
  });

  it("Stammplatz in einem Behälter: zurück in die Kiste, egal wo sie gerade steht", async () => {
    const { admin, r1, r2 } = await aufbau();
    const kiste = (await admin.post("/stuecke", { name: "Kiste", behaelter: true, platz_id: r1.id })).daten;
    const zange = (await admin.post("/stuecke", { code: "Z-1", name: "Zange", in_behaelter_id: kiste.id })).daten;
    expect(zange).toMatchObject({ stamm_behaelter: { id: kiste.id }, am_stammplatz: true });
    await admin.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [zange.id] });
    await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [kiste.id] });
    const r = await admin.post("/buchungen/zurueckraeumen", { stueck_ids: [zange.id] });
    expect(r.daten.gebucht).toBe(1);
    expect((await admin.get(`/stuecke/${zange.id}`)).daten.stueck).toMatchObject({ in_behaelter: { id: kiste.id }, platz: { id: r2.id }, am_stammplatz: true });
  });

  it("Stammplatz neu festlegen: beim Einlagern, aktueller Ort, entfernen; Rechte", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    const leser = await benutzerMit(admin, "lea", "leser");
    const ma = await benutzerMit(admin, "mia", "mitarbeiter");
    // Einlagern mit „neuer Stammplatz“ – auch für Stücke, die schon dort liegen
    await ma.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"]], stammplatz: true });
    await ma.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [ids["A-2"]], stammplatz: true });
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck).toMatchObject({ stammplatz: { id: r2.id }, am_stammplatz: true });
    // ohne Haken bleibt der Stammplatz
    await ma.post("/buchungen", { nach_platz_id: r1.id, stueck_ids: [ids["A-1"]] });
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck.stammplatz.id).toBe(r2.id);

    expect((await leser.post("/stuecke/stammplatz", { stueck_ids: [ids["A-1"]], aktuell: true })).status).toBe(403);
    const akt = await ma.post("/stuecke/stammplatz", { stueck_ids: [ids["A-1"]], aktuell: true });
    expect(akt.daten[0]).toMatchObject({ stammplatz: { id: r1.id }, am_stammplatz: true });
    const weg = await ma.post("/stuecke/stammplatz", { stueck_ids: [ids["A-1"]] });
    expect(weg.daten[0]).toMatchObject({ stammplatz: null, am_stammplatz: null });
    expect((await ma.post("/stuecke/stammplatz", { stueck_ids: [ids["A-1"]], platz_id: r1.id, aktuell: true })).status).toBe(400);
  });

  it("vorhandene Stücke bekommen beim Update ihren ersten Lagerplatz als Stammplatz", async () => {
    const { admin, r1, r2, ids } = await aufbau();
    await admin.post("/buchungen", { nach_platz_id: r2.id, stueck_ids: [ids["A-1"]] });
    // Zustand vor dem Update nachstellen und die Migration erneut ausführen
    await env.DB.prepare("UPDATE stuecke SET stamm_platz_id = NULL, stamm_behaelter_id = NULL").run();
    const { MIGRATIONEN } = await import("../src/worker/db/migrationen");
    for (const sql of MIGRATIONEN.find((m) => m.version === 4)!.sql.filter((q) => q.trim().startsWith("UPDATE"))) {
      await env.DB.prepare(sql).run();
    }
    expect((await admin.get(`/stuecke/${ids["A-1"]}`)).daten.stueck).toMatchObject({ stammplatz: { id: r1.id }, am_stammplatz: false });
  });
});

describe("Prüfung: 1 Jahr Standard und Löschen", () => {
  it("nächster Termin: ohne Intervall 1 Jahr, mit Intervall dieses, null = keiner", async () => {
    const { admin, ids } = await aufbau();
    const a = await admin.post("/pruefungen", { stueck_id: ids["A-1"], datum: "2026-03-15", ergebnis: "bestanden" });
    expect(a.daten.pruefung.naechste).toBe("2027-03-15");
    await admin.patch(`/stuecke/${ids["A-2"]}`, { pruef_intervall: 6 });
    const b = await admin.post("/pruefungen", { stueck_id: ids["A-2"], datum: "2026-03-15", ergebnis: "bestanden" });
    expect(b.daten.pruefung.naechste).toBe("2026-09-15");
    const c = await admin.post("/pruefungen", { stueck_id: ids["A-3"], datum: "2026-03-15", ergebnis: "bestanden", naechste: null });
    expect(c.daten.pruefung.naechste).toBeNull();
  });

  it("löschen nur ab Leitung, verschwindet aus der Liste, Termin springt zurück, Nachweis bleibt", async () => {
    const { admin, ids } = await aufbau();
    const ma = await benutzerMit(admin, "mia", "mitarbeiter");
    const leitung = await benutzerMit(admin, "leo", "leitung");
    await admin.patch(`/stuecke/${ids["A-1"]}`, { pruef_art: "Elektroprüfung", pruef_naechste: "2026-01-01" });
    await ma.post("/pruefungen", { stueck_id: ids["A-1"], datum: "2025-12-20", ergebnis: "bestanden" });
    await ma.post("/pruefungen", { stueck_id: ids["A-1"], datum: "2026-02-01", ergebnis: "mangel" });
    let detail = (await admin.get(`/stuecke/${ids["A-1"]}`)).daten;
    expect(detail.stueck.pruefung.naechste).toBe("2027-02-01");
    const [neueste, aeltere] = detail.pruefungen;

    expect((await ma.post(`/pruefungen/${neueste.id}/loeschen`, { grund: "versehentlich" })).status).toBe(403);
    const r = await leitung.post(`/pruefungen/${neueste.id}/loeschen`, { grund: "versehentlich doppelt" });
    expect(r.daten).toEqual({ geloescht: true, pruef_naechste: "2026-12-20" });
    detail = (await admin.get(`/stuecke/${ids["A-1"]}`)).daten;
    expect(detail.pruefungen.map((p: any) => p.id)).toEqual([aeltere.id]);
    expect(detail.stueck.pruefung.naechste).toBe("2026-12-20");
    expect((await leitung.post(`/pruefungen/${neueste.id}/loeschen`, {})).status).toBe(409);

    // ältere löschen ändert den Termin nicht mehr, wenn sie nicht die neueste ist – hier ist sie es jetzt
    const r2 = await admin.post(`/pruefungen/${aeltere.id}/loeschen`, {});
    expect(r2.daten.pruef_naechste).toBe("2026-01-01");

    const prot = (await admin.get("/protokoll")).daten.eintraege;
    expect(prot[1]).toMatchObject({ aktion: "pruefung_geloescht" });
    expect(prot[1].text).toContain("versehentlich doppelt");
    // Nachweis bleibt, Inhalt bleibt unveränderbar
    const roh = await env.DB.prepare("SELECT COUNT(*) AS n FROM pruefungen WHERE geloescht_am IS NOT NULL").first<{ n: number }>();
    expect(roh?.n).toBe(2);
    await expect(env.DB.prepare("UPDATE pruefungen SET ergebnis = 'bestanden'").run()).rejects.toThrow(/unveraenderbar/);
    await expect(env.DB.prepare("UPDATE pruefungen SET geloescht_am = NULL").run()).rejects.toThrow(/unveraenderbar/);
    await expect(env.DB.prepare("DELETE FROM pruefungen").run()).rejects.toThrow(/unveraenderbar/);
  });
});

describe("Teilweise ändern", () => {
  it("nicht mitgeschickte Felder bleiben erhalten, leere werden gelöscht", async () => {
    const { admin, r1, ids } = await aufbau();
    await admin.patch(`/stuecke/${ids["A-1"]}`, { kategorie: "Werkzeug", beschreibung: "mit Koffer", pruef_art: "Elektroprüfung" });
    const nurTermin = await admin.patch(`/stuecke/${ids["A-1"]}`, { pruef_naechste: "2027-01-01" });
    expect(nurTermin.daten).toMatchObject({ kategorie: "Werkzeug", beschreibung: "mit Koffer", pruefung: { art: "Elektroprüfung", naechste: "2027-01-01" } });
    const leer = await admin.patch(`/stuecke/${ids["A-1"]}`, { beschreibung: "" });
    expect(leer.daten).toMatchObject({ kategorie: "Werkzeug", beschreibung: null });

    await admin.patch(`/plaetze/${r1.id}`, { notiz: "hinten links" });
    expect((await admin.patch(`/plaetze/${r1.id}`, { name: "Regal Eins" })).daten).toMatchObject({ name: "Regal Eins", notiz: "hinten links" });
  });
});
