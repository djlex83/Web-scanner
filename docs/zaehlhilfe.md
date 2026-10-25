# Zählhilfe bei der Inventur

In **Inventur → Regal → „Regal per Foto zählen“** nimmt man ein Foto vom Regal oder Fach auf. Die App

- liest alle Strichcodes auf dem Foto (wie „Foto auswerten“),
- zählt die Gegenstände darauf mit einem Objekterkenner,
- ordnet jeden Code dem Gegenstand zu, auf dem er klebt, und
- zeigt **grün** Gegenstände mit gelesenem Etikett, **orange** Gegenstände ohne.

Dazu kommt der Vergleich mit dem Soll („laut System 12, im Bild 11“). Die gelesenen Codes lassen sich mit einem Tipp in die Inventur übernehmen.

**Die Zählhilfe bucht nichts und ändert nichts.** Für das Inventur-Ergebnis zählen weiterhin nur gescannte Codes. Sie ist ein Hinweis, wo man genauer hinsehen sollte: Stücke ohne Etikett, verdeckte Etiketten, Dinge, die hier nicht hingehören.

## Technik

| | |
|---|---|
| Modell | YOLOE-26n (Ultralytics) mit fest eingebautem Werkstatt-/Lager-Vokabular, kein eigenes Training |
| Datei | `public/modelle/yoloe-26n-werkstatt-v1.onnx`, 10,5 MB, nur die Kasten-Ausgabe (ohne Masken) |
| Laufzeit | onnxruntime-web (WebAssembly, 1 Thread) **im Browser** – das Foto verlässt das Gerät nicht |
| Laden | erst beim ersten Zählen (Modell 10,5 MB + WebAssembly 14 MB), danach aus dem Browser-Cache |
| Kosten | keine – kein Server, keine KI-API, kein Workers-AI-Kontingent |
| Logik | `src/app/zaehlen/auswertung.ts` (rein, getestet in `tests/zaehlen.test.ts`), `modell.ts`, `komponenten/RegalZaehlen.tsx` |

Die Auswertung zählt jeden Gegenstand einmal, auch wenn das Modell ihn unter zwei Namen meldet. Kästen, die nur das Etikett sind, fliegen raus, ebenso Kästen über mehr als 45 % des Bildes (das ganze Regal). Codes ohne erkannten Gegenstand werden zur Schätzung dazugezählt.

## Was gezählt wird: das Vokabular

Das Modell kennt nur, was in `VOKABULAR` in `werkzeuge/zaehlmodell_export.py` steht: Werkzeug, Kisten, Koffer, Flaschen, Geräte, Kabel, Ordner …. Dinge, die dort fehlen, werden nicht gezählt. Stehen bei euch andere Sachen im Regal, Begriffe (englisch) ergänzen und neu exportieren:

```bash
python3 -m venv .venv && . .venv/bin/activate
pip install ultralytics onnx onnxslim onnxruntime "git+https://github.com/ultralytics/CLIP.git"
python werkzeuge/zaehlmodell_export.py --version v2
```

Dann `MODELL_URL` in `src/app/zaehlen/modell.ts` auf die neue Datei stellen und die alte löschen. Die Version muss sich ändern, sonst halten Browser die alte Datei im Cache.

## Größeres Modell

`--groesse s` erkennt kleine Gegenstände besser, die Datei hat aber **39 MB**. Cloudflare liefert Einzeldateien nur bis **25 MiB** aus. Dafür müsste man die Datei in zwei Teile schneiden und im Browser wieder zusammensetzen (nicht umgesetzt, solange n reicht).

**Nicht quantisieren** (int8): Am 25.10.2026 an der prompt-freien Variante gemessen wurde die Datei damit zwar 4× kleiner, die Treffer verschoben sich aber stark (Szenen statt Gegenstände).

## Grenzen

- Dicht gestapelte oder hintereinander stehende Dinge werden zu wenig gezählt. Lieber ein Fach pro Foto.
- Gleichartige Kleinteile (Schrauben in einer Kiste) zählt die Hilfe als **einen** Gegenstand, die Kiste.
- Genauigkeit ist bisher nur an Beispielbildern geprüft, nicht an Fotos aus eurem Lager. Bitte mit ein paar echten Regalen testen, bevor ihr euch darauf verlasst.

## Lizenz

YOLOE-26 steht wie YOLO26 unter **AGPL-3.0**. Für dieses öffentliche Repository ist das erfüllt. Wird die App nicht-öffentlich weiterverbreitet oder als Dienst für Dritte betrieben, ohne den Quellcode offenzulegen, braucht es eine Ultralytics-Enterprise-Lizenz.
