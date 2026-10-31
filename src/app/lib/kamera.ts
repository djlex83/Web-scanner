// Kamera am Rechner: Welche Kamera nehmen? Reine Logik, getestet in tests/kamera.test.ts.

// Über globalThis, weil die Datei auch von den Worker-Tests (ohne Browser-Typen) geladen wird
const fenster = globalThis as { matchMedia?: (frage: string) => { matches: boolean } };

/** Rechner mit Maus statt Handy: Dort öffnet ein Datei-Feld mit `capture` keine Kamera, sondern den Dateidialog. */
export const amRechner = typeof fenster.matchMedia === "function" && fenster.matchMedia("(hover: hover) and (pointer: fine)").matches;

export interface KameraGeraet {
  deviceId: string;
  label: string;
}

/** Sieht nach einem iPhone oder iPad aus, das macOS per Kamera-Übergabe als Kamera anbietet. */
export const istIphone = (label: string) => /iphone|ipad/i.test(label);

/**
 * Bevorzugt die zuletzt gewählte Kamera, sonst ein iPhone/iPad (Kamera-Übergabe), sonst die erste.
 * null, wenn keine Kamera da ist.
 */
export function kameraWaehlen(geraete: KameraGeraet[], gemerkt: string | null | undefined): string | null {
  if (!geraete.length) return null;
  if (gemerkt && geraete.some((g) => g.deviceId === gemerkt)) return gemerkt;
  return (geraete.find((g) => istIphone(g.label)) ?? geraete[0]!).deviceId;
}

/** Kameras ohne Namen (vor der Freigabe) bekommen eine Nummer. */
export function kameraName(g: KameraGeraet, i: number): string {
  return g.label.trim() || `Kamera ${i + 1}`;
}
