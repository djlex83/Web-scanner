# Zählhilfe bei der Inventur

In **Inventur → Regal → „Regal per Foto zählen“** nimmt man ein Foto vom Regal oder Fach auf. Ein Bildmodell setzt **auf jedes gefundene Teil einen Punkt**. Die Punkte sind nummeriert und haben die Farbe ihrer Art. Steht auf einem Teil eine lesbare Nummer (z. B. „T808“ auf einem Aufkleber), zeigt die App sie unter dem Punkt.

**Erst die Art, dann das Foto:** Die Fotoknöpfe sind gesperrt, solange nicht mindestens eine Art eingetragen ist – so kommt der Hinweis vor der Aufnahme statt als Fehler danach. Ist das Regal laut System leer, steht ein leeres Feld zum Eintragen bereit.

**Gute Fotos:** eine Ablage pro Foto, möglichst gerade von vorn oder schräg von oben, mit gutem Licht. Angeschnittene Böden am oberen oder unteren Bildrand zählt das Modell nicht mit (so steht es in der Anweisung). Das Foto geht mit höchstens 1600 px an das Modell.

**Foto aufnehmen oder Bild hochladen:** Am Handy öffnet „Foto aufnehmen“ direkt die Kamera, „Bild hochladen“ die Fotos. Am Rechner (Maus, kein Touch) öffnet „Foto aufnehmen“ eine eigene Kamera-Ansicht mit Auswahl der Kamera (`KameraAufnahme.tsx`): Ein iPhone oder iPad in der Nähe erscheint am Mac als Kamera (Kamera-Übergabe von Apple, in jedem Browser) und wird automatisch bevorzugt; die Wahl wird gemerkt. Voraussetzung: iPhone entsperrt in der Nähe, auf dem iPhone *Einstellungen → Allgemein → AirPlay & Übergabe → Kamera-Übergabe* an, gleiche Apple-ID, WLAN und Bluetooth an. „Bild hochladen“ nimmt eine Datei, z. B. per AirDrop vom iPhone.

- **Korrigieren:** Tippen auf einen Punkt entfernt ihn. Art in der Liste antippen, dann ins Foto tippen, setzt einen fehlenden Punkt dieser Art. Die Zahlen laufen mit.
- **Vergleich:** Je Art „gezählt / laut System“, grün bei Gleichstand.
- **Selbstkontrolle:** Das Modell nennt zusätzlich, wie viele Teile es gezählt hat. Weicht das von den gesetzten Punkten ab, zeigt die App einen Hinweis zum genauen Prüfen.
- **Strichcodes:** Die App liest die Codes auf dem Foto selbst (auf dem Gerät). Punkte mit Code bekommen einen grünen Ring, die Codes lassen sich mit einem Tipp in die Inventur übernehmen.

**Die Zählhilfe bucht nichts.** Für das Inventur-Ergebnis zählen weiterhin nur gescannte Codes. So arbeiten auch Zähl-Apps wie CountThings: Die KI macht den Vorschlag, der Mensch korrigiert die wenigen Fehler.

## Was gezählt wird

Die Arten kommen aus den Stücken, die laut System in diesem Regal liegen: gruppiert nach **Kategorie** (sonst nach Name), dazu **Name** und **Beschreibung**, z. B. „Elektrowerkzeug: Akkuschrauber GSR 18V, blauer Koffer“. Höchstens 6 Arten je Foto. Vor dem Foto lassen sich die Texte ändern, löschen oder ergänzen.

**Beschreiben, woran man ein Teil erkennt.** Form, Farbe, Größe und Halterung helfen dem Modell mehr als Typnummern – z. B. „Werkzeugaufnahme mit Kegelschaft in blauem Halteplatz“ statt „HSK63 Spannfutter“.

## Modelle

In der Zählhilfe wählt man das **Zählmodell** aus einer Liste; die letzte Wahl wird gemerkt. Am besten mehrere mit demselben Foto vergleichen („Anderes Modell oder Arten ändern“ → „Mit demselben Foto zählen“). Alle Modelle bekommen dieselbe Anweisung (`zaehlAnweisung`) und antworten mit Punkten als JSON (`modellPunkte`).

**Bildmodelle bei Cloudflare (ohne eigenen Schlüssel):** per Chat über die Bindung `AI`, Gratis-Kontingent 10 000 Neurons/Tag; große Modelle wie Kimi verbrauchen davon mehr.

| Auswahl | Modell | Erster Test |
|---|---|---|
| **Qwen 3.8** (Voreinstellung) | `@cf/qwen/qwen3.8-27b` | 3 von 3, Punkte genau auf den Teilen |
| Llama 4 Scout | `@cf/meta/llama-4-scout-17b-16e-instruct` | 3 von 3, Punkte ungenauer |
| Gemma 4 | `@cf/google/gemma-4-26b-a4b-it` | – |
| Kimi K2.6 | `@cf/moonshotai/kimi-k2.6` | – |
| Mistral Small 3.1 | `@cf/mistralai/mistral-small-3.1-24b-instruct` | – |

Erster Test (Oktober 2026): drei überlappende Möbelgleiter auf einem Tisch, Art „Kunststoff Gleiter“. Ein einzelnes Foto, keine Statistik – bei anderen Teilen kann es anders aussehen. Die Liste steht in `CLOUDFLARE_BILDMODELLE` in `src/gemeinsam/zaehlen.ts`, die Reihenfolge (erstes = Voreinstellung) in `ZAEHL_MODELLE`; ein weiteres Modell ist dort eine Zeile plus Name.

**Gemini (Google):** erscheint in der Liste, sobald ein Schlüssel eingerichtet ist. Ist `GEMINI_API_KEY` gesetzt, geht Gemini direkt an Google (kostenloses Kontingent in AI Studio, für eine Inventur reichlich), sonst mit `OPENROUTER_API_KEY` über OpenRouter (ca. 1–2 Cent pro Foto, geschätzt). Optional wählt `GEMINI_MODELL` ein anderes Modell (Standard `google/gemini-3.6-flash`; bei Google wird der Vorsatz `google/` weggelassen).

**Gemini kostenlos einrichten (Google):**

1. Auf [aistudio.google.com](https://aistudio.google.com) mit einem Google-Konto anmelden → *Get API key* → *Create API key*. Schlüssel kopieren.
2. Cloudflare → *Workers & Pages → web-scanner → Einstellungen → Variablen und Geheimnisse → Hinzufügen* → Typ **Geheimnis**, Name `GEMINI_API_KEY`, Wert = der Schlüssel. Speichern.
3. Neu bereitstellen (oder auf den nächsten Push warten). In der Zählhilfe erscheint dann Gemini in der Auswahl.

Im kostenlosen Kontingent darf Google Eingaben zur Verbesserung seiner Modelle nutzen. Für Regalfotos meist unkritisch – wer das nicht will, schaltet in AI Studio die Abrechnung ein (bezahltes Kontingent, ohne diese Nutzung).

**Über OpenRouter:** wie oben, aber Name `OPENROUTER_API_KEY`, Wert = Schlüssel von openrouter.ai (mit Guthaben).

## Fehlersuche

- **In der App:** Unter dem Ergebnis klappt **„Technische Details“** auf (bei 0 Punkten automatisch). Dort steht, welches Modell gerechnet hat, wie viele Punkte kamen (und welche Anzahl das Modell selbst nennt), wie lange es dauerte und die gekürzte Antwort oder der Fehler. **„Details kopieren“** legt alles als Text in die Zwischenablage.
- **Im Cloudflare-Log:** *Workers & Pages → web-scanner → Logs* – jede Zählung schreibt eine Zeile `Zählhilfe …` mit denselben Angaben (ohne Foto).
- **Fehler statt „nichts gefunden“:** Antwortet ein Modell nicht oder nicht mit JSON, zeigt die App den Fehler samt Originaltext – nicht 0 Punkte.

## Schutz

- Nur angemeldete Personen mit dem Recht „buchen“.
- Höchstens 40 Zählungen pro Person und Stunde.
- Das Foto wird auf höchstens 1600 px verkleinert, an das Modell weitergereicht und **nicht gespeichert**.

## Technik

| Datei | Inhalt |
|---|---|
| `src/gemeinsam/zaehlen.ts` | Arten vorschlagen, Anweisung ans Modell, Antworten lesen, Doppelte zusammenführen, Codes zuordnen (getestet in `tests/zaehlen.test.ts`) |
| `src/worker/routen/zaehlen.ts` | `GET /api/zaehlen/modelle`, `POST /api/zaehlen` – ein gemeinsamer Ablauf für alle Modelle |
| `src/app/komponenten/RegalZaehlen.tsx` | Oberfläche mit Punkten, Beschriftungen und Korrektur |

Lokal: `npm run dev` verbindet Workers AI mit dem echten Cloudflare-Konto (vorher `npx wrangler login`). Ohne Konto: `CLOUDFLARE_VITE_FORCE_LOCAL=true npm run dev`. Dann läuft die App, das Zählen mit den Cloudflare-Modellen aber nicht. Die Tests laufen immer ohne Konto (`remoteBindings: false`).

## Verlauf

- **YOLOE-26n im Browser** (erste Fassung, Oktober 2026): zu ungenau. Das kleine, allgemeine Modell kannte die Teile nicht und fasste verdeckte zusammen.
- **Moondream 3.1 bei Cloudflare** (Oktober 2026, entfernt): Bei Cloudflare lieferte es ohne Datenstrom stets eine leere Antwort `{}`, die Punkte-Aufgabe lehnte den Datenstrom ab, und über den einzigen funktionierenden Weg (Frage mit Datenstrom) fand es überlappende Teile nicht oder schrieb ein Beispiel aus der Anweisung ab. Daraus stammt die Regel, in der Anweisung keine Beispielzahlen zu verwenden. Entfernt zusammen mit der Übersetzung ins Englische.
- **Bildmodelle per Chat** (seit Oktober 2026): Qwen, Llama 4 und weitere über Cloudflare, Gemini über Google oder OpenRouter – alle mit derselben Anweisung.
