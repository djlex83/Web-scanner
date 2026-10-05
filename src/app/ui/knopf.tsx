import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Link, type LinkProps } from "react-router";
import { kl } from "./kl";
import { Kreisel } from "./zustand";

export type KnopfArt = "primaer" | "zweit" | "leise" | "gefahr";
export type KnopfGroesse = "m" | "l" | "xl";

const ART: Record<KnopfArt, string> = {
  primaer:
    "bg-primaer text-auf-primaer shadow-[0_1px_0_0_oklch(1_0_0/0.15)_inset,0_6px_16px_-6px_var(--primaer)] hover:bg-primaer-hover",
  zweit: "bg-flaeche text-text border border-rand shadow-karte hover:bg-flaeche-2",
  leise: "text-text hover:bg-flaeche-2",
  gefahr: "bg-gefahr-weich text-gefahr-text hover:brightness-95",
};

// Touch-Ziele: mindestens 48 px, große Aktionen 56–64 px (Bedienung mit Handschuhen)
const GROESSE: Record<KnopfGroesse, string> = {
  m: "h-12 px-4 text-[15px] gap-2 rounded-xl",
  l: "h-14 px-5 text-base gap-2.5 rounded-2xl",
  xl: "h-16 px-6 text-lg gap-3 rounded-2xl",
};

export function knopfKlassen(art: KnopfArt = "zweit", groesse: KnopfGroesse = "m", breit = false) {
  return kl(
    "inline-flex items-center justify-center font-semibold select-none transition-[background,transform,filter] duration-150",
    "active:scale-[0.97] disabled:opacity-50 disabled:pointer-events-none",
    ART[art],
    GROESSE[groesse],
    breit && "w-full",
  );
}

interface KnopfProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  art?: KnopfArt;
  groesse?: KnopfGroesse;
  breit?: boolean;
  laedt?: boolean;
  symbol?: ReactNode;
}

export function Knopf({ art, groesse, breit, laedt, symbol, children, className, disabled, ...rest }: KnopfProps) {
  return (
    <button
      type="button"
      {...rest}
      disabled={disabled || laedt}
      aria-busy={laedt || undefined}
      className={kl(knopfKlassen(art, groesse, breit), className)}
    >
      {laedt ? <Kreisel klein /> : symbol}
      {children}
    </button>
  );
}

export function KnopfLink({
  art,
  groesse,
  breit,
  symbol,
  children,
  className,
  ...rest
}: LinkProps & { art?: KnopfArt; groesse?: KnopfGroesse; breit?: boolean; symbol?: ReactNode }) {
  return (
    <Link {...rest} className={kl(knopfKlassen(art, groesse, breit), className)}>
      {symbol}
      {children}
    </Link>
  );
}

/** Runder Knopf nur mit Symbol – Beschriftung als aria-label Pflicht. */
export function SymbolKnopf({
  beschriftung,
  children,
  className,
  art = "leise",
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { beschriftung: string; art?: KnopfArt }) {
  return (
    <button
      type="button"
      aria-label={beschriftung}
      title={beschriftung}
      {...rest}
      className={kl(
        "inline-flex size-12 shrink-0 items-center justify-center rounded-full transition active:scale-95 disabled:opacity-40",
        ART[art],
        className,
      )}
    >
      {children}
    </button>
  );
}
