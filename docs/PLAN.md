# Web Scanner – Projektplan

Stand: 05.10.2026 · Status: **Phasen 0–5 umgesetzt** (siehe Abschnitt 9), Ideenliste zur Auswahl (Abschnitt 10)

## 1. Ziel

Eine Web-App, die auf **Cloudflare** läuft und im Browser (Handy, Tablet, PC) **Strichcodes und QR-Codes** liest.

- **Mehrere Codes nacheinander oder gleichzeitig scannen** und sofort sehen, **wo sich jedes Stück gerade befindet**.
- **Stücke umbuchen**: Ziel-Platz scannen, dann beliebig viele Stücke scannen, mit einem Tipp bestätigen.
- **Lückenloses Protokoll**: Jede Buchung und jede Änderung wird gespeichert (wer, was, wann, von wo nach wo). Einträge können nicht geändert oder gelöscht werden.
- **Eigene Konten für alle Benutzer** mit unterschiedlichen **Benutzerebenen** (Rollen).

## 2. Entscheidungen

| Frage | Entscheidung |
|---|---|
| Was wird verwaltet? | **Einzelstücke** – jedes Stück hat einen eigenen Strichcode. Keine Mengenartikel. |
| Codes | Stücke haben **bereits Strichcodes**; die App übernimmt jeden lesbaren Code als Kennung. Lagerplätze bekommen **eigene QR-Codes aus der App**. |
| Plätze | Gibt es noch nicht im System, werden **nachträglich in der App angelegt**: **Abteilung → Regal** (optional Fach). |
| Datenschutz | Keine besonderen Auflagen. |
| Kosten | **Nur kostenloser Cloudflare-Tarif**, keine kostenpflichtigen Funktionen. |

## 3. Architektur

```
Handy / Tablet / PC (Browser, als App installierbar – PWA)
  └─ Frontend: React + Vite + TypeScript
       ├─ Kamera-Scanner (BarcodeDetector-API, Ersatz per WebAssembly)
       ├─ Handscanner (USB/Bluetooth, tippt wie eine Tastatur)
       └─ manuelle Eingabe
            │  HTTPS, Sitzungs-Cookie
            ▼
Cloudflare Worker (eine Anwendung: liefert Frontend + API)
  ├─ API mit Hono (TypeScript)
  ├─ Anmeldung, Rollenprüfung bei JEDER Anfrage auf dem Server
  └─ Cloudflare D1 (SQLite-Datenbank): Benutzer, Stücke, Plätze, Buchungen, Protokoll
     Schema spielt der Worker beim ersten Aufruf selbst ein (kein extra Schritt beim Veröffentlichen)
```

| Baustein | Wahl | Begründung |
|---|---|---|
| Hosting | **Cloudflare Workers mit statischen Assets** | Frontend und API in einem Projekt, HTTPS automatisch (nötig für die Kamera) |
| API | **Hono** | klein, für Workers gebaut, TypeScript |
| Datenbank | **Cloudflare D1** (SQLite) | Stücke ↔ Plätze ↔ Buchungen sind relationale Daten; Transaktionen per `batch`; Time Travel 7 Tage im kostenlosen Tarif |
| Sicherung | D1 **Time Travel** + JSON-Download für Admins | R2 muss im Dashboard gesondert aktiviert werden – vorerst nicht nötig; tägliche R2-Sicherung bleibt als Erweiterung möglich |
| Scannen | **BarcodeDetector-API** mit Paket `barcode-detector` als Ersatz (zxing-cpp als WebAssembly) | auf Android-Chrome eingebaut; auf iPhone/Safari und Windows-Chrome übernimmt der Ersatz; erkennt mehrere Codes in einem Bild |
| Frontend | **React + Vite + TypeScript**, PWA | auf dem Handy als App installierbar |
| Tests | **Vitest** mit `@cloudflare/vitest-pool-workers`, **Playwright** | testet API gegen echtes D1 lokal |
| Auslieferung | GitHub Actions → `wrangler deploy` | Push auf `main` = neue Version unter `*.workers.dev` |

**Grenzen des kostenlosen Tarifs** (reichen für einen Betrieb mit einigen Tausend Stücken und Dutzenden Benutzern deutlich): Workers 100 000 Anfragen/Tag · D1 5 GB, 5 Mio. gelesene und 100 000 geschriebene Zeilen pro Tag · R2 10 GB. Die App wird sparsam gebaut (Mehrfach-Abfrage in einer Anfrage, Indizes), damit die Grenzen nicht erreicht werden.

## 4. Scannen

- **Kamera** (Rückkamera, Taschenlampe ein/aus, Zoom wo verfügbar).
- **Formate:** Code 128, Code 39, EAN-13/EAN-8, UPC, ITF, QR, DataMatrix. Sobald feststeht, welche Formate auf den Stücken kleben, werden nur diese gesucht (schneller, weniger Fehlerkennungen).
- **Mehrfach-Scan:** Die Kamera bleibt offen; jeder erkannte Code landet in einer Liste. Doppelte Codes werden ignoriert. Rückmeldung per Ton, Vibration und grünem Rahmen. Mehrere Codes im selben Bild werden alle übernommen.
- **Handscanner** (USB/Bluetooth im Tastaturmodus) und **manuelle Eingabe** als gleichwertige Wege.
- **Platz oder Stück?** Platz-Etiketten aus der App tragen ein Präfix (`PLATZ:A03-R12`). Alles andere ist ein Stück. So weiß die App automatisch, was gescannt wurde.
- **Etiketten drucken:** QR-Etiketten für Regale (und Abteilungen) als druckfertige Seite, einzeln oder als Sammeldruck aller Regale einer Abteilung.

## 5. Abläufe

1. **„Wo ist?“ – Abfrage:** Codes scannen → Liste mit Abteilung/Regal, zuletzt bewegt von wem und wann. Unbekannte Codes sind rot markiert; mit Berechtigung direkt „Neu anlegen“.
2. **Erst-Erfassung** (in der App Teil von „Einlagern“): Regal-Etikett scannen → alle Stücke im Regal nacheinander scannen → unbekannte Stücke werden mit Name/Kategorie angelegt und gleich diesem Regal zugeordnet. So wird der Bestand Regal für Regal ins System gebracht.
3. **Umbuchen:** Ziel-Regal scannen → Stücke scannen → Übersicht „12 Stücke nach Montage / Regal 12“ → Bestätigen. Alle Buchungen in **einer Transaktion** (alles oder nichts).
4. **Regal-Inhalt:** Regal scannen → alles, was laut System dort liegt.
5. **Verlauf eines Stücks:** alle Bewegungen mit Zeit, Benutzer, von → nach.

## 6. Benutzer und Rollen

Jeder Benutzer hat ein **eigenes Konto**. Keine Selbstregistrierung: Admins legen Benutzer an.

| Rolle | Darf |
|---|---|
| **Leser** | scannen und abfragen („Wo ist?“, Regal-Inhalt), Verlauf ansehen |
| **Mitarbeiter** | + Stücke umbuchen, neue Stücke erfassen; eigenes Protokoll ansehen |
| **Leitung** | + Abteilungen und Regale anlegen/ändern, Stücke bearbeiten/ausmustern, Etiketten drucken, komplettes Protokoll ansehen und exportieren (CSV) |
| **Admin** | + Benutzer anlegen, sperren, Rollen vergeben, Passwörter zurücksetzen, Einstellungen |

Die Rollen werden **auf dem Server** bei jeder Anfrage geprüft; die Oberfläche blendet nur zusätzlich aus, was jemand nicht darf.

**Anmeldung:** eigene Benutzerverwaltung im Worker (kostenlos, keine Fremddienste).
- Benutzername + Passwort; Passwörter mit PBKDF2-SHA256 (WebCrypto) und eigenem Salt gehasht. 20 000 Runden, damit das Anmelden in die 10 ms CPU des kostenlosen Tarifs passt; im bezahlten Tarif per `PBKDF2_RUNDEN` bis 100 000.
- Sitzung als zufälliges Token; in der Datenbank nur der Hash. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, Ablauf nach Inaktivität.
- Konto-Sperre nach mehreren Fehlversuchen (in D1 gezählt).
- Der **erste Admin** wird beim allerersten Aufruf der App im Browser angelegt (nur möglich, solange es keinen Benutzer gibt) – kein Standardpasswort im Code.

## 7. Datenmodell (D1)

```
benutzer      id, benutzername, name, rolle, passwort_hash, salt, aktiv,
              fehlversuche, gesperrt_bis, erstellt_am, letzte_anmeldung
sitzungen     id, benutzer_id, token_hash, erstellt_am, laeuft_ab, geraet
plaetze       id, code (eindeutig), name, typ (Abteilung/Regal/Fach),
              eltern_id (Regal → Abteilung), aktiv
stuecke       id, code (eindeutig, vorhandener Strichcode), name, beschreibung, kategorie,
              platz_id (aktueller Platz), status (vorhanden/defekt/ausgemustert),
              erstellt_am, geaendert_am
buchungen     id, stueck_id, von_platz_id, nach_platz_id, art (erfassen/umbuchen/
              ausmustern), benutzer_id, zeitpunkt, notiz, vorgang_id
protokoll     id, zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id,
              vorher_json, nachher_json, geraet
```

- **Protokoll unveränderbar:** Die API kennt kein Ändern/Löschen für `protokoll` und `buchungen`; zusätzlich verhindern SQLite-Trigger `UPDATE`/`DELETE` auf diesen Tabellen.
- **Nichts wird gelöscht:** Stücke, Plätze und Benutzer werden deaktiviert bzw. ausgemustert, damit alte Protokolleinträge lesbar bleiben.
- **Korrektur statt Löschen:** Eine falsche Buchung wird durch eine Gegenbuchung rückgängig gemacht; beide stehen im Protokoll.
- `vorgang_id` fasst eine Mehrfach-Buchung zusammen („12 Stücke um 14:03 nach Regal 12“).
- Indizes auf `code`, `platz_id`, `stueck_id`, `benutzer_id`, `zeitpunkt`.
- Migrationen versioniert unter `migrations/` (`wrangler d1 migrations`).

## 8. Projektstruktur

```
web-scanner/
├─ src/
│  ├─ worker/          API (Hono): routen/, auth/, db/, rechte.ts
│  ├─ app/             Frontend (React): seiten/, scanner/, komponenten/
│  └─ gemeinsam/       Typen und Prüfregeln (zod), von Frontend und API genutzt
├─ migrations/         D1-Schema, nummeriert
├─ tests/              Vitest (API, Logik), Playwright (Abläufe)
├─ scripts/            admin:anlegen, Testdaten
├─ docs/               dieser Plan, Entscheidungen, Betrieb
├─ wrangler.jsonc      Cloudflare-Konfiguration (ohne Secrets)
└─ .github/workflows/  prüfen, testen, ausliefern
```

Secrets (Cloudflare-API-Token, Account-ID) liegen nur in GitHub-Secrets bzw. Cloudflare, nie im Repository.

## 9. Umsetzungsphasen

| Phase | Inhalt | Fertig, wenn … | Stand |
|---|---|---|---|
| **0 Grundgerüst** | Vite + React + Hono + Wrangler, D1 lokal, Tests, GitHub Actions, Auslieferung | `npm test` grün, App erreichbar unter `*.workers.dev` | ✅ gebaut; Veröffentlichung auf Cloudflare steht aus (README) |
| **1 Konten & Rollen** | Anmeldung, Sitzungen, Benutzerverwaltung, Rollenprüfung, erster Admin, Sperre bei Fehlversuchen | jede Rolle darf genau ihre Rechte (automatisch getestet) | ✅ |
| **2 Plätze** | Abteilungen und Regale anlegen, QR-Etiketten drucken | Regal-Etikett gedruckt und von Handy gelesen | ✅ (Test mit echtem Drucker/Handy steht aus) |
| **3 Scanner** | Kamera-Mehrfach-Scan, Foto, Handscanner, manuelle Eingabe | iPhone + Android lesen die vorhandenen Strichcodes zuverlässig, 10 Codes in < 20 s | ✅ (mit simulierter Kamera getestet; Test mit echten Etiketten steht aus) |
| **4 Erfassen, Abfragen, Buchen** | Erst-Erfassung je Regal, „Wo ist?“, Umbuchen, Regal-Inhalt, Verlauf | ein Regal mit 30 Stücken in < 5 min erfasst; Umbuchung alles oder nichts | ✅ |
| **5 Protokoll** | Protokollansicht mit Filtern (Person, Zeitraum), CSV-Export, Unveränderbarkeit | jede Änderung erscheint im Protokoll; Ändern/Löschen technisch unmöglich | ✅ |
| **6 Absicherung** | Sicherung (Time Travel + JSON-Download), Wiederherstellungstest | Wiederherstellung einmal erfolgreich geprobt | teilweise: Download da, Wiederherstellung noch nicht geprobt |
| **7 Erweiterungen** | ausgewählte Ideen aus Abschnitt 10 | nach Auswahl | offen |

**Umgesetzt aus der Ideenliste:** Foto vom Regal (alle Codes auf einmal), Suche ohne Scan, Startseite mit Zahlen, Status „defekt“.

## 10. Weitere Ideen (zur Auswahl)

Alle Ideen funktionieren im kostenlosen Tarif.

**Im Alltag schneller**
- **Foto vom Regal** statt Einzelscan: ein Bild mit vielen Etiketten → alle Codes darin werden auf einmal erkannt.
- **Suche ohne Scan:** nach Name, Kategorie oder Teil des Codes.
- **Schnellwechsel am geteilten Gerät:** Tablet im Lager bleibt angemeldet, Benutzer wechseln per persönlicher PIN; Buchung läuft trotzdem auf die richtige Person.
- **Rückgängig** der letzten Buchung per Knopf (als Gegenbuchung).
- **Große Knöpfe, Dunkelmodus**, bedienbar mit Handschuhen.

**Mehr Überblick**
- **Startseite mit Zahlen:** Stücke je Abteilung, letzte Bewegungen, Stücke ohne Platz.
- **Ladenhüter:** Stücke, die seit X Monaten nicht bewegt wurden.
- **Vermisst-Liste:** Stück als vermisst markieren; wer es irgendwo scannt, bekommt sofort einen Hinweis „Gefunden! Hier buchen?“.
- **Inventur je Regal:** Regal scannen, alles scannen, was drin liegt → Liste „fehlt / zusätzlich / gehört woanders hin“, mit einem Tipp korrigieren.

**Mehr Informationen am Stück**
- **Fotos** zu Stücken (R2), damit man weiß, wonach man sucht.
- **Zustand melden:** „defekt“ mit Foto und Notiz; Liste aller defekten Stücke.
- **Prüf- und Wartungstermine** (z. B. Prüfung elektrischer Geräte, Kalibrierung) mit Fälligkeitsliste und Hinweis beim Scannen „Prüfung überfällig“.
- **Eigene Felder** je Kategorie (z. B. Seriennummer, Hersteller, Kaufdatum).

**Ausleihe**
- **An Person ausgeben** mit Rückgabedatum; Liste „überfällig“; Rückgabe per Scan.
- **Reservieren:** Stück für einen Termin vormerken.

**Daten rein und raus**
- **Excel-/CSV-Import** vorhandener Listen (Stücke mit Code, Name, Platz).
- **Excel-/CSV-Export** von Bestand, Protokoll, Regal-Inhalt.

**Technik**
- **Offline-Modus:** In Bereichen ohne Netz weiterscannen; Buchungen werden auf dem Gerät gesammelt und bei Netz automatisch übertragen.
- **Behälter:** Kisten bekommen einen eigenen Code; Kiste umbuchen bewegt alles darin mit.

## 11. Offene Fragen

1. Welche **Strichcode-Art** kleben auf den Stücken (Foto eines Etiketts genügt)? Die App liest alle gängigen; mit einem echten Etikett testen.
2. Braucht es unter dem Regal noch **Fächer**? (In der App schon möglich, aber optional.)
3. Passen die vier **Rollen** (Leser, Mitarbeiter, Leitung, Admin)?
4. **Geräte:** Handys (iPhone/Android), Tablets, Handscanner?
5. **Cloudflare-Konto** anlegen und das Repository verbinden (Anleitung im README) – ein API-Token ist dafür nicht nötig.
