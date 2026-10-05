import { ArrowLeft, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import type { Platz, Seite as Liste, Stueck } from "../../gemeinsam/typen";
import { QrCode } from "../komponenten/QrCode";
import { EIGEN_GRENZEN, EIGEN_ID, EIGEN_START, VORLAGEN, gestaltung, position, vorlageFinden, type Vorlage } from "../lib/etiketten";
import { useGespeichert, useLaden } from "../lib/hooks";
import { Auswahl, Eingabe, Feld } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf, SymbolKnopf } from "../ui/knopf";
import { FehlerHinweis, Laden } from "../ui/zustand";

const PX_JE_MM = 96 / 25.4;
const GRUPPEN = ["Etikettenbogen", "Normales Papier"] as const;

/** Verkleinerung der Blatt-Vorschau, damit das Papier auch aufs Handy passt; kleine Etiketten werden vergrößert. */
function useVorschauMassstab(papierBreiteMm: number): number {
  const breitePx = papierBreiteMm * PX_JE_MM;
  const groesster = breitePx < 400 ? 2 : 1;
  const berechnen = () => Math.min(groesster, (document.documentElement.clientWidth - 32) / breitePx);
  const [m, setM] = useState(berechnen);
  useEffect(() => {
    const anpassen = () => setM(berechnen());
    anpassen();
    window.addEventListener("resize", anpassen);
    return () => window.removeEventListener("resize", anpassen);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [breitePx]);
  return m;
}

function mm(text: string): number {
  return parseFloat(text.replace(",", "."));
}

function tipp(v: Vorlage): string {
  if (v.gruppe === "Etikettenbogen")
    return "Tipp: Im Druckdialog „Tatsächliche Größe“ bzw. Skalierung 100 % wählen und Ränder auf „Keine“ stellen.";
  if (v.gruppe === "Etikettendrucker")
    return `Tipp: Im Druckdialog den Etikettendrucker und die Etikettengröße ${v.papier.name} wählen, Skalierung 100 %.`;
  return `Tipp: Im Druckdialog Papier ${v.papier.name} und Skalierung 100 % wählen.${v.schnitt ? " Danach entlang der gestrichelten Linien schneiden." : ""}`;
}

/** Was auf ein Etikett kommt – Platz oder Behälter. */
interface EtikettDaten {
  id: number;
  code: string;
  name: string;
  /** z. B. "Lager › Regal 3" – alles vor dem Namen steht klein darüber */
  pfad: string;
}

/** Druckansicht für Etiketten von Plätzen (?ids=…) oder Behältern (?behaelter=…). */
export default function Etiketten() {
  const [param] = useSearchParams();
  const navigate = useNavigate();
  // „ws-etikett-format“ war der Schlüssel der ersten Version (klein/groß)
  const [alt] = useGespeichert<string>("ws-etikett-format", "a4-21");
  const [vorlageId, setVorlageId] = useGespeichert<string>("ws-etikett-vorlage", alt);
  const [eigen, setEigen] = useGespeichert("ws-etikett-eigen", {
    breite: String(EIGEN_START.breite),
    hoehe: String(EIGEN_START.hoehe),
  });
  const behaelter = param.get("behaelter");
  const { daten: platzDaten, fehler: platzFehler } = useLaden<Platz[]>(behaelter ? null : "/plaetze?alle=1");
  const { daten: kistenDaten, fehler: kistenFehler } = useLaden<Liste<Stueck>>(
    behaelter ? `/stuecke?ids=${encodeURIComponent(behaelter)}` : null,
  );
  const fehler = platzFehler ?? kistenFehler;
  const daten: EtikettDaten[] | null = behaelter
    ? (kistenDaten?.eintraege.map((s) => ({ id: s.id, code: s.code, name: s.name, pfad: s.platz ? `${s.platz.pfad} › ${s.name}` : s.name })) ?? null)
    : platzDaten;
  const ids = (param.get(behaelter ? "behaelter" : "ids") ?? "").split(",").map(Number).filter(Boolean);

  const plaetze = useMemo(() => {
    const nachId = new Map((daten ?? []).map((p) => [p.id, p]));
    return ids.map((i) => nachId.get(i)).filter((p): p is EtikettDaten => !!p);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [platzDaten, kistenDaten, param]);

  const v = vorlageFinden(vorlageId, { breite: mm(eigen.breite), hoehe: mm(eigen.hoehe) });
  const massstab = useVorschauMassstab(v.papier.breite);
  const proSeite = v.spalten * v.zeilen;
  const seiten: EtikettDaten[][] = [];
  for (let i = 0; i < plaetze.length; i += proSeite) seiten.push(plaetze.slice(i, i + proSeite));
  const eigenFehler = (t: string) => {
    const n = mm(t);
    return Number.isFinite(n) && n >= EIGEN_GRENZEN.min && n <= EIGEN_GRENZEN.max
      ? undefined
      : `${EIGEN_GRENZEN.min}–${EIGEN_GRENZEN.max} mm`;
  };

  return (
    <div className="min-h-dvh bg-flaeche-2 print:bg-white">
      {/* Papiergröße für den Druckdialog */}
      <style>{`@page { size: ${v.papier.breite}mm ${v.papier.hoehe}mm; margin: 0; }`}</style>
      <div className="nicht-drucken sticky top-0 z-10 border-b border-rand bg-flaeche/90 backdrop-blur-xl">
        <div className="mx-auto max-w-4xl space-y-3 px-4 py-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="flex min-w-0 flex-1 items-center gap-1">
              <SymbolKnopf beschriftung="Zurück" onClick={() => navigate(-1)} className="-ml-2">
                <ArrowLeft className="size-6" />
              </SymbolKnopf>
              <div className="min-w-0">
                <h1 className="text-lg font-bold leading-tight">Etiketten drucken</h1>
                <p className="text-[13px] text-gedaempft">
                  {plaetze.length} {plaetze.length === 1 ? "Etikett" : "Etiketten"} · {seiten.length}{" "}
                  {seiten.length === 1 ? "Seite" : "Seiten"} {v.papier.name}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              <Auswahl
                aria-label="Papier und Etikettenformat"
                value={v.id}
                onChange={(e) => setVorlageId(e.target.value)}
                className="min-w-0 flex-1 sm:w-80 sm:flex-none"
              >
                {GRUPPEN.map((g) => (
                  <optgroup key={g} label={g}>
                    {VORLAGEN.filter((x) => x.gruppe === g).map((x) => (
                      <option key={x.id} value={x.id}>
                        {x.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
                <optgroup label="Etikettendrucker">
                  <option value={EIGEN_ID}>Etikettendrucker · eigene Größe</option>
                </optgroup>
              </Auswahl>
              <Knopf art="primaer" symbol={<Printer className="size-5" />} onClick={() => window.print()} disabled={!plaetze.length}>
                Drucken
              </Knopf>
            </div>
          </div>
          {v.id === EIGEN_ID && (
            <div className="grid grid-cols-2 gap-3 sm:ml-auto sm:max-w-80">
              <Feld beschriftung="Breite (mm)" fehler={eigenFehler(eigen.breite)}>
                {(p) => (
                  <Eingabe {...p} inputMode="decimal" value={eigen.breite} onChange={(e) => setEigen({ ...eigen, breite: e.target.value })} />
                )}
              </Feld>
              <Feld beschriftung="Höhe (mm)" fehler={eigenFehler(eigen.hoehe)}>
                {(p) => (
                  <Eingabe {...p} inputMode="decimal" value={eigen.hoehe} onChange={(e) => setEigen({ ...eigen, hoehe: e.target.value })} />
                )}
              </Feld>
            </div>
          )}
          <p className="text-[13px] text-gedaempft">{tipp(v)}</p>
        </div>
      </div>

      {fehler && (
        <div className="mx-auto max-w-4xl p-4">
          <FehlerHinweis text={fehler} />
        </div>
      )}
      {!daten && !fehler && <Laden />}

      <div className="flex flex-col items-center gap-6 px-4 py-6 print:block print:p-0">
        {seiten.map((seite, i) => (
          // Vorschau auf den Bildschirm angepasst; gedruckt wird in Originalgröße
          <div
            key={i}
            className="shrink-0 print:h-auto! print:w-auto!"
            style={{ width: v.papier.breite * PX_JE_MM * massstab, height: v.papier.hoehe * PX_JE_MM * massstab }}
          >
            <div
              className="relative origin-top-left overflow-hidden bg-white text-black shadow-hoch print:transform-none! print:shadow-none"
              style={{
                width: `${v.papier.breite}mm`,
                height: `${v.papier.hoehe}mm`,
                // kein Seitenumbruch nach der letzten Seite – am Etikettendrucker kostet das ein leeres Etikett
                breakAfter: i < seiten.length - 1 ? "page" : "auto",
                transform: `scale(${massstab})`,
              }}
            >
              {seite.map((p, j) => (
                <Etikett key={p.id} platz={p} vorlage={v} nummer={j} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Etikett({ platz: p, vorlage: v, nummer }: { platz: EtikettDaten; vorlage: Vorlage; nummer: number }) {
  const pos = position(v, nummer);
  const g = gestaltung(v, p.name);
  const eltern = p.pfad.includes(" › ") ? p.pfad.slice(0, p.pfad.lastIndexOf(" › ")) : "";
  return (
    <div
      className={kl(
        "absolute flex overflow-hidden",
        g.hochkant ? "flex-col items-center justify-center gap-[3mm] text-center" : "items-center gap-[3mm]",
        v.schnitt && "outline-dashed outline-[0.2mm] -outline-offset-[0.1mm] outline-neutral-400",
      )}
      style={{
        left: `${pos.links}mm`,
        top: `${pos.oben}mm`,
        width: `${v.etikett.breite}mm`,
        height: `${v.etikett.hoehe}mm`,
        padding: `${g.rand}mm`,
      }}
    >
      <div className="shrink-0" style={{ width: `${g.qr}mm`, height: `${g.qr}mm` }}>
        <QrCode wert={p.code} className="size-full [&_svg]:size-full" />
      </div>
      <div className={kl("min-w-0", g.hochkant ? "w-full" : "flex-1")}>
        {eltern && (
          <div className="truncate font-medium text-neutral-500" style={{ fontSize: `${g.eltern}pt` }}>
            {eltern}
          </div>
        )}
        <div lang="de" className="font-bold leading-tight [overflow-wrap:break-word]" style={{ fontSize: `${g.name}pt` }}>
          {p.name}
        </div>
        <div className="mt-[1mm] truncate font-mono text-neutral-500" style={{ fontSize: `${g.code}pt` }}>
          {p.code}
        </div>
      </div>
    </div>
  );
}
