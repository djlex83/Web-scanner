import { Camera, ScanLine, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { anzahl } from "../lib/format";
import { signalFertig } from "../lib/rueckmeldung";
import { erkennen } from "../scanner/erkennung";
import { Blatt } from "../ui/blatt";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis, Kreisel } from "../ui/zustand";
import { auswerten, type ZaehlErgebnis } from "../zaehlen/auswertung";
import { gegenstaendeFinden } from "../zaehlen/modell";

const MAX_SEITE = 1600; // größer bringt dem 640er-Modell nichts, kostet aber Speicher

type Schritt = { art: "leer" } | { art: "laeuft"; text: string; anteil?: number } | { art: "fertig"; e: ZaehlErgebnis; bild: string; breite: number; hoehe: number };

async function verkleinern(datei: File): Promise<ImageBitmap> {
  const roh = await createImageBitmap(datei, { imageOrientation: "from-image" });
  const f = Math.min(1, MAX_SEITE / Math.max(roh.width, roh.height));
  if (f === 1) return roh;
  try {
    return await createImageBitmap(roh, { resizeWidth: Math.round(roh.width * f), resizeHeight: Math.round(roh.height * f), resizeQuality: "high" });
  } finally {
    roh.close();
  }
}

async function alsBildUrl(bild: ImageBitmap): Promise<string> {
  const c = document.createElement("canvas");
  c.width = bild.width;
  c.height = bild.height;
  c.getContext("2d")!.drawImage(bild, 0, 0);
  const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg", 0.8));
  if (!blob) throw new Error("Foto konnte nicht angezeigt werden");
  return URL.createObjectURL(blob);
}

/**
 * Zählhilfe für die Inventur: Foto vom Regal → Gegenstände zählen (YOLOE-26 auf dem Gerät)
 * und mit den Strichcodes auf demselben Foto abgleichen. Nur eine Schätzung, bucht nichts.
 */
export function RegalZaehlen({
  offen,
  schliessen,
  erwartet,
  gescannt,
  beiCodes,
}: {
  offen: boolean;
  schliessen: () => void;
  /** laut System auf diesem Platz (inventurpflichtig) */
  erwartet: number;
  /** schon gescannt */
  gescannt: number;
  beiCodes: (codes: string[]) => void;
}) {
  const [schritt, setSchritt] = useState<Schritt>({ art: "leer" });
  const [fehler, setFehler] = useState<string | null>(null);
  const [uebernommen, setUebernommen] = useState(false);

  const bildUrl = schritt.art === "fertig" ? schritt.bild : null;
  useEffect(() => () => void (bildUrl && URL.revokeObjectURL(bildUrl)), [bildUrl]);

  async function zaehlen(datei: File | undefined) {
    if (!datei) return;
    setFehler(null);
    setUebernommen(false);
    let bild: ImageBitmap | null = null;
    try {
      setSchritt({ art: "laeuft", text: "Foto wird vorbereitet …" });
      bild = await verkleinern(datei);
      setSchritt({ art: "laeuft", text: "Etiketten werden gelesen …" });
      const funde = await erkennen(bild);
      setSchritt({ art: "laeuft", text: "Zählmodell wird geladen …" });
      const kaesten = await gegenstaendeFinden(bild, (anteil) =>
        setSchritt({ art: "laeuft", text: anteil < 1 ? "Zählmodell wird geladen (nur beim ersten Mal) …" : "Gegenstände werden gezählt …", anteil }),
      );
      const e = auswerten(kaesten, funde, bild.width, bild.height);
      setSchritt({ art: "fertig", e, bild: await alsBildUrl(bild), breite: bild.width, hoehe: bild.height });
      signalFertig();
    } catch (err) {
      setSchritt({ art: "leer" });
      setFehler(err instanceof Error && err.message ? err.message : "Zählen hat nicht geklappt");
    } finally {
      bild?.close();
    }
  }

  const fotoKnopf = (text: string, art: "primaer" | "zweit") => (
    <label className={kl("flex h-14 w-full cursor-pointer items-center justify-center gap-2.5 rounded-2xl text-base font-semibold transition active:scale-[0.97]", art === "primaer" ? "bg-primaer text-auf-primaer hover:bg-primaer-hover" : "border border-rand bg-flaeche shadow-karte hover:bg-flaeche-2")}>
      <Camera className="size-5" />
      {text}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(ev) => {
          void zaehlen(ev.target.files?.[0]);
          ev.target.value = "";
        }}
      />
    </label>
  );

  return (
    <Blatt offen={offen} schliessen={schliessen} titel="Regal zählen">
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}

        {schritt.art === "leer" && (
          <>
            <p className="text-[15px]">
              Ein Foto vom ganzen Regal oder Fach aufnehmen. Die App zählt die Gegenstände darauf und zeigt, welche <b>kein lesbares Etikett</b> haben.
            </p>
            <ul className="space-y-1 text-[13px] text-gedaempft">
              <li>· Gerade von vorne, gutes Licht, nichts verdeckt</li>
              <li>· Lieber ein Fach pro Foto als das ganze Regal</li>
              <li>· Läuft auf diesem Gerät – das Foto wird nicht hochgeladen</li>
            </ul>
            {fotoKnopf("Foto aufnehmen", "primaer")}
          </>
        )}

        {schritt.art === "laeuft" && (
          <div className="flex flex-col items-center gap-4 py-8 text-center" aria-live="polite">
            <Kreisel />
            <p className="text-[15px]">{schritt.text}</p>
            {schritt.anteil !== undefined && schritt.anteil < 1 && (
              <div className="h-2 w-48 overflow-hidden rounded-full bg-flaeche-2">
                <div className="h-full rounded-full bg-primaer transition-[width]" style={{ width: `${Math.round(schritt.anteil * 100)}%` }} />
              </div>
            )}
          </div>
        )}

        {schritt.art === "fertig" && (
          <>
            <div className="relative overflow-hidden rounded-2xl bg-flaeche-2">
              <img src={schritt.bild} alt="Foto mit markierten Gegenständen" className="block w-full" />
              {schritt.e.gegenstaende.map((g, i) => (
                <span
                  key={i}
                  aria-hidden
                  className={kl("absolute rounded-md border-2", g.code ? "border-erfolg bg-erfolg/10" : "border-warnung bg-warnung/20")}
                  style={{
                    left: `${(g.x1 / schritt.breite) * 100}%`,
                    top: `${(g.y1 / schritt.hoehe) * 100}%`,
                    width: `${((g.x2 - g.x1) / schritt.breite) * 100}%`,
                    height: `${((g.y2 - g.y1) / schritt.hoehe) * 100}%`,
                  }}
                />
              ))}
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <Zahl wert={schritt.e.geschaetzt} text="im Bild" />
              <Zahl wert={schritt.e.mitCode} text="mit Etikett" ton="erfolg" />
              <Zahl wert={schritt.e.ohneCode} text="ohne Etikett" ton={schritt.e.ohneCode ? "warnung" : undefined} />
            </div>

            <p className="text-[15px]">
              Laut System gehören hier <b>{anzahl(erwartet, "Stück", "Stücke")}</b> hin, gescannt sind {gescannt}.
              {schritt.e.geschaetzt > erwartet && " Im Bild ist mehr, als erwartet wird – vielleicht liegt hier etwas, das woanders eingetragen ist."}
              {schritt.e.geschaetzt < erwartet && " Im Bild ist weniger, als erwartet wird – fehlt etwas, oder ist es verdeckt?"}
            </p>
            <p className="flex items-start gap-2 text-[13px] text-gedaempft">
              <Sparkles className="mt-0.5 size-4 shrink-0" />
              Automatisch gezählt, kann sich verzählen. Für die Inventur zählen nur gescannte Codes.
            </p>

            <div className="space-y-2.5">
              {schritt.e.codes.length > 0 && (
                <Knopf
                  art="primaer"
                  groesse="l"
                  breit
                  disabled={uebernommen}
                  symbol={<ScanLine className="size-5" />}
                  onClick={() => {
                    beiCodes(schritt.e.codes);
                    setUebernommen(true);
                  }}
                >
                  {uebernommen ? "Übernommen" : `${anzahl(schritt.e.codes.length, "gelesenen Code", "gelesene Codes")} übernehmen`}
                </Knopf>
              )}
              {fotoKnopf("Neues Foto", "zweit")}
            </div>
          </>
        )}
      </div>
    </Blatt>
  );
}

function Zahl({ wert, text, ton }: { wert: number; text: string; ton?: "erfolg" | "warnung" }) {
  return (
    <div className={kl("rounded-2xl px-2 py-3", ton === "erfolg" ? "bg-erfolg-weich text-erfolg-text" : ton === "warnung" ? "bg-warnung-weich text-warnung-text" : "bg-flaeche-2")}>
      <div className="zahlen text-2xl font-bold">{wert}</div>
      <div className="text-[12px]">{text}</div>
    </div>
  );
}
