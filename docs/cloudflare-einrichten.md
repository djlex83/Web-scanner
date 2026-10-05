# Web Scanner auf Cloudflare einrichten

Schritt-für-Schritt-Anleitung – ohne Programmierkenntnisse, komplett im **kostenlosen Tarif**. Dauer: etwa 20 Minuten.

Am Ende läuft die App unter einer Adresse wie `https://web-scanner.dein-name.workers.dev`, und jede Änderung auf GitHub wird automatisch veröffentlicht.

---

## Überblick

| Schritt | Was | Wo |
|---|---|---|
| 0 | Code auf `main` bringen | GitHub |
| 1 | Cloudflare-Konto anlegen | dash.cloudflare.com |
| 2 | Datenbank anlegen | Cloudflare → D1 |
| 3 | App mit GitHub verbinden und veröffentlichen | Cloudflare → Workers & Pages |
| 4 | Erstes Admin-Konto anlegen | in der App |
| 5 | Notfall-Code hinterlegen | Cloudflare → Worker → Einstellungen |
| 6 | Einstellungen prüfen | Cloudflare |
| 7 | Loslegen: Plätze, Etiketten, Benutzer | in der App |

Was **nicht** nötig ist: Kreditkarte, Server, Terminal, API-Token.

---

## Schritt 0 – Code auf `main` bringen (GitHub)

Cloudflare veröffentlicht immer den Stand des Branches `main`.

1. Auf GitHub das Repository **djlex83/Web-scanner** öffnen.
2. **Settings → General → Default branch**: auf **`main`** stellen (Pfeil-Symbol ⇄ → `main` → *Update*).
3. Den Pull Request **„Web Scanner: komplette App für Cloudflare Workers“** öffnen:
   - **Ready for review** klicken (er ist noch als Entwurf markiert),
   - dann **Merge pull request** → **Confirm merge**.

✅ Danach liegt die komplette App auf `main`.

---

## Schritt 1 – Cloudflare-Konto anlegen

1. [dash.cloudflare.com/sign-up](https://dash.cloudflare.com/sign-up) öffnen.
2. E-Mail-Adresse und Passwort eingeben, E-Mail bestätigen.
3. Eine eigene Domain wird **nicht** gebraucht – die Frage danach kann übersprungen werden.

> Tipp: Unter *Mein Profil → Authentifizierung* die **Zwei-Faktor-Anmeldung** einschalten. Wer Zugang zum Cloudflare-Konto hat, hat Zugang zu allen Daten.

---

## Schritt 2 – Datenbank anlegen

Die App speichert alles (Stücke, Plätze, Benutzer, Protokoll, Fotos) in einer **D1-Datenbank**. Es lohnt sich, sie selbst anzulegen, damit sie in **Europa** steht.

1. Links im Menü: **Speicher & Datenbanken → D1 SQL-Datenbank** (englisch: *Storage & Databases → D1 SQL Database*).
2. **Datenbank erstellen** (*Create Database*).
3. Name: **`web-scanner`** – genau so, klein geschrieben, mit Bindestrich.
4. **Standort** (*Location*): **Westeuropa** (*Western Europe*) wählen.
5. **Erstellen**.

✅ Die Tabellen muss niemand anlegen – das macht die App beim ersten Aufruf selbst.

> Wird dieser Schritt übersprungen, legt Cloudflare die Datenbank beim ersten Veröffentlichen automatisch an – dann aber evtl. nicht in Europa.

---

## Schritt 3 – App mit GitHub verbinden und veröffentlichen

1. Links im Menü: **Workers & Pages** → **Erstellen** (*Create*).
2. Reiter **Workers** → **Repository importieren** (*Import a repository*).
3. **GitHub verbinden** → bei GitHub anmelden → die Cloudflare-App installieren.
   Am sichersten: *Only select repositories* → **Web-scanner** auswählen → *Install & Authorize*.
4. Zurück bei Cloudflare das Repository **Web-scanner** auswählen.
5. Einstellungen eintragen:

   | Feld | Wert |
   |---|---|
   | **Projektname** (*Project name*) | **`web-scanner`** ⚠️ muss genau so heißen |
   | Produktions-Branch | `main` |
   | **Build-Befehl** (*Build command*) | `npm run build` |
   | **Deploy-Befehl** (*Deploy command*) | `npx wrangler deploy` |
   | Stammverzeichnis (*Root directory*) | leer lassen bzw. `/` |

   Unter *Erweiterte Einstellungen* (*Advanced settings*), falls vorhanden:
   **„Builds für andere Branches“** (*Builds for non-production branches*) **ausschalten**.
   Grund: Vorschau-Versionen würden dieselbe Datenbank benutzen wie die echte App.

6. **Bereitstellen** (*Deploy*) klicken.
7. Warten, bis der Build grün ist (ca. 2–3 Minuten). Im Protokoll sieht man u. a.:
   - `npm run build` … `✓ built`
   - bei der Datenbank: entweder *„connected“* zur vorhandenen `web-scanner` oder *„Creating new D1 Database“*
   - am Ende eine Adresse `https://web-scanner.<name>.workers.dev`

> Beim allerersten Worker fragt Cloudflare evtl. nach einer **workers.dev-Subdomain** (z. B. `firma-lager`). Den Namen frei wählen – er steht dann in der Adresse: `https://web-scanner.firma-lager.workers.dev`.

✅ Die App ist online.

---

## Schritt 4 – Erstes Admin-Konto anlegen

⚠️ **Sofort nach dem Veröffentlichen erledigen.** Solange es noch kein Konto gibt, kann jeder, der die Adresse kennt, das erste Konto anlegen.

1. Die Adresse aus Schritt 3 öffnen (Handy oder PC).
2. Es erscheint **„Willkommen!“**.
3. Name, Benutzername und Passwort (mind. 8 Zeichen) eingeben → **Konto anlegen**.

✅ Dieses Konto ist **Admin**. Empfehlung: gleich unter *Benutzer* einen **zweiten Admin** anlegen (z. B. für die Vertretung).

---

## Schritt 5 – Notfall-Code hinterlegen (empfohlen)

Damit kommt man auch dann wieder als Admin hinein, wenn alle Admin-Passwörter vergessen sind.

1. Einen langen Zufallscode erzeugen – **mindestens 16 Zeichen**, z. B. mit dem Passwort-Manager.
   Den Code **sicher aufbewahren** (Passwort-Manager, ausgedruckt im Tresor).
2. Cloudflare: **Workers & Pages → web-scanner → Einstellungen** (*Settings*) → **Variablen und Geheimnisse** (*Variables and Secrets*) → **Hinzufügen** (*Add*).
3. Eintragen:

   | Feld | Wert |
   |---|---|
   | Typ | **Geheimnis** (*Secret*) – wichtig, nicht „Text“ |
   | Name | `NOTFALL_CODE` |
   | Wert | der Code |

4. **Bereitstellen** (*Deploy*) bzw. Speichern.

✅ Auf der Anmeldeseite erscheint jetzt **„Admin-Zugang wiederherstellen“**. Wie man ihn benutzt, steht im README unter *Passwort ändern oder vergessen*.

> Warum „Geheimnis“? Geheimnisse bleiben bei jeder neuen Veröffentlichung erhalten und sind nach dem Speichern nicht mehr lesbar. Als „Text“ würde der Wert beim nächsten Update überschrieben.

---

## Schritt 6 – Einstellungen prüfen

Unter **Workers & Pages → web-scanner**:

| Wo | Was prüfen |
|---|---|
| **Einstellungen → Bindungen** (*Bindings*) | `DB` → D1-Datenbank `web-scanner` |
| **Einstellungen → Variablen und Geheimnisse** | `PBKDF2_RUNDEN` = `20000` (kommt aus dem Code) · `NOTFALL_CODE` (Geheimnis) |
| **Einstellungen → Build** | Branch `main`, Build-Befehl `npm run build`, Deploy-Befehl `npx wrangler deploy` |
| **Protokolle** (*Logs / Observability*) | eingeschaltet – hier sieht man Fehler, falls etwas nicht klappt |

Optional – **eigene Adresse** (z. B. `scanner.meine-firma.de`): Nur möglich, wenn die Domain bei Cloudflare verwaltet wird. Dann *Einstellungen → Domains & Routen → Hinzufügen → Benutzerdefinierte Domain*.

---

## Schritt 7 – Loslegen

1. **Plätze** → Abteilung anlegen (z. B. „Montage“) → **Regale** anlegen (auch viele auf einmal: „Regal 1“ bis „Regal 20“).
2. **Etiketten** drucken und an die Regale kleben.
3. **Benutzer** anlegen, Rollen vergeben, Startpasswörter weitergeben.
4. **Scannen → Einlagern**: Regal-Etikett scannen, Stücke scannen, unbekannte gleich erfassen (mit Foto).

**Als App aufs Handy:**
- **Android (Chrome):** Menü ⋮ → *App installieren* bzw. *Zum Startbildschirm hinzufügen*.
- **iPhone (Safari):** Teilen-Symbol □↑ → *Zum Home-Bildschirm*.

Beim ersten Scannen fragt das Handy nach der **Kamera-Erlaubnis** → *Erlauben*.

---

## Später: Updates, Zurücksetzen, Sicherung

| Aufgabe | So geht’s |
|---|---|
| **Neue Version** | Änderung auf `main` (z. B. Pull Request zusammenführen) → Cloudflare baut und veröffentlicht automatisch. Datenbank-Änderungen spielt die App selbst ein. |
| **Version zurückdrehen** | *Workers & Pages → web-scanner → Bereitstellungen* (*Deployments*) → ältere Version → *Rollback*. Die Daten bleiben unverändert. |
| **Daten herunterladen** | In der App als Admin: *Mein Konto → Datensicherung herunterladen* (JSON, ohne Passwörter und Fotos). |
| **Daten auf einen früheren Zeitpunkt zurücksetzen** | D1 merkt sich die letzten **7 Tage** (*Time Travel*). Das ist ein Eingriff für Notfälle – am besten mit jemandem, der Erfahrung mit `wrangler d1 time-travel` hat. |
| **Verbrauch ansehen** | *Workers & Pages → web-scanner → Metriken* und *D1 → web-scanner → Metriken*. |

**Grenzen des kostenlosen Tarifs:** 100 000 Anfragen pro Tag, Datenbank bis 5 GB, Fotos inklusive. Für einen Betrieb mit einigen Tausend Stücken und Dutzenden Benutzern reicht das gut. Wird es knapp, zeigt Cloudflare das unter *Metriken*; der bezahlte Tarif kostet 5 $ pro Monat.

---

## Wenn etwas nicht klappt

| Problem | Ursache und Lösung |
|---|---|
| Build bricht ab, weil der **Name nicht passt** | Der Projektname bei Cloudflare muss **`web-scanner`** heißen (wie in `wrangler.jsonc`). Worker löschen und mit richtigem Namen neu importieren. |
| Build bricht bei der **Datenbank** ab (*permission*, *D1*) | Schritt 2 nachholen: D1-Datenbank **`web-scanner`** anlegen, dann unter *Bereitstellungen* den Build **erneut ausführen** (*Retry build*). Sie wird dann automatisch verbunden. |
| Build bricht bei `npm` ab | Im Build-Protokoll nach der ersten roten Zeile schauen. Meist hilft *Retry build*; sonst den Fehlertext an den Entwickler geben. |
| Seite zeigt **„Interner Fehler“** | *Workers & Pages → web-scanner → Protokolle* öffnen – dort steht die genaue Meldung. |
| **Fehler 1102** / „Worker exceeded resource limits“ beim Anmelden | Das Rechenlimit des kostenlosen Tarifs wurde überschritten. `PBKDF2_RUNDEN` in `wrangler.jsonc` ist bereits auf 20 000 gesetzt; falls es trotzdem auftritt, den Entwickler fragen. |
| **Kamera** startet nicht | Die Seite muss über `https://` laufen (bei `workers.dev` immer der Fall) und die Kamera muss erlaubt sein: Browser-Einstellungen → Website-Einstellungen → Kamera. Notfalls Codes eintippen oder einen Handscanner nutzen. |
| Jemand anderes hat das erste Konto angelegt | **Nur solange noch keine echten Daten drin sind:** Worker **und** D1-Datenbank `web-scanner` löschen, dann Schritt 2 bis 4 wiederholen – Schritt 4 diesmal sofort. |
| Admin-Passwort vergessen, kein zweiter Admin | Notfall-Code (Schritt 5) auf der Anmeldeseite benutzen. |

---

## Checkliste

- [ ] Default branch auf GitHub = `main`, Pull Request zusammengeführt
- [ ] Cloudflare-Konto mit Zwei-Faktor-Anmeldung
- [ ] D1-Datenbank `web-scanner` in Westeuropa
- [ ] Worker `web-scanner` mit GitHub verbunden, Build grün
- [ ] Builds für andere Branches ausgeschaltet
- [ ] Erstes Admin-Konto angelegt (sofort!) + zweiter Admin
- [ ] Notfall-Code als **Geheimnis** hinterlegt und sicher aufbewahrt
- [ ] Erste Abteilung, Regale, Etiketten gedruckt
- [ ] App auf den Handys installiert, Kamera erlaubt
