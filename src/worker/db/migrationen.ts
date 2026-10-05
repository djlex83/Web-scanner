// Datenbankschema. Der Worker spielt fehlende Migrationen beim ersten Zugriff selbst ein,
// damit "wrangler deploy" (bzw. Cloudflare Workers Builds) ohne weiteren Schritt reicht.
// Neue Änderungen immer als NEUE Migration anhängen, nie bestehende ändern.

export const MIGRATIONEN: { version: number; sql: string[] }[] = [
  {
    version: 1,
    sql: [
      `CREATE TABLE benutzer (
        id INTEGER PRIMARY KEY,
        benutzername TEXT NOT NULL UNIQUE COLLATE NOCASE,
        name TEXT NOT NULL,
        rolle TEXT NOT NULL CHECK (rolle IN ('leser','mitarbeiter','leitung','admin')),
        passwort_hash TEXT NOT NULL,
        aktiv INTEGER NOT NULL DEFAULT 1,
        passwort_aendern INTEGER NOT NULL DEFAULT 0,
        fehlversuche INTEGER NOT NULL DEFAULT 0,
        gesperrt_bis TEXT,
        erstellt_am TEXT NOT NULL,
        letzte_anmeldung TEXT
      )`,
      `CREATE TABLE sitzungen (
        token_hash TEXT PRIMARY KEY,
        benutzer_id INTEGER NOT NULL REFERENCES benutzer(id),
        erstellt_am TEXT NOT NULL,
        laeuft_ab TEXT NOT NULL,
        dauer_sek INTEGER NOT NULL,
        geraet TEXT
      )`,
      `CREATE INDEX sitzungen_benutzer ON sitzungen(benutzer_id)`,
      `CREATE TABLE anmelde_drossel (
        schluessel TEXT PRIMARY KEY,
        anzahl INTEGER NOT NULL,
        fenster_start TEXT NOT NULL
      )`,
      `CREATE TABLE plaetze (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        typ TEXT NOT NULL CHECK (typ IN ('abteilung','regal','fach')),
        eltern_id INTEGER REFERENCES plaetze(id),
        notiz TEXT,
        aktiv INTEGER NOT NULL DEFAULT 1,
        erstellt_am TEXT NOT NULL
      )`,
      `CREATE INDEX plaetze_eltern ON plaetze(eltern_id)`,
      `CREATE TABLE stuecke (
        id INTEGER PRIMARY KEY,
        code TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        beschreibung TEXT,
        kategorie TEXT,
        platz_id INTEGER REFERENCES plaetze(id),
        status TEXT NOT NULL DEFAULT 'vorhanden' CHECK (status IN ('vorhanden','defekt','ausgemustert')),
        bewegt_am TEXT,
        bewegt_von_id INTEGER REFERENCES benutzer(id),
        erstellt_am TEXT NOT NULL,
        geaendert_am TEXT NOT NULL
      )`,
      `CREATE INDEX stuecke_platz ON stuecke(platz_id)`,
      `CREATE INDEX stuecke_name ON stuecke(name COLLATE NOCASE)`,
      `CREATE TABLE buchungen (
        id INTEGER PRIMARY KEY,
        vorgang_id TEXT NOT NULL,
        stueck_id INTEGER NOT NULL REFERENCES stuecke(id),
        von_platz_id INTEGER REFERENCES plaetze(id),
        nach_platz_id INTEGER REFERENCES plaetze(id),
        art TEXT NOT NULL CHECK (art IN ('erfassen','umbuchen')),
        benutzer_id INTEGER NOT NULL REFERENCES benutzer(id),
        zeitpunkt TEXT NOT NULL,
        notiz TEXT
      )`,
      `CREATE INDEX buchungen_stueck ON buchungen(stueck_id, zeitpunkt)`,
      `CREATE INDEX buchungen_zeit ON buchungen(zeitpunkt)`,
      `CREATE INDEX buchungen_benutzer ON buchungen(benutzer_id, zeitpunkt)`,
      `CREATE TABLE protokoll (
        id INTEGER PRIMARY KEY,
        zeitpunkt TEXT NOT NULL,
        benutzer_id INTEGER REFERENCES benutzer(id),
        aktion TEXT NOT NULL,
        objekt_typ TEXT NOT NULL,
        objekt_id INTEGER,
        text TEXT NOT NULL,
        vorher_json TEXT,
        nachher_json TEXT,
        geraet TEXT
      )`,
      `CREATE INDEX protokoll_zeit ON protokoll(zeitpunkt)`,
      `CREATE INDEX protokoll_benutzer ON protokoll(benutzer_id, zeitpunkt)`,
      `CREATE INDEX protokoll_objekt ON protokoll(objekt_typ, objekt_id)`,
      // Protokoll und Buchungen sind unveränderbar – auch für fehlerhaften Code.
      `CREATE TRIGGER protokoll_kein_aendern BEFORE UPDATE ON protokoll
        BEGIN SELECT RAISE(ABORT, 'Protokoll ist unveraenderbar'); END`,
      `CREATE TRIGGER protokoll_kein_loeschen BEFORE DELETE ON protokoll
        BEGIN SELECT RAISE(ABORT, 'Protokoll ist unveraenderbar'); END`,
      `CREATE TRIGGER buchungen_kein_aendern BEFORE UPDATE ON buchungen
        BEGIN SELECT RAISE(ABORT, 'Buchungen sind unveraenderbar'); END`,
      `CREATE TRIGGER buchungen_kein_loeschen BEFORE DELETE ON buchungen
        BEGIN SELECT RAISE(ABORT, 'Buchungen sind unveraenderbar'); END`,
    ],
  },
];

let bereit: Promise<void> | null = null;

/** Stellt sicher, dass das Schema aktuell ist (einmal je Worker-Instanz). */
export function schemaSicherstellen(db: D1Database): Promise<void> {
  bereit ??= migrieren(db).catch((e) => {
    bereit = null;
    throw e;
  });
  return bereit;
}

async function aktuelleVersion(db: D1Database): Promise<number> {
  await db
    .prepare(
      "CREATE TABLE IF NOT EXISTS schema_migrationen (version INTEGER PRIMARY KEY, eingespielt_am TEXT NOT NULL)",
    )
    .run();
  const zeile = await db
    .prepare("SELECT COALESCE(MAX(version), 0) AS v FROM schema_migrationen")
    .first<{ v: number }>();
  return zeile?.v ?? 0;
}

async function migrieren(db: D1Database): Promise<void> {
  const version = await aktuelleVersion(db);
  for (const m of MIGRATIONEN) {
    if (m.version <= version) continue;
    try {
      // batch = eine Transaktion: entweder ganz oder gar nicht
      await db.batch([
        ...m.sql.map((s) => db.prepare(s)),
        db
          .prepare("INSERT INTO schema_migrationen (version, eingespielt_am) VALUES (?, ?)")
          .bind(m.version, new Date().toISOString()),
      ]);
    } catch (e) {
      // Eine andere Instanz war schneller? Dann ist die Version jetzt eingespielt.
      if ((await aktuelleVersion(db)) >= m.version) continue;
      throw e;
    }
  }
}

/** Nur für Tests: nach dem Leeren der Datenbank Schema neu einspielen lassen. */
export function schemaVergessen(): void {
  bereit = null;
}
