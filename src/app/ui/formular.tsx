import { useId, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";
import { kl } from "./kl";

const EINGABE =
  "w-full rounded-xl border border-rand-stark bg-flaeche px-4 text-[16px] text-text placeholder:text-gedaempft/70 " +
  "transition focus:border-primaer focus:outline-none focus:ring-4 focus:ring-primaer/15 disabled:opacity-60 " +
  "aria-[invalid=true]:border-gefahr aria-[invalid=true]:ring-gefahr/15";

interface FeldProps {
  beschriftung: string;
  hinweis?: ReactNode;
  fehler?: string | null;
  children: (props: { id: string; "aria-invalid"?: boolean; "aria-describedby"?: string }) => ReactNode;
}

/** Beschriftetes Eingabefeld mit Hinweis- und Fehlertext. */
export function Feld({ beschriftung, hinweis, fehler, children }: FeldProps) {
  const id = useId();
  const unterId = hinweis || fehler ? id + "-unter" : undefined;
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="block px-1 text-sm font-semibold">
        {beschriftung}
      </label>
      {children({ id, "aria-invalid": fehler ? true : undefined, "aria-describedby": unterId })}
      {(fehler || hinweis) && (
        <p id={unterId} className={kl("px-1 text-[13px]", fehler ? "font-medium text-gefahr-text" : "text-gedaempft")}>
          {fehler || hinweis}
        </p>
      )}
    </div>
  );
}

export function Eingabe({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...rest} className={kl(EINGABE, "h-12", className)} />;
}

export function Textfeld({ className, ...rest }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea rows={3} {...rest} className={kl(EINGABE, "py-3", className)} />;
}

export function Auswahl({ className, children, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...rest}
      className={kl(
        EINGABE,
        "h-12 appearance-none bg-[length:20px] bg-[right_12px_center] bg-no-repeat pr-10",
        "bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23888%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')]",
        className,
      )}
    >
      {children}
    </select>
  );
}

/** Ein/Aus-Schalter als echte Checkbox (Tastatur, Screenreader). */
export function Schalter({
  an,
  aendern,
  beschriftung,
  beschreibung,
}: {
  an: boolean;
  aendern: (an: boolean) => void;
  beschriftung: string;
  beschreibung?: string;
}) {
  return (
    <label className="flex min-h-16 cursor-pointer items-center gap-4 px-4 py-3">
      <span className="flex-1">
        <span className="block text-[15px] font-semibold">{beschriftung}</span>
        {beschreibung && <span className="mt-0.5 block text-[13px] text-gedaempft">{beschreibung}</span>}
      </span>
      <input type="checkbox" role="switch" checked={an} onChange={(e) => aendern(e.target.checked)} className="peer sr-only" />
      <span
        aria-hidden
        className="relative h-8 w-[52px] shrink-0 rounded-full bg-rand-stark transition-colors peer-checked:bg-primaer peer-focus-visible:ring-4 peer-focus-visible:ring-primaer/30 after:absolute after:left-1 after:top-1 after:size-6 after:rounded-full after:bg-white after:shadow after:transition-transform after:duration-200 peer-checked:after:translate-x-5"
      />
    </label>
  );
}

/** Segment-Umschalter (z. B. Modus wählen). */
export function Segmente<T extends string>({
  wert,
  aendern,
  optionen,
  beschriftung,
  className,
}: {
  wert: T;
  aendern: (w: T) => void;
  optionen: { wert: T; text: string; symbol?: ReactNode }[];
  beschriftung: string;
  className?: string;
}) {
  // Ab vier Optionen Symbol über dem Text, damit alles auch am Handy in eine Zeile passt
  const gestapelt = optionen.length >= 4;
  return (
    <div role="radiogroup" aria-label={beschriftung} className={kl("flex rounded-2xl bg-flaeche-2 p-1", className)}>
      {optionen.map((o) => {
        const aktiv = o.wert === wert;
        return (
          <button
            key={o.wert}
            type="button"
            role="radio"
            aria-checked={aktiv}
            onClick={() => aendern(o.wert)}
            className={kl(
              "flex min-w-0 flex-1 items-center justify-center rounded-xl font-semibold transition-all [&_svg]:size-[18px]",
              gestapelt ? "h-14 flex-col gap-0.5 text-[12px] leading-tight" : "h-11 gap-2 text-[15px]",
              aktiv ? "bg-flaeche text-text shadow-karte dark:bg-rand" : "text-gedaempft hover:text-text",
            )}
          >
            {o.symbol}
            {o.text}
          </button>
        );
      })}
    </div>
  );
}

/** Auswahl-Chips (z. B. Kategorien, Filter). */
export function Chips({
  optionen,
  wert,
  aendern,
}: {
  optionen: { wert: string; text: string }[];
  wert: string;
  aendern: (w: string) => void;
}) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 [scrollbar-width:none]">
      {optionen.map((o) => (
        <button
          key={o.wert}
          type="button"
          aria-pressed={o.wert === wert}
          onClick={() => aendern(o.wert)}
          className={kl(
            "h-10 shrink-0 rounded-full border px-4 text-sm font-semibold transition",
            o.wert === wert
              ? "border-transparent bg-text text-hg"
              : "border-rand bg-flaeche text-gedaempft hover:text-text",
          )}
        >
          {o.text}
        </button>
      ))}
    </div>
  );
}
