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

export interface StueckKurz {
  id: number;
  code: string;
  name: string;
}

export interface AusleiheKurz {
  id: number;
  /** Person, die das Stück hat */
  an: string;
  /** Rückgabe bis (JJJJ-MM-TT) */
  bis: string | null;
  seit: string;
}

export interface PruefPlan {
  /** z. B. "Elektroprüfung (DGUV V3)" */
  art: string | null;
  /** Intervall in Monaten */
  intervall: number | null;
  /** nächster Termin (JJJJ-MM-TT) */
  naechste: string | null;
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
  /** wird bei der Inventur erwartet */
  inventur: boolean;
  vermisst_seit: string | null;
  /** ist selbst ein Behälter (Kiste) */
  behaelter: boolean;
  /** Anzahl Stücke im Behälter */
  inhalt: number;
  /** liegt in diesem Behälter */
  in_behaelter: StueckKurz | null;
  ausleihe: AusleiheKurz | null;
  pruefung: PruefPlan;
  /** wohin das Stück gehört: Platz (bei Behälter: dessen Platz) … */
  stammplatz: PlatzKurz | null;
  /** … oder dieser Behälter */
  stamm_behaelter: StueckKurz | null;
  /** liegt am Stammplatz? null = kein Stammplatz */
  am_stammplatz: boolean | null;
}

export type PruefErgebnis = "bestanden" | "mangel" | "nicht_bestanden";

export const PRUEF_ERGEBNIS_NAME: Record<PruefErgebnis, string> = {
  bestanden: "Bestanden",
  mangel: "Mit Mängeln",
  nicht_bestanden: "Nicht bestanden",
};

export interface Pruefung {
  id: number;
  datum: string;
  ergebnis: PruefErgebnis;
  notiz: string | null;
  naechste: string | null;
  benutzer: string;
}

export interface Ausleihe {
  id: number;
  stueck: Stueck;
  an: string;
  bis: string | null;
  notiz: string | null;
  ausgegeben_am: string;
  ausgegeben_von: string;
  zurueck_am: string | null;
  zurueck_von: string | null;
}

export interface InventurEintrag {
  id: number;
  platz: PlatzKurz | null;
  benutzer: string;
  zeitpunkt: string;
  erwartet: number;
  gefunden: number;
  fehlend: number;
  zusaetzlich: number;
  verliehen: number;
}

export interface InventurErgebnis extends InventurEintrag {
  fehlende: StueckKurz[];
  zusaetzliche: StueckKurz[];
  vorgang_id: string | null;
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
  /** mit dem Behälter mitbewegt */
  mitgefuehrt: boolean;
  stueck?: StueckKurz;
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
  vermisst: number;
  verliehen: number;
  verliehen_ueberfaellig: number;
  pruefung_ueberfaellig: number;
  pruefung_bald: number;
  nicht_am_stammplatz: number;
  letzte: Buchung[];
}

export interface Seite<T> {
  eintraege: T[];
  weitere: boolean;
}
