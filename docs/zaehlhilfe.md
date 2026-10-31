# Zählhilfe bei der Inventur

In **Inventur → Regal → „Regal per Foto zählen“** nimmt man ein Foto vom Regal oder Fach auf. Ein Bildmodell setzt **auf jedes gefundene Teil einen Punkt**. Die Punkte sind nummeriert und haben die Farbe ihrer Art.

**Foto aufnehmen oder Bild hochladen:** Am Handy öffnet „Foto aufnehmen“ direkt die Kamera, „Bild hochladen“ die Fotos. Am Rechner (Maus, kein Touch) öffnet „Foto aufnehmen“ eine eigene Kamera-Ansicht mit Auswahl der Kamera (`KameraAufnahme.tsx`): Ein iPhone oder iPad in der Nähe erscheint am Mac als Kamera (Kamera-Übergabe von Apple, in jedem Browser) und wird automatisch bevorzugt; die Wahl wird gemerkt. Voraussetzung: iPhone entsperrt in der Nähe, auf dem iPhone *Einstellungen → Allgemein → AirPlay & Übergabe → Kamera-Übergabe* an, gleiche Apple-ID, WLAN und Bluetooth an. „Bild hochladen“ nimmt eine Datei, z. B. per AirDrop vom iPhone.

- **Korrigieren:** Tippen auf einen Punkt entfernt ihn. Art in der Liste antippen, dann ins Foto tippen, setzt einen fehlenden Punkt dieser Art. Die Zahlen laufen mit.
- **Vergleich:** Je Art „gezählt / laut System“, grün bei Gleichstand.
- **Strichcodes:** Die App liest die Codes auf dem Foto selbst (auf dem Gerät). Punkte mit Code bekommen einen grünen Ring, die Codes lassen sich mit einem Tipp in die Inventur übernehmen.

**Die Zählhilfe bucht nichts.** Für das Inventur-Ergebnis zählen weiterhin nur gescannte Codes. So arbeiten auch Zähl-Apps wie CountThings: Die KI macht den Vorschlag, der Mensch korrigiert die wenigen Fehler.

## Was gezählt wird

Die Arten kommen aus den Stücken, die laut System in diesem Regal liegen: gruppiert nach **Kategorie** (sonst nach Name), dazu **Name** und **Beschreibung**, z. B. „Elektrowerkzeug: Akkuschrauber GSR 18V, blauer Koffer“. Höchstens 6 Arten je Foto. Vor dem Foto lassen sich die Texte ändern, löschen oder ergänzen.

**Je genauer die Beschreibung, desto besser das Zählen.** Farbe, Form und Verpackung helfen dem Modell mehr als Typnummern.

## Zwei Modelle, umschaltbar

| | Moondream 3.1 (Standard) | Gemini (zweite Meinung) |
|---|---|---|
| Wo | Cloudflare Workers AI (`@cf/moondream/moondream3.1-9B-A2B`, Aufgabe `point`) | Google, über OpenRouter |
| Foto geht an | Cloudflare | Google (über OpenRouter) |
| Einrichtung | nichts – Bindung `AI` in `wrangler.jsonc` | Secret `OPENROUTER_API_KEY` am Worker |
| Kosten (Schätzung) | ca. 0,05 Cent pro Art und Foto; das Gratis-Kontingent (10 000 Neurons/Tag) reicht grob für 50–100 Fotos am Tag, danach bricht es ab statt Geld zu kosten | ca. 1–2 Cent pro Foto |
| Ablauf | deutsche Texte werden mit `@cf/meta/m2m100-1.2b` ins Englische übersetzt, dann je Art eine `point`-Anfrage | eine Anfrage mit allen Arten, Antwort als JSON |

Die Kostenzahlen sind geschätzt, nicht gemessen. Nach den ersten Tagen im Cloudflare-Dashboard unter *AI → Workers AI* bzw. bei OpenRouter nachsehen.

Ist kein `OPENROUTER_API_KEY` gesetzt, zeigt die App nur Moondream an. Optional wählt `GEMINI_MODELL` ein anderes Modell bei OpenRouter (Standard `google/gemini-3.6-flash`).

**Gemini einrichten:** Cloudflare → *Workers & Pages → web-scanner → Einstellungen → Variablen und Geheimnisse → Hinzufügen* → Typ **Geheimnis**, Name `OPENROUTER_API_KEY`, Wert = Schlüssel von openrouter.ai. Speichern und neu bereitstellen.

## Fehlersuche

- **In der App:** Unter dem Ergebnis klappt **„Technische Details“** auf (bei 0 Punkten automatisch). Dort steht pro Aufruf, welcher Begriff ans Modell ging (bei Moondream auf Englisch), wie viele Punkte kamen, wie lange es dauerte und die gekürzte Rohantwort oder der Fehler. **„Details kopieren“** legt alles als Text in die Zwischenablage.
- **Im Cloudflare-Log:** *Workers & Pages → web-scanner → Logs* – jede Zählung schreibt eine Zeile `Zählhilfe …` mit denselben Angaben (ohne Foto).
- **Moondream versucht nacheinander:** den vollen übersetzten Text, dann nur den Begriff vor dem Doppelpunkt, dann das deutsche Wort (die Übersetzung kann bei einzelnen Wörtern danebenliegen, „Schere“ wurde schon zu „Shares“), und wenn keine Art etwas findet, zum Schluss allgemein „individual item on the shelf“ (graue Punkte ohne Art). Kommt von keinem Aufruf eine Antwort, zeigt die App den Fehler statt „nichts gefunden“.
- **Leere Antwort `{}`:** Eine echte Moondream-Antwort enthält immer `finish_reason` und `metrics`, bei `point` dazu `points`. Fehlt das, hat das Modell nicht gerechnet. Seit Oktober 2026 liest der Worker die rohe HTTP-Antwort selbst (Status, Inhaltstyp, Text) und meldet so etwas als Fehler „Moondream hat nicht geantwortet: Antwort ohne Punkte …“ statt als 0 Punkte. Steht in den Details ein HTTP-Status oder „kein JSON“, liegt es an Cloudflare bzw. am Modellaufruf, nicht am Foto.
- **Bild binär, nicht als Text:** Cloudflares Typbeschreibung verspricht für `image` „Adresse oder Base64-Daten-URL“. Das Modell dahinter nimmt aber nur Binärdaten an; jede Zeichenkette ergibt stillschweigend `{"result":{},"success":true}` ohne Neuronen-Verbrauch – auch bei `query` und `caption`, auch über die REST-API. Der Chat-Pfad (`/ai/v1/chat/completions`) sagt es offen: „Type mismatch of '/image', 'string' not in 'array','binary'“. Ein Byte-Array im JSON wird von Cloudflare wieder zu Text gemacht und ebenfalls abgelehnt. Was ankommt: über die **AI-Bindung** als `{ body: Datenstrom, contentType: "image/jpeg" }` (wie bei Partnermodellen à la Deepgram). Dabei gehen alle Zusatzfelder als Text mit, deshalb ohne `max_objects` (sonst „"300" is not of type "integer"“). Der Worker wandelt die Daten-URL in Bytes um (`datenUrlZuBytes`) und versucht erst binär, dann das Array; die genommene Form steht in den Details hinter dem Begriff. So wurde die Ursache im Oktober 2026 gefunden, nachdem die App tagelang „nichts gefunden“ meldete.

## Schutz

- Nur angemeldete Personen mit dem Recht „buchen“.
- Höchstens 40 Zählungen pro Person und Stunde.
- Das Foto wird auf höchstens 1280 px verkleinert, an das Modell weitergereicht und **nicht gespeichert**.

## Technik

| Datei | Inhalt |
|---|---|
| `src/gemeinsam/zaehlen.ts` | Arten vorschlagen, Antworten lesen, Doppelte zusammenführen, Codes zuordnen (getestet in `tests/zaehlen.test.ts`) |
| `src/worker/routen/zaehlen.ts` | `GET /api/zaehlen/modelle`, `POST /api/zaehlen` |
| `src/app/komponenten/RegalZaehlen.tsx` | Oberfläche mit Punkten und Korrektur |

Lokal: `npm run dev` verbindet Workers AI mit dem echten Cloudflare-Konto (vorher `npx wrangler login`). Ohne Konto: `CLOUDFLARE_VITE_FORCE_LOCAL=true npm run dev`. Dann läuft die App, das Zählen mit Moondream aber nicht. Die Tests laufen immer ohne Konto (`remoteBindings: false`).

## Verlauf

Die erste Fassung (Oktober 2026) zählte mit YOLOE-26n im Browser. Im Betrieb war das zu ungenau: Das kleine, allgemeine Modell kannte die Teile nicht und fasste verdeckte zusammen. Es ist ersetzt.
