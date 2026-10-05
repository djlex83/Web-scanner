// Strichcode-Erkennung: BarcodeDetector-API über das Paket "barcode-detector"
// (zxing-cpp als WebAssembly). Funktioniert gleich auf iPhone, Android und PC.
// Die WASM-Datei wird mit der App ausgeliefert – kein Nachladen von fremden Servern.
import { BarcodeDetector, prepareZXingModule, type BarcodeFormat } from "barcode-detector/ponyfill";
import wasmUrl from "zxing-wasm/reader/zxing_reader.wasm?url";
import { normalisiereCode } from "../../gemeinsam/codes";

prepareZXingModule({
  overrides: {
    locateFile: (pfad: string, praefix: string) => (pfad.endsWith(".wasm") ? wasmUrl : praefix + pfad),
  },
});

export const FORMATE: BarcodeFormat[] = [
  "qr_code",
  "data_matrix",
  "code_128",
  "code_39",
  "code_93",
  "codabar",
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "itf",
];

let detektor: BarcodeDetector | null = null;
export function holeDetektor(): BarcodeDetector {
  detektor ??= new BarcodeDetector({ formats: FORMATE });
  return detektor;
}

export interface Fund {
  code: string;
  ecken: { x: number; y: number }[];
}

export async function erkennen(quelle: HTMLVideoElement | ImageBitmap): Promise<Fund[]> {
  const ergebnisse = await holeDetektor().detect(quelle);
  return ergebnisse
    .map((r) => ({ code: normalisiereCode(r.rawValue), ecken: r.cornerPoints }))
    .filter((f) => f.code.length > 0);
}

/** Alle Codes auf einem Foto (z. B. ein ganzes Regal mit vielen Etiketten). */
export async function fotoErkennen(datei: File): Promise<string[]> {
  const bild = await createImageBitmap(datei);
  try {
    const funde = await erkennen(bild);
    return [...new Set(funde.map((f) => f.code))];
  } finally {
    bild.close();
  }
}
