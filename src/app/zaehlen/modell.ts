// Objekterkennung im Browser: YOLOE-26 mit fest eingebautem Werkstatt-/Lager-Vokabular (ohne Training)
// über onnxruntime-web. Läuft vollständig auf dem Gerät – das Foto verlässt es nicht.
// Modell und WebAssembly werden mit der App ausgeliefert und erst beim ersten Zählen geladen.
import type { InferenceSession } from "onnxruntime-web";
import { ausgabeLesen, rahmenBerechnen, type Kasten } from "./auswertung";

/** Liegt in public/modelle/ – Erzeugung: werkzeuge/zaehlmodell_export.py, siehe docs/zaehlhilfe.md */
export const MODELL_URL = "/modelle/yoloe-26n-werkstatt-v1.onnx";
const EINGANG = 640;
const SCHWELLE = 0.25;

let sitzung: Promise<InferenceSession> | null = null;

async function laden(fortschritt?: (anteil: number) => void): Promise<InferenceSession> {
  const [ort, { default: wasmUrl }] = await Promise.all([
    import("onnxruntime-web/wasm"),
    import("onnxruntime-web/ort-wasm-simd-threaded.wasm?url"),
  ]);
  ort.env.wasm.wasmPaths = { wasm: wasmUrl };
  // Mehrere Threads bräuchten Cross-Origin-Isolation (COOP/COEP); ein Thread reicht für ein Foto.
  ort.env.wasm.numThreads = 1;

  const antwort = await fetch(MODELL_URL);
  if (!antwort.ok || !antwort.body) throw new Error("Zählmodell konnte nicht geladen werden");
  const gesamt = Number(antwort.headers.get("content-length")) || 0;
  const leser = antwort.body.getReader();
  const teile: Uint8Array[] = [];
  let geladen = 0;
  for (;;) {
    const { done, value } = await leser.read();
    if (done) break;
    teile.push(value);
    geladen += value.length;
    if (gesamt) fortschritt?.(Math.min(1, geladen / gesamt));
  }
  const bytes = new Uint8Array(geladen);
  let pos = 0;
  for (const t of teile) {
    bytes.set(t, pos);
    pos += t.length;
  }
  return ort.InferenceSession.create(bytes, { executionProviders: ["wasm"], graphOptimizationLevel: "all" });
}

/** Lädt das Modell einmal je Sitzung; ein Fehlschlag darf beim nächsten Versuch neu laden. */
export function modellLaden(fortschritt?: (anteil: number) => void): Promise<InferenceSession> {
  sitzung ??= laden(fortschritt).catch((e: unknown) => {
    sitzung = null;
    throw e;
  });
  return sitzung;
}

/** Foto auf 640×640 einpassen (Ränder grau wie beim Training) und als CHW-Float32 liefern. */
function eingabeBauen(bild: ImageBitmap): Float32Array {
  const r = rahmenBerechnen(bild.width, bild.height, EINGANG);
  const canvas = document.createElement("canvas");
  canvas.width = EINGANG;
  canvas.height = EINGANG;
  const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
  ctx.fillStyle = "rgb(114,114,114)";
  ctx.fillRect(0, 0, EINGANG, EINGANG);
  ctx.drawImage(bild, r.versatzX, r.versatzY, bild.width * r.faktor, bild.height * r.faktor);
  const pixel = ctx.getImageData(0, 0, EINGANG, EINGANG).data;
  const n = EINGANG * EINGANG;
  const daten = new Float32Array(3 * n);
  for (let i = 0; i < n; i++) {
    daten[i] = pixel[i * 4]! / 255;
    daten[n + i] = pixel[i * 4 + 1]! / 255;
    daten[2 * n + i] = pixel[i * 4 + 2]! / 255;
  }
  return daten;
}

/** Gegenstände im Foto finden; Koordinaten beziehen sich auf das übergebene Bild. */
export async function gegenstaendeFinden(bild: ImageBitmap, fortschritt?: (anteil: number) => void): Promise<Kasten[]> {
  const s = await modellLaden(fortschritt);
  const ort = await import("onnxruntime-web/wasm");
  const eingang = new ort.Tensor("float32", eingabeBauen(bild), [1, 3, EINGANG, EINGANG]);
  const ausgaben = await s.run({ [s.inputNames[0]!]: eingang });
  // Erste Ausgabe: [1, N, 6 + Masken-Koeffizienten]; die Masken (zweite Ausgabe) brauchen wir nicht.
  const erste = ausgaben[s.outputNames[0]!]!;
  const spalten = erste.dims[erste.dims.length - 1]!;
  const kaesten = ausgabeLesen(erste.data as Float32Array, spalten, rahmenBerechnen(bild.width, bild.height, EINGANG), SCHWELLE);
  for (const t of Object.values(ausgaben)) t.dispose();
  eingang.dispose();
  return kaesten;
}
