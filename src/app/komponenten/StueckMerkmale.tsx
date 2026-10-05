import { AlertTriangle, Box, Handshake, PackageOpen, SearchX, Wrench } from "lucide-react";
import { heute, plusTage } from "../../gemeinsam/datum";
import type { Stueck } from "../../gemeinsam/typen";
import { Abzeichen, StatusAbzeichen } from "../ui/abzeichen";
import { kl } from "../ui/kl";

export type PruefStand = "ueberfaellig" | "bald" | "ok";

/** Prüftermin: überfällig, in den nächsten 30 Tagen oder später (null = kein Termin). */
export function pruefStand(naechste: string | null): PruefStand | null {
  if (!naechste) return null;
  const h = heute();
  if (naechste < h) return "ueberfaellig";
  return naechste <= plusTage(h, 30) ? "bald" : "ok";
}

export const istUeberfaellig = (bis: string | null) => !!bis && bis < heute();

/** TT.MM.JJJJ aus JJJJ-MM-TT */
export const datumText = (d: string | null) => (d ? d.split("-").reverse().join(".") : "–");

/** Kurze Abzeichen: Status, vermisst, verliehen, Prüfung, Behälter. */
export function StueckMerkmale({
  stueck: s,
  max,
  mitBehaelter = true,
  className,
}: {
  stueck: Stueck;
  /** höchstens so viele Abzeichen (für Listenzeilen) */
  max?: number;
  mitBehaelter?: boolean;
  className?: string;
}) {
  const liste: React.ReactNode[] = [];
  if (s.vermisst_seit)
    liste.push(
      <Abzeichen key="v" ton="gefahr">
        <SearchX /> Vermisst
      </Abzeichen>,
    );
  if (s.status !== "vorhanden") liste.push(<StatusAbzeichen key="s" status={s.status} />);
  if (s.ausleihe)
    liste.push(
      <Abzeichen key="a" ton={istUeberfaellig(s.ausleihe.bis) ? "gefahr" : "warnung"}>
        <Handshake /> {istUeberfaellig(s.ausleihe.bis) ? "Rückgabe überfällig" : `Bei ${s.ausleihe.an}`}
      </Abzeichen>,
    );
  const p = pruefStand(s.pruefung.naechste);
  if (p === "ueberfaellig" || p === "bald")
    liste.push(
      <Abzeichen key="p" ton={p === "ueberfaellig" ? "gefahr" : "warnung"}>
        {p === "ueberfaellig" ? <AlertTriangle /> : <Wrench />} {p === "ueberfaellig" ? "Prüfung überfällig" : "Prüfung bald"}
      </Abzeichen>,
    );
  if (mitBehaelter && s.behaelter)
    liste.push(
      <Abzeichen key="b" ton="primaer">
        <PackageOpen /> Behälter · {s.inhalt}
      </Abzeichen>,
    );
  if (mitBehaelter && s.in_behaelter)
    liste.push(
      <Abzeichen key="i" className="max-w-40">
        <Box /> <span className="truncate">{s.in_behaelter.name}</span>
      </Abzeichen>,
    );
  if (!liste.length) return null;
  return <span className={kl("flex flex-wrap items-center gap-1.5", className)}>{max ? liste.slice(0, max) : liste}</span>;
}
