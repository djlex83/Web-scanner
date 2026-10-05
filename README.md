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
- [Inventur](#inventur)
- [Ausleihen und Rückgängig](#ausleihen-und-rückgängig)
- [Stammplatz und Aufräumen](#stammplatz-und-aufräumen)
- [Prüfung und Wartung](#prüfung-und-wartung)
- [Behälter und Vermisst](#behälter-und-vermisst)
- [Fotos und Kategorie-Symbole](#fotos-und-kategorie-symbole)
- [Passwort ändern oder vergessen](#passwort-ändern-oder-vergessen)
- [Rollen](#rollen)
- [Am PC](#am-pc)
- [Hell und dunkel](#hell-und-dunkel)
- [Auf Cloudflare veröffentlichen (kostenlos)](#auf-cloudflare-veröffentlichen-kostenlos) · [ausführliche Anleitung](docs/cloudflare-einrichten.md)
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
| 📸 **Fotos** | Foto beim Erfassen oder später aufnehmen – wird automatisch verkleinert und als Vorschaubild überall angezeigt. |
| 🎨 **Kategorie-Symbole** | Jede Kategorie bekommt automatisch ein passendes Symbol und eine Farbe; die Leitung kann beides ändern. |
| ➕ **Direkt erfassen** | Unbekannter Code? Name eingeben – das Stück liegt sofort im gescannten Regal. |
| 🏷️ **QR-Etiketten** | Für Regale, Abteilungen und Behälter: A4-Etikettenbögen (21, 14 oder 8), Schilder A4/A5/A6 oder Etikettendrucker in eigener Größe. |
| 🔎 **Bestand** | Suche nach Name, Code, Kategorie; Filter z. B. „ohne Platz“, „vermisst“, „verliehen“, „Prüfung fällig“, „Behälter“. |
| 📊 **Export für Excel** | Bestand (gefiltert) oder Inhalt eines Regals als CSV – mit Platz, Ausleihe, Prüftermin. |
| 📋 **Inventur je Regal** | Regal wählen, alles scannen → sofort sehen, was fehlt und was zusätzlich da ist. Je Stück einstellbar, ob es gezählt wird. |
| 🤝 **Ausleihen** | Stücke an Personen ausgeben, mit Rückgabedatum. Überfällige rot, Rückgabe per Scan. |
| ↩️ **Rückgängig** | Nach jeder Buchung ein Knopf „Rückgängig“ – als Gegenbuchung, nichts wird gelöscht. |
| 🔧 **Prüfung & Wartung** | Prüfart, Intervall und nächster Termin je Stück; Liste aller fälligen Prüfungen, Hinweis beim Scannen. |
| 📦 **Behälter** | Kisten und Koffer mit eigenem Code. Kiste umbuchen = alles darin wandert mit. |
| 🏠 **Aufräumen** | Alles scannen, was herumliegt – mit einem Tipp kommt jedes Stück zurück an seinen eigenen Stammplatz. |
| 🔍 **Vermisst** | Stück als vermisst melden – wer es irgendwo scannt, bekommt sofort einen Hinweis. |
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

Pro Abteilung oder für einzelne Regale: **Etiketten drucken** öffnet eine Druckansicht. Zur Wahl stehen A4-Etikettenbögen (21, 14 oder 8 pro Bogen), Schilder auf normalem Papier (4 × A6 oder 2 × A5 auf A4 zum Ausschneiden, A4/A5/A6 quer) und **Etikettendrucker** mit eigener Größe (z. B. 62 × 29 mm). Ausdrucken, ans Regal kleben – fertig. Behälter haben auf ihrer Seite einen eigenen Knopf „Etikett“.

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

## Inventur

Unter **Inventur** (oder auf der Seite eines Regals) das Regal wählen und alles scannen, was wirklich dort liegt. Die App vergleicht live mit dem Bestand:

- ✅ **gefunden** – liegt da, wo es eingetragen ist
- ❌ **fehlt noch** – laut System hier, aber nicht gescannt
- ➕ **zusätzlich** – liegt hier, ist aber woanders eingetragen
- 🤝 **verliehen** – fehlt, ist aber ausgeliehen (zählt nicht als fehlend)

Ein gescannter **Behälter zählt mit seinem Inhalt**. Beim Abschließen entscheidest du, ob Zusätzliches hierher gebucht und Fehlendes als vermisst gemeldet wird. Das Ergebnis steht unveränderbar im Protokoll. Gescannte Codes bleiben gespeichert, auch wenn die Seite zwischendurch geschlossen wird.

**Inventurpflicht je Stück:** Beim Erfassen und unter *Bearbeiten* lässt sich für jedes Stück einstellen, ob es **bei der Inventur gezählt** wird (z. B. aus für Verbrauchsmaterial). Der Bestandsfilter „Ohne Inventur“ zeigt alle Ausnahmen.

![Inventur: zählen, abschließen, Ergebnis](docs/bilder/inventur.png)

## Ausleihen und Rückgängig

- **Ausgeben:** *Scannen → Ausleihe*, Stücke scannen, „ausgeben“, Name und Rückgabedatum eintragen (1 Woche, 2 Wochen, 1 Monat oder frei). Geht auch auf der Seite eines Stücks.
- **Zurücknehmen:** dieselben Stücke in *Ausleihe* scannen → „zurück“. Wird ein verliehenes Stück irgendwo eingelagert, gilt es automatisch als zurückgegeben.
- **Ausleihen** zeigt, wer was hat – überfällige Rückgaben zuerst und rot, dazu der Verlauf.
- **Rückgängig:** Nach jeder Buchung erscheint kurz ein Knopf „Rückgängig“; die letzte eigene Bewegung lässt sich auch auf der Seite des Stücks zurücknehmen. Das geht 15 Minuten lang für eigene Buchungen (Leitung: jederzeit) und wird als Gegenbuchung protokolliert. Inzwischen weiterbewegte Stücke bleiben, wo sie sind.

![Ausleihe, Liste der Ausleihen, Rückgängig](docs/bilder/ausleihe.png)

## Stammplatz und Aufräumen

Jedes Stück hat einen **Stammplatz** – den Platz (oder Behälter), wo es hingehört.

- Der Stammplatz wird **automatisch** gesetzt, wenn ein Stück zum ersten Mal eingelagert wird. Vorhandene Stücke bekommen beim Update ihren ersten Lagerplatz aus dem Verlauf.
- **Ändern:** auf der Seite des Stücks unter „Stammplatz → Ändern“ (aktueller Ort, anderer Platz oder entfernen) – oder beim Einlagern den Schalter **„Als neuen Stammplatz festlegen“** einschalten, dann gilt das für alle gescannten Stücke.
- **Aufräumen:** *Scannen → Aufräumen*, alles scannen, was herumliegt. Jedes Stück zeigt „Werkbank → Regal 2“. Ein Tipp auf **„… zurückräumen“** bucht alle auf einmal an ihren jeweiligen Stammplatz – in einem Vorgang, mit „Rückgängig“. Liegt der Stammplatz in einem Behälter, kommt das Stück zurück in den Behälter, egal wo dieser gerade steht.
- Die Startseite und der Bestandsfilter **„Nicht am Stammplatz“** zeigen, was gerade woanders liegt. Einzelne Stücke lassen sich auch auf ihrer Seite mit „Zurück an den Stammplatz“ zurückbuchen.

## Prüfung und Wartung

Unter *Stück → Bearbeiten → Prüfung und Wartung* die Art (z. B. Elektroprüfung DGUV V3, Kalibrierung), das **Intervall** und den **nächsten Termin** eintragen. Danach:

- **Prüfung eintragen** mit Datum, Ergebnis (bestanden / mit Mängeln / nicht bestanden) und Notiz – der nächste Termin wird aus dem Intervall berechnet. „Nicht bestanden“ markiert das Stück als defekt.
- **Prüfungen** listet alle Termine: überfällig, in den nächsten 30 Tagen, später. Die Startseite und jeder Scan zeigen „Prüfung überfällig“ bzw. „Prüfung bald“.
- Alle Prüfnachweise bleiben unveränderbar am Stück gespeichert.

![Prüfung überfällig, eintragen, Übersicht](docs/bilder/pruefung.png)

## Behälter und Vermisst

- **Behälter** (Kiste, Koffer, Box): ein Stück mit dem Schalter „Ist ein Behälter“ – oder unter *Bestand → Behälter* neu anlegen, dann vergibt die App einen Code (`KISTE-…`) zum Ausdrucken. Zum **Befüllen** im Einlagern-Modus zuerst den Behälter scannen, dann die Stücke. Wird der Behälter umgebucht, wandert der ganze Inhalt mit.
- **Vermisst:** Auf der Seite eines Stücks „Vermisst“ tippen. Wer das Stück irgendwo scannt, sieht sofort „Wird vermisst – gefunden?“. Einlagern oder „Gefunden“ hebt die Meldung auf.
- **Zu erledigen:** Die Startseite zeigt Vermisstes, überfällige Rückgaben und fällige Prüfungen auf einen Blick.

![Behälter befüllen, vermisstes Stück gefunden, Startseite](docs/bilder/behaelter.png)

---

## Fotos und Kategorie-Symbole

![Bestand mit Fotos und Symbolen, Foto am Stück, Kategorie-Einstellungen](docs/bilder/fotos.png)

**Fotos**
- Beim **Erfassen** eines neuen Stücks („Foto aufnehmen“) oder später auf der **Stück-Seite** („Foto“ / „Neues Foto“). Das öffnet direkt die Kamera; ein vorhandenes Bild geht auch.
- Die App verkleinert das Foto vor dem Hochladen (großes Bild max. 1200 px, Vorschau 240 px, meist zusammen unter 100 KB) – schnell auch im schwachen WLAN.
- Angezeigt wird es als Vorschaubild in Bestand, Scanliste und Regal-Inhalt; auf der Stück-Seite groß, antippen zum Vergrößern.
- Fotos aufnehmen dürfen **Mitarbeiter**, Leitung und Admin; **entfernen** dürfen Leitung und Admin. Beides steht im Protokoll.
- Gespeichert wird in der Datenbank (D1, 5 GB im kostenlosen Tarif – reicht für weit über 50 000 Fotos). Die JSON-Datensicherung enthält die Fotos nicht.

**Kategorie-Symbole**
- Hat ein Stück kein Foto, zeigt die App das **Symbol seiner Kategorie** in deren Farbe – z. B. 🔧 Werkzeug blau, ⚡ Elektrik gelb, 🚚 Transport orange.
- Passende Symbole werden **automatisch** aus dem Kategorienamen gewählt (Werkzeug, Messgerät, Elektrik, Kabel, IT, PSA, Erste Hilfe, Transport …).
- Die **Leitung** kann unter *Bestand → Kategorien* (oder *Mehr → Kategorien*) für jede Kategorie eines von 43 Symbolen und eine von 9 Farben festlegen.
- Beim Erfassen werden die vorhandenen Kategorien mit Symbol als Vorschläge angezeigt und beim Tippen gefiltert.

---

## Passwort ändern oder vergessen

| Situation | So geht’s |
|---|---|
| **Eigenes Passwort ändern** | *Mein Konto → Passwort ändern*: bisheriges und neues Passwort (mind. 8 Zeichen). Alle anderen Geräte werden dabei abgemeldet. |
| **Neues Konto** | Der Admin legt es mit einem Startpasswort an. Beim ersten Anmelden muss die Person ein eigenes Passwort wählen. |
| **Passwort vergessen** | Ein Admin öffnet *Benutzer → Person → Passwort zurücksetzen*. Die App zeigt ein neues Startpasswort, das beim nächsten Anmelden geändert werden muss. Eine Sperre wird dabei aufgehoben. |
| **5 × falsches Passwort** | Das Konto ist 15 Minuten gesperrt – danach geht es wieder, oder ein Admin setzt das Passwort sofort zurück. |
| **Admin hat sein Passwort vergessen** | Am besten gibt es einen zweiten Admin. Sonst hilft der **Notfall-Code** (unten). |

### Notfall-Code für den Admin-Zugang

Falls kein Admin mehr hineinkommt, kann man auf der Anmeldeseite über **„Admin-Zugang wiederherstellen“** mit einem geheimen Notfall-Code ein neues Admin-Passwort setzen. Es braucht dafür keinen E-Mail-Dienst.

![Notfall-Code und Protokoll](docs/bilder/notfall.png)

**Einmalig einrichten:**

1. Einen langen Zufallscode ausdenken bzw. erzeugen (mindestens 16 Zeichen, z. B. vom Passwort-Manager) und **sicher aufbewahren** (Passwort-Manager, ausgedruckt im Tresor).
2. Im Cloudflare-Dashboard: **Workers & Pages → web-scanner → Einstellungen → Variablen und Geheimnisse → Hinzufügen**
   - Typ: **Geheimnis (Secret)**
   - Name: `NOTFALL_CODE`
   - Wert: der Code
   - Speichern und bereitstellen.

   Alternativ im Terminal: `npx wrangler secret put NOTFALL_CODE`
3. Ab jetzt erscheint auf der Anmeldeseite der Link **„Admin-Zugang wiederherstellen“**. Ohne hinterlegten Code bleibt die Funktion abgeschaltet und unsichtbar.

**Im Notfall:** Link antippen → Notfall-Code, Benutzername des Admins und neues Passwort eingeben → man ist sofort angemeldet. Alle alten Sitzungen dieses Admins werden beendet.

**Schutz:** höchstens 5 Versuche je Gerät in 15 Minuten und 10 Versuche insgesamt pro Stunde; jeder Versuch – auch ein falscher – steht im Protokoll. Funktioniert nur für Konten mit der Rolle Admin. Den Code nach einer Nutzung am besten neu setzen.

---

## Rollen

| Rolle | Darf |
|---|---|
| **Leser** | scannen, nachsehen wo etwas ist, Verlauf ansehen |
| **Mitarbeiter** | + einlagern, umbuchen, neue Stücke und Behälter erfassen, Fotos aufnehmen, ausleihen/zurücknehmen, Inventur, Prüfungen eintragen, vermisst melden, eigene Buchungen rückgängig machen; eigenes Protokoll |
| **Leitung** | + Abteilungen/Regale anlegen, Etiketten drucken, Stücke bearbeiten/ausmustern, Prüfpläne und Inventurpflicht festlegen, Fotos entfernen, Kategorie-Symbole festlegen, alle Buchungen rückgängig machen, komplettes Protokoll + Export |
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

👉 **Ausführliche Schritt-für-Schritt-Anleitung: [docs/cloudflare-einrichten.md](docs/cloudflare-einrichten.md)**

Kurzfassung:

1. Auf GitHub `main` als Standard-Branch einstellen und den Pull Request zusammenführen.
2. Kostenloses Konto auf [dash.cloudflare.com](https://dash.cloudflare.com) anlegen.
3. **D1-Datenbank `web-scanner`** anlegen (Standort Westeuropa).
4. **Workers & Pages → Erstellen → Repository importieren** → dieses Repository; Projektname **`web-scanner`**, Build-Befehl `npm run build`, Deploy-Befehl `npx wrangler deploy`.
5. Die Adresse (`https://web-scanner.<name>.workers.dev`) **sofort** öffnen und das **erste Admin-Konto** anlegen.
6. Den [Notfall-Code](#notfall-code-für-den-admin-zugang) als Geheimnis `NOTFALL_CODE` hinterlegen.

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

Für den Notfall-Code lokal: `.dev.vars.example` nach `.dev.vars` kopieren (wird nicht eingecheckt).

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
- [docs/cloudflare-einrichten.md](docs/cloudflare-einrichten.md) – Einrichtung auf Cloudflare, Schritt für Schritt
- [docs/PLAN.md](docs/PLAN.md) – Projektplan und Stand
- [docs/design-system.md](docs/design-system.md) – Farben, Schrift, Komponenten, Barrierefreiheit
