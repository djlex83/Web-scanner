# Design-System

Mobil zuerst, für den Einsatz im Lager: große Ziele, klare Rückmeldung, ruhige Flächen, eine Akzentfarbe.

## Grundsätze

1. **Scannen ist die Hauptsache** – immer einen Tipp entfernt (großer Knopf in der Mitte der unteren Leiste).
2. **Ort zuerst** – bei jedem Stück steht der Platz fett und groß, alles andere tritt zurück.
3. **Handschuh-tauglich** – Bedienelemente mindestens 48 × 48 px, Hauptaktionen 56–64 px hoch.
4. **Rückmeldung auf drei Kanälen** – Bild (grüner Rahmen, Animation), Ton, Vibration.
5. **Nichts geht verloren** – keine Löschknöpfe für Daten; Deaktivieren/Ausmustern statt Löschen.

## Tokens (`src/app/stil.css`)

Farben nur über Tokens verwenden (Tailwind-Klassen wie `bg-flaeche`, `text-gedaempft`), nie feste Farbwerte in Komponenten. Hell/Dunkel wird über `data-theme` am `<html>` umgeschaltet.

| Token | Verwendung |
|---|---|
| `hg` | Seitenhintergrund |
| `flaeche`, `flaeche-2` | Karten / eingelassene Flächen, Hover |
| `rand` | Trennlinien, Kartenränder (dekorativ) |
| `rand-stark` | Rahmen von Eingabefeldern und Schaltern (≥ 3:1, WCAG 1.4.11) |
| `text`, `gedaempft` | Haupttext / Nebentext |
| `primaer`, `primaer-weich`, `primaer-text`, `auf-primaer` | Akzent (Indigo): Hauptaktionen, Auswahl, Links |
| `erfolg*`, `warnung*`, `gefahr*` | Status: vorhanden / unbekannt, defekt / Fehler, Sperren |

Gemessene Kontraste (hell / dunkel): Text auf Fläche 18,1 / 16,0 · Nebentext 6,0 / 6,7 · Weiß auf Primär 5,5 / 5,8 · Status-Texte auf Status-Flächen ≥ 5,9 · Eingabe-Rahmen ≥ 3,7. Alle Werte erfüllen WCAG 2.1 AA.

**Schrift:** Inter (variabel, wird mit der App ausgeliefert). Zahlen tabellarisch (`zahlen`). Eingaben mindestens 16 px (kein Zoom auf iOS). Seitentitel 28–30 px, Listentitel 15 px, Nebentext 13 px.

**Formen:** Karten 20 px Radius, Knöpfe 12–16 px, Blätter 28 px. Schatten `shadow-karte` (ruhend), `shadow-hoch` (schwebend).

**Bewegung:** `anim-ein`, `anim-plopp`, `anim-hoch`, `anim-scan`, `anim-treffer` – kurz (≤ 0,4 s), Feder-Kurve; bei „Bewegung reduzieren“ abgeschaltet.

## Komponenten (`src/app/ui/`)

| Komponente | Zweck |
|---|---|
| `Knopf`, `KnopfLink`, `SymbolKnopf` | Arten `primaer`, `zweit`, `leise`, `gefahr`; Größen `m` 48 px, `l` 56 px, `xl` 64 px; Ladezustand; Symbol-Knöpfe immer mit Beschriftung |
| `Karte`, `Liste`, `Zeile`, `Abschnitt`, `Kennzahl` | Flächen und Listen; `Zeile` ≥ 64 px, antippbar per `zu`/`onClick` |
| `Feld`, `Eingabe`, `Textfeld`, `Auswahl` | Beschriftete Eingaben mit Hinweis/Fehler (`aria-invalid`, `aria-describedby`) |
| `Segmente`, `Chips`, `Schalter` | Umschalter (radiogroup), Filter (aria-pressed), Ein/Aus (switch) |
| `Blatt` | Unten hochgleitend am Handy, Dialog ab Tablet; Escape, Fokus bleibt im Blatt |
| `useMeldung` | Kurze Rückmeldungen – am Handy oben, am Desktop unten |
| `Abzeichen`, `StatusAbzeichen`, `RollenAbzeichen` | Status und Rollen |
| `Laden`, `Skelett`, `Leer`, `FehlerHinweis` | Lade-, Leer- und Fehlerzustände (mit „Erneut“) |

Scanner-Bausteine (`src/app/scanner/`): `Kamera` (Sucher, Treffer-Umrandung, Licht, Foto, Pause), `ManuelleEingabe`, `useHandscanner`, `TrefferKarte`, `useScanListe`.

## Barrierefreiheit

- Automatische Prüfung mit axe-core (WCAG 2.1 A/AA + Best Practices) auf allen Seiten, hell und dunkel: 0 Verstöße.
- Landmarken (`nav`, `main`, `aside`), Überschriften je Seite, Fokus sichtbar (2 px Primär-Umrandung).
- Dialoge mit `role="dialog"`, `aria-modal`, Fokusfalle und Escape; Meldungen über `aria-live`.
- Alle Funktionen auch ohne Kamera nutzbar (Eintippen, Handscanner).
