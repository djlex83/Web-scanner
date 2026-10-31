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

## Modelle, umschaltbar

In der Zählhilfe wählt man das **Zählmodell** aus einer Liste; die letzte Wahl wird gemerkt. Am besten mehrere mit demselben Foto vergleichen („Anderes Modell oder Arten ändern“ → „Mit demselben Foto zählen“).

**Bildmodelle bei Cloudflare (ohne eigenen Schlüssel):** Diese bekommen per Chat dasselbe Foto und dieselbe Anweisung wie Gemini und antworten mit Punkten als JSON. Sie laufen über die Bindung `AI` und das Gratis-Kontingent (10 000 Neurons/Tag); große Modelle wie Kimi verbrauchen davon mehr.

| Auswahl | Modell bei Cloudflare | Erster Test |
|---|---|---|
| **Qwen 3.8** (Voreinstellung) | `@cf/qwen/qwen3.8-27b` | 3 von 3, Punkte genau auf den Teilen |
| Llama 4 Scout | `@cf/meta/llama-4-scout-17b-16e-instruct` | 3 von 3, Punkte ungenauer |
| Gemma 4 | `@cf/google/gemma-4-26b-a4b-it` | – |
| Kimi K2.6 | `@cf/moonshotai/kimi-k2.6` | – |
| Mistral Small 3.1 | `@cf/mistralai/mistral-small-3.1-24b-instruct` | – |
| Moondream 3.1 | `@cf/moondream/moondream3.1-9B-A2B` | nichts gefunden |

Erster Test (Oktober 2026): drei überlappende Möbelgleiter auf einem Tisch, Art „Kunststoff Gleiter“. Ein einzelnes Foto, keine Statistik – bei anderen Teilen kann es anders aussehen. Die Liste steht in `CLOUDFLARE_BILDMODELLE` in `src/gemeinsam/zaehlen.ts`, die Reihenfolge (erstes = Voreinstellung) in `ZAEHL_MODELLE`; ein weiteres Modell ist dort eine Zeile plus Name.

**Moondream und Gemini im Vergleich:**

| | Moondream 3.1 | Gemini (empfohlen) |
|---|---|---|
| Wo | Cloudflare Workers AI (`@cf/moondream/moondream3.1-9B-A2B`, Aufgabe `query` mit Datenstrom) | Google direkt (`GEMINI_API_KEY`) oder über OpenRouter (`OPENROUTER_API_KEY`) |
| Foto geht an | Cloudflare | Google (ggf. über OpenRouter) |
| Einrichtung | nichts – Bindung `AI` in `wrangler.jsonc` | Secret `GEMINI_API_KEY` **oder** `OPENROUTER_API_KEY` am Worker |
| Kosten (Schätzung) | Gratis-Kontingent 10 000 Neurons/Tag | Google: kostenloses Kontingent in AI Studio, für eine Inventur reichlich · OpenRouter: ca. 1–2 Cent pro Foto |
| Ablauf | deutsche Texte werden ins Englische übersetzt, dann je Art eine Frage nach den Punkten als JSON | eine Anfrage mit allen Arten, Antwort als JSON |
| Zählqualität (Oktober 2026) | schwach: findet überlappende Teile oft nicht, setzt Punkte teils geraten | deutlich besser |

Moondream ist bei Cloudflare nur über eine Frage nutzbar (siehe Fehlersuche), nicht über seine eigentliche Punkte-Aufgabe. Deshalb ist Gemini für das Zählen die bessere Wahl. Die Kostenzahlen sind geschätzt, nicht gemessen.

Ohne einen der beiden Schlüssel zeigt die App nur Moondream an. Ist `GEMINI_API_KEY` gesetzt, geht Gemini direkt an Google, sonst über OpenRouter. Optional wählt `GEMINI_MODELL` ein anderes Modell (Standard `google/gemini-3.6-flash`; bei Google wird der Vorsatz `google/` weggelassen).

**Gemini kostenlos einrichten (Google):**

1. Auf [aistudio.google.com](https://aistudio.google.com) mit einem Google-Konto anmelden → *Get API key* → *Create API key*. Schlüssel kopieren.
2. Cloudflare → *Workers & Pages → web-scanner → Einstellungen → Variablen und Geheimnisse → Hinzufügen* → Typ **Geheimnis**, Name `GEMINI_API_KEY`, Wert = der Schlüssel. Speichern.
3. Neu bereitstellen (oder auf den nächsten Push warten). In der Zählhilfe erscheint dann die Auswahl Moondream / Gemini.

Im kostenlosen Kontingent darf Google Eingaben zur Verbesserung seiner Modelle nutzen. Für Regalfotos meist unkritisch – wer das nicht will, schaltet in AI Studio die Abrechnung ein (bezahltes Kontingent, ohne diese Nutzung).

**Über OpenRouter:** wie oben, aber Name `OPENROUTER_API_KEY`, Wert = Schlüssel von openrouter.ai (mit Guthaben).

## Fehlersuche

- **In der App:** Unter dem Ergebnis klappt **„Technische Details“** auf (bei 0 Punkten automatisch). Dort steht pro Aufruf, welcher Begriff ans Modell ging (bei Moondream auf Englisch), wie viele Punkte kamen, wie lange es dauerte und die gekürzte Rohantwort oder der Fehler. **„Details kopieren“** legt alles als Text in die Zwischenablage.
- **Im Cloudflare-Log:** *Workers & Pages → web-scanner → Logs* – jede Zählung schreibt eine Zeile `Zählhilfe …` mit denselben Angaben (ohne Foto).
- **Moondream versucht nacheinander:** den vollen übersetzten Text, dann nur den Begriff vor dem Doppelpunkt, dann das deutsche Wort (die Übersetzung kann bei einzelnen Wörtern danebenliegen, „Schere“ wurde schon zu „Shares“), und wenn keine Art etwas findet, zum Schluss allgemein „individual item on the shelf“ (graue Punkte ohne Art). Kommt von keinem Aufruf eine Antwort, zeigt die App den Fehler statt „nichts gefunden“.
- **Leere Antwort `{}`:** Eine echte Moondream-Antwort enthält immer `finish_reason` und `metrics`, bei `point` dazu `points`. Fehlt das, hat das Modell nicht gerechnet. Seit Oktober 2026 liest der Worker die rohe HTTP-Antwort selbst (Status, Inhaltstyp, Text) und meldet so etwas als Fehler „Moondream hat nicht geantwortet: Antwort ohne Punkte …“ statt als 0 Punkte. Steht in den Details ein HTTP-Status oder „kein JSON“, liegt es an Cloudflare bzw. am Modellaufruf, nicht am Foto.
- **Nur mit Datenstrom (`stream: true`):** Ohne Datenstrom liefert Cloudflare bei Moondream immer `{"result":{},"success":true}` – bei jeder Aufgabe, auch bei einer reinen Textfrage ohne Bild, über die Bindung wie über die REST-API, ohne Neuronen-Verbrauch. Mit `stream: true` rechnet das Modell und schickt Server-Sent Events: Zwischenstände als `chunk`, am Ende ein Ereignis mit `output` und `status: "succeeded"`. Der Worker liest den Strom (`moondreamStromLesen`) und nimmt den letzten Stand mit `finish_reason: "stop"`. Laut Cloudflares Typbeschreibung können `point` und `detect` keinen Datenstrom; das Gegenteil hat sich gezeigt (Stand Oktober 2026). Ursache gefunden im Oktober 2026, nachdem die App tagelang „nichts gefunden“ meldete – Test per curl:

  ```bash
  curl -sS -N "https://api.cloudflare.com/client/v4/accounts/KONTO_ID/ai/run/@cf/moondream/moondream3.1-9B-A2B" \
    -H "Authorization: Bearer $CF_TOKEN" -H "Content-Type: application/json" \
    -d '{"task":"query","question":"What is the capital of France?","stream":true}'
  ```
- **Frage statt Punkte-Aufgabe:** `point` lehnt den Datenstrom ab („task=point does not support stream=True“). Der Worker nutzt deshalb `query` mit `stream: true` und `reasoning: true`: Die Frage (`moondreamFrage`) verlangt die Mittelpunkte aller Exemplare als JSON auf 0–1. Punkte kommen aus dem JSON im Antworttext (`textPunkte`) oder, falls dort keine stehen, aus den Punkten, die das Modell beim Nachdenken setzt (`reasoning.grounding`). Das Bild geht als Daten-URL (Text) mit. In den Technischen Details steht die Antwort des Modells – daran sieht man, ob es JSON geliefert hat.
- **Sackgassen (nicht wieder versuchen):** Bild als Byte-Array (wird als Text abgelehnt), Binärdaten `{ body, contentType }` („image is required“), Chat-Pfad mit Bildadresse („only supports base64“).

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
