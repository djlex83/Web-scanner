// Rollen und Rechte – gilt für Server (verbindlich) und Oberfläche (nur Ausblenden).

export const ROLLEN = ["leser", "mitarbeiter", "leitung", "admin"] as const;
export type Rolle = (typeof ROLLEN)[number];

export const ROLLEN_NAME: Record<Rolle, string> = {
  leser: "Leser",
  mitarbeiter: "Mitarbeiter",
  leitung: "Leitung",
  admin: "Admin",
};

export const ROLLEN_BESCHREIBUNG: Record<Rolle, string> = {
  leser: "Scannen und nachsehen, wo etwas ist",
  mitarbeiter: "Zusätzlich Stücke einlagern, umbuchen und neu erfassen",
  leitung: "Zusätzlich Plätze und Stücke verwalten, komplettes Protokoll",
  admin: "Zusätzlich Benutzer verwalten und Datensicherung",
};

export type Recht =
  | "abfragen"
  | "buchen"
  | "erfassen"
  | "plaetze_verwalten"
  | "stuecke_verwalten"
  | "protokoll_alle"
  | "benutzer_verwalten"
  | "sicherung";

const MINDESTROLLE: Record<Recht, Rolle> = {
  abfragen: "leser",
  buchen: "mitarbeiter",
  erfassen: "mitarbeiter",
  plaetze_verwalten: "leitung",
  stuecke_verwalten: "leitung",
  protokoll_alle: "leitung",
  benutzer_verwalten: "admin",
  sicherung: "admin",
};

export function istRolle(wert: unknown): wert is Rolle {
  return typeof wert === "string" && (ROLLEN as readonly string[]).includes(wert);
}

export function darf(rolle: Rolle | undefined | null, recht: Recht): boolean {
  if (!rolle) return false;
  return ROLLEN.indexOf(rolle) >= ROLLEN.indexOf(MINDESTROLLE[recht]);
}
