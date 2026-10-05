# Web Scanner

**Strichcodes und QR-Codes scannen – und sofort sehen, wo jedes Stück liegt.**

Web-App für Handy, Tablet und PC. Läuft im **kostenlosen Tarif von Cloudflare**, braucht keine Installation aus dem App-Store und funktioniert auf iPhone, Android und am PC gleich. Jede Person hat ein **eigenes Konto**, jede Bewegung landet in einem **Protokoll, das sich nicht ändern lässt**.

![Start, Einlagern und Stück-Ansicht am Handy](docs/bilder/uebersicht.png)

---

## Inhalt

- [Funktionen](#funktionen)
- [So funktioniert’s](#so-funktionierts)
  - [1. Einrichten und anmelden](#1-einrichten-und-anmelden)
  - [2. Abteilungen und Regale anlegen](#2-abteilungen-und-regale-anlegen)
  - [3. Etiketten drucken](#3-etiketten-drucken)
  - [4. Scannen: „Wo ist …?“ und „Einlagern“](#4-scannen-wo-ist--und-einlagern)
  - [5. Bestand und Protokoll](#5-bestand-und-protokoll)
  - [6. Benutzer verwalten](#6-benutzer-verwalten)
- [Rollen](#rollen)
- [Am PC](#am-pc)
- [Hell und dunkel](#hell-und-dunkel)
- [Auf Cloudflare veröffentlichen (kostenlos)](#auf-cloudflare-veröffentlichen-kostenlos)
- [Entwicklung](#entwicklung)

---

## Funktionen

| | |
|---|---|
| 📷 **Scannen mit der Kamera** | QR, DataMatrix, Code 128/39/93, EAN-13/8, UPC, ITF, Codabar. Mehrere Codes nacheinander oder gleichzeitig im Bild, Ton + Vibration, Taschenlampe. |
| 🖼️ **Foto auswerten** | Ein Foto mit vielen Etiketten → alle Codes auf einmal. |
| ⌨️ **Handscanner & Eintippen** | USB-/Bluetooth-Handscanner und manuelle Eingabe funktionieren genauso. |
| 📍 **„Wo ist …?“** | Zu jedem gescannten Stück: Abteilung › Regal, wann und von wem zuletzt bewegt. |
| 📦 **Einlagern / Umbuchen** | Regal-Etikett scannen → Stücke scannen → ein Tipp. Alles oder nichts. |
| ➕ **Direkt erfassen** | Unbekannter Code? Name eingeben – das Stück liegt sofort im gescannten Regal. |
| 🏷️ **QR-Etiketten** | Für Regale und Abteilungen, auf A4-Bögen (21 oder 8 pro Seite). |
| 🔎 **Bestand** | Suche nach Name, Code, Kategorie; Filter „ohne Platz“, „defekt“, „ausgemustert“. |
| 🕓 **Protokoll** | Jede Bewegung und Änderung – wer, was, wann, von wo nach wo. Unveränderbar. Export als CSV für Excel. |
| 👥 **Konten & Rollen** | Leser · Mitarbeiter · Leitung · Admin. Startpasswort muss geändert werden, Sperre nach 5 Fehlversuchen. |
| 🌗 **Hell / Dunkel** | Automatisch nach Gerät oder fest eingestellt. Große Knöpfe – auch mit Handschuhen bedienbar. |
| 📱 **Als App installierbar** | „Zum Startbildschirm hinzufügen“ – startet dann wie eine normale App. |

---

## So funktioniert’s

### 1. Einrichten und anmelden

Beim allerersten Aufruf legst du das **erste Konto** an – es bekommt alle Rechte (Admin). Danach meldet sich jede Person mit ihrem **eigenen Konto** an. Die Startseite zeigt die ersten Schritte, bis Plätze angelegt sind.

![Erster Start, Anmelden, erste Schritte](docs/bilder/zugang.png)

### 2. Abteilungen und Regale anlegen

Unter **Plätze** legst du Abteilungen an (z. B. Montage, Lager) und darin die Regale. Viele Regale gehen auf einmal: „Regal 1“ bis „Regal 20“. Jedes Regal bekommt automatisch einen eigenen QR-Code.

![Plätze, Regale als Reihe anlegen, Regal mit QR-Code](docs/bilder/plaetze.png)

### 3. Etiketten drucken

Pro Abteilung oder für einzelne Regale: **Etiketten drucken** öffnet eine Druckansicht für A4-Etikettenbögen. Ausdrucken, ans Regal kleben – fertig.

![Druckansicht für QR-Etiketten](docs/bilder/etiketten.png)

> Tipp: Im Druckdialog „Tatsächliche Größe“ bzw. Skalierung 100 % wählen und Ränder auf „Keine“ stellen.

### 4. Scannen: „Wo ist …?“ und „Einlagern“

- **Wo ist …?** – Codes scannen, auch mehrere auf einmal. Zu jedem Stück steht groß, wo es liegt.
- **Einlagern** – zuerst das **Regal-Etikett** scannen, dann alle Stücke, die hinein sollen. Ein Tipp auf „Einlagern“ bucht alle zusammen.
- **Unbekannter Code** – „Neu erfassen“, Namen eingeben, fertig. Das Stück liegt gleich im gescannten Regal.

![Wo ist, Einlagern, neues Stück erfassen](docs/bilder/scannen.png)

### 5. Bestand und Protokoll

Im **Bestand** findest du jedes Stück über die Suche oder die Filter. Das **Protokoll** zeigt lückenlos, wer was wann wohin gebracht hat – nach Zeitraum und Person filterbar und als **CSV für Excel** exportierbar. Einträge im Protokoll können nicht geändert oder gelöscht werden.

![Bestand und Protokoll](docs/bilder/bestand.png)

### 6. Benutzer verwalten

Admins legen unter **Benutzer** neue Konten an und vergeben die Rolle. Die App erzeugt ein **Startpasswort**, das beim ersten Anmelden geändert werden muss. Benutzer werden nie gelöscht, nur gesperrt – damit das Protokoll vollständig bleibt.

![Benutzer angelegt mit Startpasswort](docs/bilder/benutzer.png)

---

## Rollen

| Rolle | Darf |
|---|---|
| **Leser** | scannen, nachsehen wo etwas ist, Verlauf ansehen |
| **Mitarbeiter** | + einlagern, umbuchen, neue Stücke erfassen; eigenes Protokoll |
| **Leitung** | + Abteilungen/Regale anlegen, Etiketten drucken, Stücke bearbeiten/ausmustern, komplettes Protokoll + Export |
| **Admin** | + Benutzer anlegen, Rollen vergeben, sperren, Passwort zurücksetzen, Datensicherung |

Die Rechte werden bei **jeder Anfrage auf dem Server** geprüft – nicht nur in der Oberfläche.

---

## Am PC

Am großen Bildschirm gibt es eine Seitenleiste statt der unteren Leiste. Ein USB-Handscanner funktioniert dort ohne Einrichtung.

![Startseite am PC](docs/bilder/desktop.png)

![Plätze am PC](docs/bilder/desktop-plaetze.png)

---

## Hell und dunkel

Unter **Mein Konto** wählbar: automatisch (nach Geräteeinstellung), hell oder dunkel.

![Dunkler Modus](docs/bilder/dunkel.png)

---

## Auf Cloudflare veröffentlichen (kostenlos)

1. Kostenloses Konto auf [dash.cloudflare.com](https://dash.cloudflare.com) anlegen.
2. **Workers & Pages → Erstellen → „Repository importieren“** → GitHub verbinden → dieses Repository wählen.
3. Einstellungen:
   - Build-Befehl: `npm run build`
   - Deploy-Befehl: `npx wrangler deploy`
   - Produktions-Branch: `main`
4. **Bereitstellen.** Die Datenbank (D1, Name `web-scanner`) legt `wrangler deploy` beim ersten Mal selbst an, die Tabellen legt die App beim ersten Aufruf an.
   Falls die Bereitstellung wegen der Datenbank abbricht: unter **Storage & Databases → D1** eine Datenbank `web-scanner` anlegen und deren ID in `wrangler.jsonc` als `"database_id"` eintragen.
5. Die angezeigte Adresse (`https://web-scanner.<name>.workers.dev`) **sofort** öffnen und das **erste Admin-Konto** anlegen – solange es keinen Benutzer gibt, kann das jeder mit der Adresse.
6. Unter **Plätze** Abteilungen und Regale anlegen, Etiketten drucken, aufkleben – los geht’s.

Danach wird jeder Push auf `main` automatisch veröffentlicht.

**Kostenloser Tarif:** 100 000 Anfragen pro Tag, Datenbank bis 5 GB – reicht für viele Tausend Stücke und Dutzende Benutzer. Passwörter werden mit 20 000 PBKDF2-Runden gehasht, damit das Anmelden in die 10 ms Rechenzeit pro Anfrage passt; im bezahlten Tarif `PBKDF2_RUNDEN` in `wrangler.jsonc` auf `100000` setzen.

**Datensicherung:** Cloudflare D1 hält automatisch 7 Tage Verlauf zum Zurückspringen („Time Travel“). Zusätzlich kann ein Admin unter *Mein Konto → Datensicherung* alle Daten als JSON-Datei herunterladen.

---

## Entwicklung

```bash
npm install
npm run dev        # http://localhost:5173 – App + Server + lokale Datenbank
npm test           # API-Tests im echten Workers-Laufzeitsystem
npm run build      # Typprüfung + Bauen
```

Die Kamera braucht HTTPS – auf `localhost` geht es auch ohne. Am Handy am einfachsten direkt die veröffentlichte Version nutzen.

```
src/
├─ worker/        Server (Cloudflare Worker, Hono): Anmeldung, Rollen, API, Datenbankschema
├─ app/           Oberfläche (React, Tailwind): seiten/, scanner/, komponenten/, ui/ (Design-System)
└─ gemeinsam/     Rollen/Rechte, Prüfregeln, Typen – von Server und Oberfläche genutzt
tests/            API-Tests
docs/             Plan, Design-System, Bilder
```

Weitere Doku:
- [docs/PLAN.md](docs/PLAN.md) – Projektplan und Stand
- [docs/design-system.md](docs/design-system.md) – Farben, Schrift, Komponenten, Barrierefreiheit
