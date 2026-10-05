import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Platz } from "../../gemeinsam/typen";
import { QrCode } from "../komponenten/QrCode";
import { useGespeichert, useLaden } from "../lib/hooks";
import { Segmente } from "../ui/formular";
import { Knopf, SymbolKnopf } from "../ui/knopf";
import { FehlerHinweis, Laden } from "../ui/zustand";

// Maße gängiger A4-Etikettenbögen (in mm)
const FORMATE = {
  klein: { spalten: 3, zeilen: 7, breite: 63.5, hoehe: 38.1, oben: 15.15, links: 7.2, abstand: 2.5, name: "21 pro Bogen (63,5 × 38,1 mm)" },
  gross: { spalten: 2, zeilen: 4, breite: 99.1, hoehe: 67.7, oben: 13.1, links: 4.65, abstand: 2.5, name: "8 pro Bogen (99,1 × 67,7 mm)" },
} as const;
type Format = keyof typeof FORMATE;

/** Schriftgröße so wählen, dass auch lange Namen auf das Etikett passen. */
function schrift(name: string, format: Format): number {
  // Zeichen, die bei voller Schriftgröße in eine Zeile passen
  const [max, min, zeichen] = format === "gross" ? [26, 12, 7] : [15, 8, 6];
  const laengstesWort = Math.max(...name.split(/\s+/).map((w) => w.length));
  return Math.max(min, Math.min(max, (max * zeichen) / Math.max(laengstesWort, zeichen)));
}

// A4 in CSS-Pixeln (96 dpi)
const A4_BREITE_PX = (210 / 25.4) * 96;
const A4_HOEHE_PX = (297 / 25.4) * 96;

/** Verkleinerung der Bogen-Vorschau, damit A4 auch aufs Handy passt (nie größer als 100 %). */
function useVorschauMassstab(): number {
  const [m, setM] = useState(1);
  useEffect(() => {
    const anpassen = () => setM(Math.min(1, (document.documentElement.clientWidth - 32) / A4_BREITE_PX));
    anpassen();
    window.addEventListener("resize", anpassen);
    return () => window.removeEventListener("resize", anpassen);
  }, []);
  return m;
}

/** Druckansicht für Platz-Etiketten. */
export default function Etiketten() {
  const [param] = useSearchParams();
  const navigate = useNavigate();
  const [format, setFormat] = useGespeichert<Format>("ws-etikett-format", "klein");
  const { daten, fehler } = useLaden<Platz[]>("/plaetze?alle=1");
  const ids = (param.get("ids") ?? "").split(",").map(Number).filter(Boolean);

  const plaetze = useMemo(() => {
    const nachId = new Map((daten ?? []).map((p) => [p.id, p]));
    return ids.map((i) => nachId.get(i)).filter((p): p is Platz => !!p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [daten, param]);

  const massstab = useVorschauMassstab();
  const f = FORMATE[format];
  const proBogen = f.spalten * f.zeilen;
  const boegen: Platz[][] = [];
  for (let i = 0; i < plaetze.length; i += proBogen) boegen.push(plaetze.slice(i, i + proBogen));

  return (
    <div className="min-h-dvh bg-flaeche-2 print:bg-white">
      <div className="nicht-drucken sticky top-0 z-10 border-b border-rand bg-flaeche/90 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl space-y-2 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <SymbolKnopf beschriftung="Zurück" onClick={() => navigate(-1)} className="-ml-2">
                <ArrowLeft className="size-6" />
              </SymbolKnopf>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight">Etiketten drucken</h1>
                <p className="text-[13px] text-gedaempft">
                  {plaetze.length} {plaetze.length === 1 ? "Etikett" : "Etiketten"} · {boegen.length}{" "}
                  {boegen.length === 1 ? "Bogen" : "Bögen"} · {f.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Segmente
                beschriftung="Etikettenformat"
                wert={format}
                aendern={setFormat}
                optionen={[
                  { wert: "klein", text: "Klein" },
                  { wert: "gross", text: "Groß" },
                ]}
                className="flex-1 sm:w-56 sm:flex-none"
              />
              <Knopf art="primaer" symbol={<Printer className="size-5" />} onClick={() => window.print()} disabled={!plaetze.length}>
                Drucken
              </Knopf>
            </div>
          </div>
          <p className="text-[13px] text-gedaempft">
            Tipp: Im Druckdialog „Tatsächliche Größe“ bzw. Skalierung 100 % wählen und Ränder auf „Keine“ stellen.
          </p>
        </div>
      </div>

      {fehler && (
        <div className="mx-auto max-w-4xl p-4">
          <FehlerHinweis text={fehler} />
        </div>
      )}
      {!daten && !fehler && <Laden />}

      <div className="flex flex-col items-center gap-6 px-4 py-6 print:block print:p-0">
        {boegen.map((bogen, i) => (
          // Vorschau auf den Bildschirm verkleinert; gedruckt wird in Originalgröße
          <div
            key={i}
            className="shrink-0 print:h-auto! print:w-auto!"
            style={{ width: A4_BREITE_PX * massstab, height: A4_HOEHE_PX * massstab }}
          >
          <div
            className="relative origin-top-left bg-white text-black shadow-hoch print:transform-none! print:shadow-none"
            style={{ width: "210mm", height: "297mm", breakAfter: "page", overflow: "hidden", transform: `scale(${massstab})` }}
          >
            {bogen.map((p, j) => {
              const spalte = j % f.spalten;
              const zeile = Math.floor(j / f.spalten);
              const eltern = p.pfad.includes(" › ") ? p.pfad.slice(0, p.pfad.lastIndexOf(" › ")) : "";
              const qr = Math.min(f.hoehe - 8, f.breite * 0.45);
              return (
                <div
                  key={p.id}
                  className="absolute flex items-center gap-[3mm] overflow-hidden"
                  style={{
                    left: `${f.links + spalte * (f.breite + f.abstand)}mm`,
                    top: `${f.oben + zeile * f.hoehe}mm`,
                    width: `${f.breite}mm`,
                    height: `${f.hoehe}mm`,
                    padding: "4mm",
                  }}
                >
                  <div className="shrink-0" style={{ width: `${qr}mm`, height: `${qr}mm` }}>
                    <QrCode wert={p.code} className="size-full [&_svg]:size-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    {eltern && <div className="truncate text-[9pt] font-medium text-neutral-500">{eltern}</div>}
                    <div lang="de" className="font-bold leading-tight [overflow-wrap:break-word]" style={{ fontSize: `${schrift(p.name, format)}pt` }}>
                      {p.name}
                    </div>
                    <div className="mt-[1mm] truncate font-mono text-[7pt] text-neutral-500">{p.code}</div>
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        ))}
      </div>
    </div>
  );
}
