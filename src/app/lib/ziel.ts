import type { PlatzKurz, Stueck } from "../../gemeinsam/typen";

/** Wohin eingelagert wird: ein Platz (Regal, Fach …) oder ein Behälter (Kiste). */
export type Ziel = { art: "platz"; platz: PlatzKurz } | { art: "behaelter"; stueck: Stueck };

export function zielName(z: Ziel): string {
  return z.art === "platz" ? z.platz.name : z.stueck.name;
}

export function zielPfad(z: Ziel): string {
  if (z.art === "platz") return z.platz.pfad;
  return z.stueck.platz ? `${z.stueck.platz.pfad} › ${z.stueck.name}` : z.stueck.name;
}

/** Felder für POST /buchungen */
export function zielFelder(z: Ziel) {
  return z.art === "platz" ? { nach_platz_id: z.platz.id } : { nach_behaelter_id: z.stueck.id };
}

/** Liegt das Stück schon am Ziel? */
export function schonDort(z: Ziel, s: Stueck): boolean {
  return z.art === "platz" ? s.platz?.id === z.platz.id && !s.in_behaelter : s.in_behaelter?.id === z.stueck.id;
}

/** Warum das Stück nicht ans Ziel kann (oder null). */
export function nichtMoeglich(z: Ziel, s: Stueck): string | null {
  if (s.status === "ausgemustert") return "Ausgemustert";
  if (z.art === "behaelter" && s.id === z.stueck.id) return "Ist das Ziel selbst";
  if (z.art === "behaelter" && s.behaelter) return "Behälter passt nicht in Behälter";
  return null;
}
