// Datentypen der API – von Server und Oberfläche gemeinsam genutzt.
import type { Rolle } from "./rechte";

export type PlatzTyp = "abteilung" | "regal" | "fach";
export type StueckStatus = "vorhanden" | "defekt" | "ausgemustert";
export type BuchungsArt = "erfassen" | "umbuchen";

export const PLATZ_TYP_NAME: Record<PlatzTyp, string> = {
  abteilung: "Abteilung",
  regal: "Regal",
  fach: "Fach",
};

export const STATUS_NAME: Record<StueckStatus, string> = {
  vorhanden: "Vorhanden",
  defekt: "Defekt",
  ausgemustert: "Ausgemustert",
};

export interface Benutzer {
  id: number;
  benutzername: string;
  name: string;
  rolle: Rolle;
  aktiv: boolean;
  passwort_aendern: boolean;
  erstellt_am: string;
  letzte_anmeldung: string | null;
}

export interface PlatzKurz {
  id: number;
  name: string;
  typ: PlatzTyp;
  /** z. B. "Montage › Regal 12" */
  pfad: string;
}

export interface Platz extends PlatzKurz {
  code: string;
  eltern_id: number | null;
  notiz: string | null;
  aktiv: boolean;
  /** Stücke direkt auf diesem Platz */
  anzahl: number;
}

export interface Stueck {
  id: number;
  code: string;
  name: string;
  beschreibung: string | null;
  kategorie: string | null;
  status: StueckStatus;
  platz: PlatzKurz | null;
  bewegt_am: string | null;
  bewegt_von: string | null;
  erstellt_am: string;
  /** null = kein Foto; sonst Version für die Bild-Adresse */
  foto_version: number | null;
}

export interface Buchung {
  id: number;
  vorgang_id: string;
  art: BuchungsArt;
  zeitpunkt: string;
  benutzer: string;
  von: string | null;
  nach: string | null;
  notiz: string | null;
  stueck?: { id: number; code: string; name: string };
}

export interface ProtokollEintrag {
  id: number;
  zeitpunkt: string;
  benutzer: string | null;
  aktion: string;
  objekt_typ: string;
  objekt_id: number | null;
  text: string;
}

export type ScanTreffer =
  | { code: string; art: "stueck"; stueck: Stueck }
  | { code: string; art: "platz"; platz: Platz }
  | { code: string; art: "unbekannt" };

export interface Uebersicht {
  stuecke: number;
  ohne_platz: number;
  defekt: number;
  plaetze: number;
  bewegungen_heute: number;
  letzte: Buchung[];
}

export interface Seite<T> {
  eintraege: T[];
  weitere: boolean;
}
