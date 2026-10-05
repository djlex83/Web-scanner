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
  {
    version: 2,
    sql: [
      // Fotos: ein Foto je Stück, groß (Detail) und klein (Listen); foto_version für Cache-URLs
      `ALTER TABLE stuecke ADD COLUMN foto_version INTEGER`,
      `CREATE TABLE fotos (
        stueck_id INTEGER PRIMARY KEY REFERENCES stuecke(id),
        bild BLOB NOT NULL,
        bild_typ TEXT NOT NULL,
        vorschau BLOB NOT NULL,
        vorschau_typ TEXT NOT NULL,
        groesse INTEGER NOT NULL,
        benutzer_id INTEGER REFERENCES benutzer(id),
        erstellt_am TEXT NOT NULL
      )`,
      // Eigene Symbole/Farben je Kategorie (sonst automatisch aus dem Namen)
      `CREATE TABLE kategorien (
        name TEXT PRIMARY KEY COLLATE NOCASE,
        symbol TEXT NOT NULL,
        farbe TEXT NOT NULL,
        geaendert_am TEXT NOT NULL
      )`,
    ],
  },
  {
    version: 3,
    sql: [
      // Inventur: 1 = Stück wird bei der Inventur erwartet, 0 = nicht inventurpflichtig
      `ALTER TABLE stuecke ADD COLUMN inventur INTEGER NOT NULL DEFAULT 1`,
      `ALTER TABLE stuecke ADD COLUMN vermisst_seit TEXT`,
      // Behälter (Kiste): ein Stück, in dem andere Stücke liegen; Inhalt wandert beim Umbuchen mit
      `ALTER TABLE stuecke ADD COLUMN behaelter INTEGER NOT NULL DEFAULT 0`,
      `ALTER TABLE stuecke ADD COLUMN in_behaelter_id INTEGER REFERENCES stuecke(id)`,
      // Prüfung und Wartung: Art, Intervall in Monaten, nächster Termin (JJJJ-MM-TT)
      `ALTER TABLE stuecke ADD COLUMN pruef_art TEXT`,
      `ALTER TABLE stuecke ADD COLUMN pruef_intervall INTEGER`,
      `ALTER TABLE stuecke ADD COLUMN pruef_naechste TEXT`,
      `CREATE INDEX stuecke_behaelter ON stuecke(in_behaelter_id)`,
      `CREATE INDEX stuecke_pruefung ON stuecke(pruef_naechste) WHERE pruef_naechste IS NOT NULL`,
      `CREATE INDEX stuecke_vermisst ON stuecke(vermisst_seit) WHERE vermisst_seit IS NOT NULL`,
      `ALTER TABLE buchungen ADD COLUMN von_behaelter_id INTEGER REFERENCES stuecke(id)`,
      `ALTER TABLE buchungen ADD COLUMN nach_behaelter_id INTEGER REFERENCES stuecke(id)`,
      // 1 = Stück wurde mit seinem Behälter mitbewegt (wird beim Rückgängigmachen übersprungen)
      `ALTER TABLE buchungen ADD COLUMN mitgefuehrt INTEGER NOT NULL DEFAULT 0`,
      `CREATE INDEX buchungen_vorgang ON buchungen(vorgang_id)`,
      `CREATE TABLE ausleihen (
        id INTEGER PRIMARY KEY,
        stueck_id INTEGER NOT NULL REFERENCES stuecke(id),
        an TEXT NOT NULL,
        bis TEXT,
        notiz TEXT,
        benutzer_id INTEGER NOT NULL REFERENCES benutzer(id),
        ausgegeben_am TEXT NOT NULL,
        zurueck_am TEXT,
        zurueck_von_id INTEGER REFERENCES benutzer(id)
      )`,
      // Ein Stück kann nur einmal gleichzeitig verliehen sein
      `CREATE UNIQUE INDEX ausleihen_offen ON ausleihen(stueck_id) WHERE zurueck_am IS NULL`,
      `CREATE INDEX ausleihen_zeit ON ausleihen(ausgegeben_am)`,
      `CREATE TABLE pruefungen (
        id INTEGER PRIMARY KEY,
        stueck_id INTEGER NOT NULL REFERENCES stuecke(id),
        datum TEXT NOT NULL,
        ergebnis TEXT NOT NULL CHECK (ergebnis IN ('bestanden','mangel','nicht_bestanden')),
        notiz TEXT,
        naechste TEXT,
        benutzer_id INTEGER NOT NULL REFERENCES benutzer(id),
        erfasst_am TEXT NOT NULL
      )`,
      `CREATE INDEX pruefungen_stueck ON pruefungen(stueck_id, datum)`,
      `CREATE TABLE inventuren (
        id INTEGER PRIMARY KEY,
        platz_id INTEGER NOT NULL REFERENCES plaetze(id),
        benutzer_id INTEGER NOT NULL REFERENCES benutzer(id),
        zeitpunkt TEXT NOT NULL,
        erwartet INTEGER NOT NULL,
        gefunden INTEGER NOT NULL,
        fehlend INTEGER NOT NULL,
        zusaetzlich INTEGER NOT NULL,
        verliehen INTEGER NOT NULL,
        details_json TEXT
      )`,
      `CREATE INDEX inventuren_platz ON inventuren(platz_id, zeitpunkt)`,
      // Prüfnachweise und Inventuren sind wie das Protokoll unveränderbar
      `CREATE TRIGGER pruefungen_kein_aendern BEFORE UPDATE ON pruefungen
        BEGIN SELECT RAISE(ABORT, 'Pruefungen sind unveraenderbar'); END`,
      `CREATE TRIGGER pruefungen_kein_loeschen BEFORE DELETE ON pruefungen
        BEGIN SELECT RAISE(ABORT, 'Pruefungen sind unveraenderbar'); END`,
      `CREATE TRIGGER inventuren_kein_aendern BEFORE UPDATE ON inventuren
        BEGIN SELECT RAISE(ABORT, 'Inventuren sind unveraenderbar'); END`,
      `CREATE TRIGGER inventuren_kein_loeschen BEFORE DELETE ON inventuren
        BEGIN SELECT RAISE(ABORT, 'Inventuren sind unveraenderbar'); END`,
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
