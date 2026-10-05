import { senden } from "./api";

// Fotos vor dem Hochladen verkleinern: spart Datenvolumen, Speicher und Zeit im Lager-WLAN.

async function alsBlob(canvas: HTMLCanvasElement, qualitaet: number): Promise<Blob> {
  const webp = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/webp", qualitaet));
  if (webp && webp.type === "image/webp") return webp;
  // Safari kann kein WebP erzeugen → JPEG
  const jpeg = await new Promise<Blob | null>((r) => canvas.toBlob(r, "image/jpeg", qualitaet));
  if (!jpeg) throw new Error("Foto konnte nicht verarbeitet werden");
  return jpeg;
}

function zeichnen(bild: ImageBitmap, breite: number, hoehe: number, sx = 0, sy = 0, sw = bild.width, sh = bild.height) {
  const canvas = document.createElement("canvas");
  canvas.width = breite;
  canvas.height = hoehe;
  const ctx = canvas.getContext("2d")!;
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(bild, sx, sy, sw, sh, 0, 0, breite, hoehe);
  return canvas;
}

/** Großes Bild (längste Seite ≤ 1200 px) und quadratische Vorschau (240 px, mittig beschnitten). */
export async function fotoVorbereiten(datei: File): Promise<{ bild: Blob; vorschau: Blob }> {
  let quelle: ImageBitmap;
  try {
    quelle = await createImageBitmap(datei, { imageOrientation: "from-image" });
  } catch {
    throw new Error("Dieses Bildformat wird nicht unterstützt");
  }
  try {
    const f = Math.min(1, 1200 / Math.max(quelle.width, quelle.height));
    const gross = zeichnen(quelle, Math.round(quelle.width * f), Math.round(quelle.height * f));
    const seite = Math.min(quelle.width, quelle.height);
    const klein = zeichnen(quelle, 240, 240, (quelle.width - seite) / 2, (quelle.height - seite) / 2, seite, seite);
    const [bild, vorschau] = await Promise.all([alsBlob(gross, 0.8), alsBlob(klein, 0.72)]);
    return { bild, vorschau };
  } finally {
    quelle.close();
  }
}

/** Foto verkleinern und für ein Stück hochladen; gibt die neue Foto-Version zurück. */
export async function fotoHochladen(stueckId: number, datei: File): Promise<number> {
  const { bild, vorschau } = await fotoVorbereiten(datei);
  const form = new FormData();
  form.set("bild", new File([bild], "bild", { type: bild.type }));
  form.set("vorschau", new File([vorschau], "vorschau", { type: vorschau.type }));
  const r = await senden<{ foto_version: number }>(`/stuecke/${stueckId}/foto`, form);
  return r.foto_version;
}
