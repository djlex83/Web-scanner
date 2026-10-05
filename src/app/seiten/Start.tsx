import { AlertTriangle, ArrowRight, ArrowRightLeft, Boxes, MapPinOff, Printer, Repeat2, ScanSearch, Warehouse } from "lucide-react";
import { Link } from "react-router";
import type { Uebersicht } from "../../gemeinsam/typen";
import { BewegungsZeile } from "../komponenten/BewegungsZeile";
import { useLaden } from "../lib/hooks";
import { useIch, useSitzung } from "../lib/sitzung";
import { Abschnitt, Kennzahl, Liste } from "../ui/karte";
import { kl } from "../ui/kl";
import { FehlerHinweis, Leer, Skelett } from "../ui/zustand";

function gruss(): string {
  const h = new Date().getHours();
  return h < 11 ? "Guten Morgen" : h < 18 ? "Hallo" : "Guten Abend";
}

export default function Start() {
  const ich = useIch();
  const { darf } = useSitzung();
  const { daten, fehler, neuLaden } = useLaden<Uebersicht>("/uebersicht");
  const datum = new Intl.DateTimeFormat("de-DE", { weekday: "long", day: "numeric", month: "long" }).format(new Date());

  return (
    <div className="space-y-7">
      <header className="pt-2">
        <p className="text-[15px] font-medium capitalize text-gedaempft">{datum}</p>
        <h1 className="mt-0.5 text-[28px] font-bold tracking-tight sm:text-3xl">
          {gruss()}, {ich.name.split(" ")[0]}
        </h1>
      </header>

      <div className={kl("grid gap-3", darf("buchen") && "sm:grid-cols-2")}>
        <AktionsKarte
          zu="/scannen"
          titel="Wo ist …?"
          text="Codes scannen und sofort sehen, wo alles liegt"
          symbol={<ScanSearch />}
          hervorgehoben
        />
        {darf("buchen") && (
          <AktionsKarte
            zu="/scannen?modus=einlagern"
            titel="Einlagern"
            text="Regal scannen, Stücke scannen, fertig"
            symbol={<ArrowRightLeft />}
          />
        )}
      </div>

      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}

      {daten && daten.plaetze === 0 && darf("plaetze_verwalten") && <ErsteSchritte />}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {daten ? (
          <>
            <Kennzahl wert={daten.stuecke.toLocaleString("de-DE")} text="Stücke im Bestand" symbol={<Boxes />} zu="/stuecke" />
            <Kennzahl wert={daten.plaetze.toLocaleString("de-DE")} text="Plätze" symbol={<Warehouse />} zu="/plaetze" />
            <Kennzahl wert={daten.bewegungen_heute.toLocaleString("de-DE")} text="Bewegungen heute" symbol={<Repeat2 />} ton="erfolg" zu="/protokoll" />
            {daten.defekt > 0 ? (
              <Kennzahl wert={daten.defekt} text="als defekt markiert" symbol={<AlertTriangle />} ton="gefahr" zu="/stuecke?status=defekt" />
            ) : (
              <Kennzahl
                wert={daten.ohne_platz}
                text="ohne Platz"
                symbol={<MapPinOff />}
                ton={daten.ohne_platz ? "warnung" : "neutral"}
                zu="/stuecke?platz=ohne"
              />
            )}
          </>
        ) : (
          Array.from({ length: 4 }, (_, i) => <Skelett key={i} className="h-[124px] rounded-karte" />)
        )}
      </div>

      <Abschnitt
        titel="Letzte Bewegungen"
        aktion={
          <Link to="/protokoll" className="flex h-9 items-center gap-1 text-sm font-semibold text-primaer-text">
            Alle <ArrowRight className="size-4" />
          </Link>
        }
      >
        {daten && daten.letzte.length === 0 ? (
          <Leer symbol={<Repeat2 />} titel="Noch keine Bewegungen" text="Sobald Stücke eingelagert werden, erscheinen sie hier." />
        ) : (
          <Liste>
            {daten
              ? daten.letzte.map((b) => <BewegungsZeile key={b.id} b={b} />)
              : Array.from({ length: 3 }, (_, i) => <Skelett key={i} className="m-3 h-14" />)}
          </Liste>
        )}
      </Abschnitt>
    </div>
  );
}

function AktionsKarte({
  zu,
  titel,
  text,
  symbol,
  hervorgehoben,
}: {
  zu: string;
  titel: string;
  text: string;
  symbol: React.ReactNode;
  hervorgehoben?: boolean;
}) {
  return (
    <Link
      to={zu}
      className={kl(
        "group relative flex min-h-[132px] items-end overflow-hidden rounded-[24px] p-5 transition active:scale-[0.98]",
        hervorgehoben
          ? "bg-gradient-to-br from-primaer to-[oklch(0.55_0.2_300)] text-white shadow-[0_18px_40px_-16px_var(--primaer)]"
          : "border border-rand bg-flaeche shadow-karte hover:shadow-hoch",
      )}
    >
      <span
        className={kl(
          "absolute right-5 top-5 flex size-12 items-center justify-center rounded-2xl transition group-hover:scale-110 [&_svg]:size-6",
          hervorgehoben ? "bg-white/20" : "bg-primaer-weich text-primaer-text",
        )}
      >
        {symbol}
      </span>
      {hervorgehoben && (
        <span aria-hidden className="absolute -right-10 -top-16 size-48 rounded-full bg-white/10 blur-2xl" />
      )}
      <span className="relative">
        <span className="block text-xl font-bold tracking-tight">{titel}</span>
        <span className={kl("mt-0.5 block text-[14px]", hervorgehoben ? "text-white/80" : "text-gedaempft")}>{text}</span>
      </span>
    </Link>
  );
}

function ErsteSchritte() {
  const schritte = [
    { text: "Abteilung anlegen", unter: "z. B. Montage, Lager, Werkstatt", zu: "/plaetze", symbol: <Warehouse /> },
    { text: "Regale anlegen", unter: "in jeder Abteilung", zu: "/plaetze", symbol: <Boxes /> },
    { text: "Etiketten drucken", unter: "QR-Code an jedes Regal kleben", zu: "/plaetze", symbol: <Printer /> },
    { text: "Stücke einlagern", unter: "Regal scannen, Stücke scannen", zu: "/scannen?modus=einlagern", symbol: <ArrowRightLeft /> },
  ];
  return (
    <Abschnitt titel="Los geht’s in 4 Schritten">
      <Liste>
        {schritte.map((s, i) => (
          <Link key={s.text} to={s.zu} className="flex min-h-16 items-center gap-4 px-4 py-3 transition hover:bg-flaeche-2">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-primaer text-sm font-bold text-auf-primaer">
              {i + 1}
            </span>
            <span className="flex-1">
              <span className="block text-[15px] font-semibold">{s.text}</span>
              <span className="block text-[13px] text-gedaempft">{s.unter}</span>
            </span>
            <ArrowRight className="size-5 text-gedaempft" />
          </Link>
        ))}
      </Liste>
    </Abschnitt>
  );
}
