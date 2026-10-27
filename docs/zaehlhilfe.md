# Zählhilfe bei der Inventur

In **Inventur → Regal → „Regal per Foto zählen“** nimmt man ein Foto vom Regal oder Fach auf. Ein Bildmodell setzt **auf jedes gefundene Teil einen Punkt**. Die Punkte sind nummeriert und haben die Farbe ihrer Art.

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
