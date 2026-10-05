import type { ReactNode } from "react";
import { ROLLEN_NAME, type Rolle } from "../../gemeinsam/rechte";
import { STATUS_NAME, type StueckStatus } from "../../gemeinsam/typen";
import { kl } from "./kl";

export type Ton = "neutral" | "primaer" | "erfolg" | "warnung" | "gefahr";

const TON: Record<Ton, string> = {
  neutral: "bg-flaeche-2 text-gedaempft",
  primaer: "bg-primaer-weich text-primaer-text",
  erfolg: "bg-erfolg-weich text-erfolg-text",
  warnung: "bg-warnung-weich text-warnung-text",
  gefahr: "bg-gefahr-weich text-gefahr-text",
};

export function Abzeichen({ ton = "neutral", children, className }: { ton?: Ton; children: ReactNode; className?: string }) {
  return (
    <span
      className={kl(
        "inline-flex h-6 shrink-0 items-center gap-1 rounded-full px-2.5 text-xs font-semibold [&_svg]:size-3.5",
        TON[ton],
        className,
      )}
    >
      {children}
    </span>
  );
}

const STATUS_TON: Record<StueckStatus, Ton> = { vorhanden: "erfolg", defekt: "warnung", ausgemustert: "neutral" };

export function StatusAbzeichen({ status }: { status: StueckStatus }) {
  return <Abzeichen ton={STATUS_TON[status]}>{STATUS_NAME[status]}</Abzeichen>;
}

const ROLLEN_TON: Record<Rolle, Ton> = { leser: "neutral", mitarbeiter: "primaer", leitung: "warnung", admin: "gefahr" };

export function RollenAbzeichen({ rolle }: { rolle: Rolle }) {
  return <Abzeichen ton={ROLLEN_TON[rolle]}>{ROLLEN_NAME[rolle]}</Abzeichen>;
}
