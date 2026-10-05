import { ChevronRight } from "lucide-react";
import type { HTMLAttributes, ReactNode } from "react";
import { Link } from "react-router";
import { kl } from "./kl";

export function Karte({ className, ...rest }: HTMLAttributes<HTMLDivElement>) {
  return <div {...rest} className={kl("rounded-karte border border-rand bg-flaeche shadow-karte", className)} />;
}

export function Abschnitt({
  titel,
  aktion,
  children,
  className,
}: {
  titel?: ReactNode;
  aktion?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={kl("space-y-3", className)}>
      {(titel || aktion) && (
        <div className="flex min-h-8 items-center justify-between gap-3 px-1">
          {titel && <h2 className="text-[13px] font-semibold uppercase tracking-wider text-gedaempft">{titel}</h2>}
          {aktion}
        </div>
      )}
      {children}
    </section>
  );
}

/** Liste in einer Karte mit Trennlinien. */
export function Liste({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <Karte className={kl("divide-y divide-rand overflow-hidden", className)}>
      {children}
    </Karte>
  );
}

interface ZeileProps {
  symbol?: ReactNode;
  titel: ReactNode;
  unter?: ReactNode;
  rechts?: ReactNode;
  zu?: string;
  onClick?: () => void;
  className?: string;
}

/** Listenzeile, mindestens 64 px hoch; mit `zu` oder `onClick` antippbar. */
export function Zeile({ symbol, titel, unter, rechts, zu, onClick, className }: ZeileProps) {
  const inhalt = (
    <>
      {symbol && (
        <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-flaeche-2 text-gedaempft [&_svg]:size-5">
          {symbol}
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[15px] font-semibold">{titel}</div>
        {unter && <div className="mt-0.5 truncate text-[13px] text-gedaempft">{unter}</div>}
      </div>
      {rechts}
      {(zu || onClick) && <ChevronRight className="size-5 shrink-0 text-gedaempft/60" />}
    </>
  );
  const klassen = kl(
    "flex min-h-16 w-full items-center gap-3 px-4 py-3 text-left",
    (zu || onClick) && "transition-colors hover:bg-flaeche-2 active:bg-flaeche-2",
    className,
  );
  if (zu)
    return (
      <Link to={zu} className={klassen}>
        {inhalt}
      </Link>
    );
  if (onClick)
    return (
      <button type="button" onClick={onClick} className={klassen}>
        {inhalt}
      </button>
    );
  return <div className={klassen}>{inhalt}</div>;
}

/** Kennzahl-Kachel. */
export function Kennzahl({
  wert,
  text,
  symbol,
  ton = "neutral",
  zu,
}: {
  wert: ReactNode;
  text: string;
  symbol: ReactNode;
  ton?: "neutral" | "warnung" | "gefahr" | "erfolg";
  zu?: string;
}) {
  const farbe = {
    neutral: "bg-primaer-weich text-primaer-text",
    warnung: "bg-warnung-weich text-warnung-text",
    gefahr: "bg-gefahr-weich text-gefahr-text",
    erfolg: "bg-erfolg-weich text-erfolg-text",
  }[ton];
  const inhalt = (
    <>
      <div className={kl("mb-3 flex size-9 items-center justify-center rounded-xl [&_svg]:size-[18px]", farbe)}>{symbol}</div>
      <div className="zahlen text-2xl font-bold tracking-tight">{wert}</div>
      <div className="mt-0.5 text-[13px] text-gedaempft">{text}</div>
    </>
  );
  const k = "block rounded-karte border border-rand bg-flaeche p-4 shadow-karte";
  return zu ? (
    <Link to={zu} className={kl(k, "transition hover:-translate-y-0.5 hover:shadow-hoch active:scale-[0.98]")}>
      {inhalt}
    </Link>
  ) : (
    <div className={k}>{inhalt}</div>
  );
}
