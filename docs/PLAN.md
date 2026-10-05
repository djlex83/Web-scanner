# Web Scanner – Projektplan

Stand: 05.10.2026 · Status: **Entwurf, offene Fragen am Ende**

## 1. Ziel

Eine Web-App, die auf **Cloudflare** läuft und im Browser (Handy, Tablet, PC) **Strichcodes und QR-Codes** liest.

- **Mehrere Codes nacheinander oder gleichzeitig scannen** und sofort sehen, **wo sich jede Sache gerade befindet**.
- **Sachen umbuchen**: Ziel-Lagerplatz scannen, dann beliebig viele Sachen scannen, mit einem Tipp bestätigen.
- **Lückenloses Protokoll**: Jede Buchung und jede Änderung wird gespeichert (wer, was, wann, von wo nach wo). Einträge können nicht geändert oder gelöscht werden.
- **Eigene Konten für alle Benutzer** mit unterschiedlichen **Benutzerebenen** (Rollen).

## 2. Architektur

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
  ├─ Cloudflare D1 (SQLite-Datenbank): Benutzer, Sachen, Lagerorte, Buchungen, Protokoll
  ├─ Cloudflare R2: nächtliche Sicherung der Datenbank (Cron-Trigger)
  └─ Rate Limiting gegen Passwort-Raten
```

| Baustein | Wahl | Begründung |
|---|---|---|
| Hosting | **Cloudflare Workers mit statischen Assets** | Frontend und API in einem Projekt, HTTPS automatisch (nötig für die Kamera), weltweit schnell |
| API | **Hono** | klein, für Workers gebaut, TypeScript |
| Datenbank | **Cloudflare D1** (SQLite) | relationale Daten (Sachen ↔ Orte ↔ Buchungen) passen gut; Transaktionen per `batch`; Wiederherstellung per Time Travel (7 Tage kostenlos, 30 Tage im bezahlten Tarif) |
| Sicherung | **R2** + Cron-Trigger | tägliche Kopie zusätzlich zu Time Travel |
| Scannen | **BarcodeDetector-API** mit Paket `barcode-detector` als Ersatz (zxing-cpp als WebAssembly) | auf Android-Chrome eingebaut und schnell; auf iPhone/Safari und Windows-Chrome übernimmt der Ersatz; erkennt mehrere Codes in einem Bild |
| Frontend | **React + Vite + TypeScript**, PWA | auf dem Handy als App installierbar, später offline-fähig |
| Tests | **Vitest** mit `@cloudflare/vitest-pool-workers`, **Playwright** für Ende-zu-Ende | testet API gegen echtes D1 lokal |
| Auslieferung | GitHub Actions → `wrangler deploy` | Push auf `main` = neue Version; Vorschau-Umgebung für Tests |

**Kosten:** Für einen kleinen Betrieb reicht voraussichtlich der kostenlose Tarif (Workers 100 000 Anfragen/Tag, D1 5 GB, 5 Mio. gelesene und 100 000 geschriebene Zeilen pro Tag). Workers Paid (5 $/Monat) erst bei Bedarf, z. B. für 30 Tage Time Travel.

## 3. Scannen

- **Kamera** (Rückkamera, Taschenlampe ein/aus, Zoom wo verfügbar).
- **Formate:** QR, DataMatrix, EAN-13/EAN-8, UPC, Code 128, Code 39, ITF – konfigurierbar, damit nur benötigte Formate gesucht werden (schneller, weniger Fehlerkennungen).
- **Mehrfach-Scan:** Die Kamera bleibt offen; jeder erkannte Code landet in einer Liste. Doppelte Codes werden ignoriert. Rückmeldung per Ton, Vibration und grünem Rahmen. Mehrere Codes im selben Bild werden alle übernommen.
- **Handscanner** (USB/Bluetooth im Tastaturmodus) und **manuelle Eingabe** als gleichwertige Wege.
- **Code-Typ erkennen:** Lagerorte bekommen ein Präfix (z. B. `L-0042`), Sachen ein anderes (z. B. `S-001337`) oder einen vorhandenen Hersteller-Code. So weiß die App automatisch, ob ein Ort oder eine Sache gescannt wurde.
- **Etiketten drucken:** QR-/Strichcode-Etiketten für Sachen und Lagerorte als druckfertige PDF-Seite (Vorlage für gängige Etikettenbögen).

## 4. Abläufe

1. **„Wo ist?“ – Abfrage:** Codes scannen → Liste mit aktuellem Ort, zuletzt bewegt von wem und wann. Unbekannte Codes sind rot markiert; mit Berechtigung direkt „Neu anlegen“.
2. **Umbuchen:** Ziel-Ort scannen → Sachen scannen → Übersicht „12 Sachen nach Regal B3“ → Bestätigen. Alle Buchungen werden in **einer Transaktion** gespeichert (alles oder nichts).
3. **Einlagern / Entnehmen / Ausleihen:** wie Umbuchen, mit Buchungsart; „Ausleihen“ bucht auf eine Person oder ein Fahrzeug als besonderen Ort.
4. **Verlauf einer Sache:** alle Bewegungen mit Zeit, Benutzer, von → nach.
5. **Inventur** (spätere Phase): Ort scannen, alles scannen, was dort liegt → Abgleich „fehlt / zusätzlich gefunden / an falschem Ort“.

## 5. Benutzer und Rollen

Jeder Benutzer hat ein **eigenes Konto**. Es gibt **keine Selbstregistrierung**: Admins legen Benutzer an oder verschicken einen Einladungslink.

| Rolle | Darf |
|---|---|
| **Leser** | Codes scannen und abfragen („Wo ist?“), Verlauf ansehen |
| **Mitarbeiter** | + Sachen einlagern, umbuchen, entnehmen; eigenes Protokoll ansehen |
| **Leitung** | + Sachen und Lagerorte anlegen/ändern/deaktivieren, Etiketten drucken, komplettes Protokoll ansehen und exportieren (CSV) |
| **Admin** | + Benutzer anlegen, sperren, Rollen vergeben, Passwörter zurücksetzen, Einstellungen |

Die Rollen werden **auf dem Server** bei jeder Anfrage geprüft; die Oberfläche blendet nur zusätzlich aus, was jemand nicht darf.

**Anmeldung (Empfehlung):** eigene Benutzerverwaltung im Worker.
- Benutzername oder E-Mail + Passwort; Passwörter mit PBKDF2-SHA256 (WebCrypto, 100 000 Runden = Obergrenze in Workers) und eigenem Salt gehasht.
- Sitzung als zufälliges Token; in der Datenbank nur der Hash. Cookie `HttpOnly`, `Secure`, `SameSite=Strict`, Ablauf nach Inaktivität.
- Sperre nach mehreren Fehlversuchen + Cloudflare Rate Limiting.
- Später optional: Zwei-Faktor (TOTP-App) für Leitung/Admin, oder Anmeldung mit Microsoft-/Google-Konto.
- Alternative ohne eigenen Passwortcode: **Cloudflare Access** (Zero Trust, bis 50 Benutzer kostenlos) vor die App schalten; die Rollen blieben trotzdem in der App.

Der **erste Admin** wird einmalig per Befehl (`npm run admin:anlegen`) erstellt – kein Standardpasswort im Code.

## 6. Datenmodell (D1)

```
benutzer      id, benutzername, email, name, rolle, passwort_hash, salt, aktiv,
              fehlversuche, gesperrt_bis, erstellt_am, letzte_anmeldung
sitzungen     id, benutzer_id, token_hash, erstellt_am, laeuft_ab, ip, geraet
orte          id, code (eindeutig), name, typ (Standort/Lager/Regal/Fach/Person/Fahrzeug),
              eltern_id (Hierarchie), aktiv
sachen        id, code (eindeutig), name, beschreibung, kategorie,
              ort_id (aktueller Ort), status (vorhanden/ausgeliehen/defekt/ausgemustert),
              erstellt_am, geaendert_am
buchungen     id, sache_id, von_ort_id, nach_ort_id, art (einlagern/umbuchen/entnehmen/
              ausleihen/rueckgabe), benutzer_id, zeitpunkt, notiz, vorgang_id
protokoll     id, zeitpunkt, benutzer_id, aktion, objekt_typ, objekt_id,
              vorher_json, nachher_json, ip, geraet
```

- **Protokoll unveränderbar:** Die API kennt kein Ändern/Löschen für `protokoll` und `buchungen`; zusätzlich verhindern SQLite-Trigger `UPDATE`/`DELETE` auf diesen Tabellen.
- **Nichts wird gelöscht:** Sachen, Orte und Benutzer werden deaktiviert, damit alte Protokolleinträge lesbar bleiben.
- `vorgang_id` fasst eine Mehrfach-Buchung zusammen („12 Sachen um 14:03 von A. nach Regal B3“).
- Indizes auf `code`, `ort_id`, `sache_id`, `benutzer_id`, `zeitpunkt`.
- Migrationen versioniert unter `migrations/` (`wrangler d1 migrations`).

## 7. Projektstruktur

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

## 8. Umsetzungsphasen

| Phase | Inhalt | Fertig, wenn … |
|---|---|---|
| **0 Grundgerüst** | Vite + React + Hono + Wrangler, D1 lokal, Tests, GitHub Actions, Vorschau-Deployment | `npm test` grün, App erreichbar unter `*.workers.dev` |
| **1 Konten & Rollen** | Anmeldung, Sitzungen, Benutzerverwaltung, Rollenprüfung, erster Admin, Sperre bei Fehlversuchen | jede Rolle sieht/darf genau ihre Rechte (automatisch getestet) |
| **2 Stammdaten** | Orte (Hierarchie), Sachen, CSV-Import, Etikettendruck | 100 Sachen per CSV importiert, Etiketten gedruckt und lesbar |
| **3 Scanner** | Kamera-Mehrfach-Scan, Handscanner, manuelle Eingabe, Formatwahl | iPhone + Android lesen QR und EAN/Code 128 zuverlässig, 10 Codes in < 20 s |
| **4 Abfrage & Buchen** | „Wo ist?“, Umbuchen, Einlagern, Entnehmen, Ausleihen, Verlauf | Umbuchung von 20 Sachen in < 1 min, alles oder nichts |
| **5 Protokoll** | Protokollansicht mit Filtern (Person, Sache, Ort, Zeitraum), CSV-Export, Unveränderbarkeit | jede Änderung erscheint im Protokoll; Ändern/Löschen technisch unmöglich |
| **6 Härtung** | Rate Limiting, tägliche Sicherung nach R2, Wiederherstellungstest, optional 2FA | Wiederherstellung einmal erfolgreich geprobt |
| **7 Erweiterungen** | Offline-Modus (Warteschlange im Gerät, Abgleich bei Netz), Inventur, Mengenartikel, Auswertungen | nach Bedarf |

## 9. Datenschutz

Das Protokoll speichert, **wer** wann **was** gebucht hat – das sind personenbezogene Daten.
- Nur speichern, was für die Nachverfolgung nötig ist; IP-Adressen nach festgelegter Frist (z. B. 90 Tage) leeren.
- Aufbewahrungsdauer des Protokolls festlegen.
- Im Firmeneinsatz: Die App kann Arbeitsabläufe einzelner Personen nachvollziehbar machen. Mit **Betriebsrat** und **Datenschutzbeauftragtem** abstimmen, bevor sie produktiv geht. Keine Auswertungen „Leistung pro Person“ ohne Freigabe.
- Cloudflare ist ein US-Anbieter; D1 kann mit einem Standorthinweis (z. B. Westeuropa) bzw. der EU-Jurisdiktion angelegt werden – vor dem Anlegen festlegen, weil es sich nachträglich nicht ändern lässt.

## 10. Offene Fragen

1. **Was sind die „Sachen“?** Einzelstücke mit eigenem Code (Werkzeug, Geräte, Kisten) oder auch Mengenartikel (z. B. 50 Stück Schrauben an einem Ort)?
2. **Gibt es schon Codes** auf den Sachen oder an den Lagerplätzen? Wenn ja, welche Art (QR, EAN, Code 128)?
3. **Wie sind die Orte aufgebaut?** z. B. Standort → Halle → Regal → Fach; können Sachen auch bei Personen oder in Fahrzeugen sein?
4. **Rollen:** Passen die vier Rollen (Leser, Mitarbeiter, Leitung, Admin)? Wie viele Benutzer ungefähr?
5. **Geräte:** Handys (iPhone/Android), Tablets, Handscanner?
6. **Offline:** Gibt es Bereiche ohne Netz, in denen trotzdem gescannt werden muss?
7. **Anmeldung:** Benutzername + Passwort, oder Microsoft-/Google-Konto?
8. **Einsatz:** privat, Verein oder Firma (→ Betriebsrat/Datenschutz)?
9. **Cloudflare:** Gibt es schon ein Konto und eine eigene Domain, oder erst `*.workers.dev`?
