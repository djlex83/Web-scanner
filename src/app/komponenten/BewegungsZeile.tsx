import { ArrowRight, PackagePlus, Repeat2 } from "lucide-react";
import { Link } from "react-router";
import type { Buchung } from "../../gemeinsam/typen";
import { uhrzeit, vorWann } from "../lib/format";
import { kl } from "../ui/kl";

/** Eine Bewegung: wer hat was wann von wo nach wo gebracht. */
export function BewegungsZeile({ b, ohneStueck, exakt }: { b: Buchung; ohneStueck?: boolean; exakt?: boolean }) {
  const erfasst = b.art === "erfassen";
  const inhalt = (
    <>
      <div
        className={kl(
          "flex size-11 shrink-0 items-center justify-center rounded-xl [&_svg]:size-5",
          erfasst ? "bg-erfolg-weich text-erfolg-text" : "bg-primaer-weich text-primaer-text",
        )}
      >
        {erfasst ? <PackagePlus /> : <Repeat2 />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2">
          <span className="truncate text-[15px] font-semibold">
            {ohneStueck ? (erfasst ? "Erfasst" : "Umgebucht") : b.stueck?.name}
          </span>
          <span className="ml-auto shrink-0 text-[12px] text-gedaempft">{exakt ? uhrzeit(b.zeitpunkt) : vorWann(b.zeitpunkt)}</span>
        </div>
        <div className="mt-0.5 flex min-w-0 items-center gap-1.5 text-[13px] text-gedaempft">
          {b.von && (
            <>
              <span className="truncate">{b.von}</span>
              <ArrowRight className="size-3.5 shrink-0" />
            </>
          )}
          <span className="truncate font-medium text-text">{b.nach ?? "–"}</span>
        </div>
        <div className="mt-0.5 text-[12px] text-gedaempft">
          {b.benutzer}
          {b.notiz && ` · „${b.notiz}“`}
        </div>
      </div>
    </>
  );
  const k = "flex items-start gap-3 px-4 py-3";
  return !ohneStueck && b.stueck ? (
    <Link to={`/stuecke/${b.stueck.id}`} className={kl(k, "transition-colors hover:bg-flaeche-2")}>
      {inhalt}
    </Link>
  ) : (
    <div className={k}>{inhalt}</div>
  );
}
