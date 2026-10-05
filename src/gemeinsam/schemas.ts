// Prüfregeln für Eingaben – der Server prüft jede Anfrage damit.
import { z } from "zod";
import { FARBEN, SYMBOLE } from "./kategorien";
import { ROLLEN } from "./rechte";

const text = (max: number) => z.string().trim().min(1, "Pflichtfeld").max(max);
const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .nullish()
    .transform((v) => (v ? v : null));

export const passwortSchema = z
  .string()
  .min(8, "Mindestens 8 Zeichen")
  .max(200, "Höchstens 200 Zeichen");

export const benutzernameSchema = z
  .string()
  .trim()
  .min(2, "Mindestens 2 Zeichen")
  .max(50)
  .regex(/^[\p{L}\p{N}._-]+$/u, "Nur Buchstaben, Ziffern, Punkt, Minus, Unterstrich");

export const anmeldenSchema = z.object({
  benutzername: z.string().trim().min(1).max(50),
  passwort: z.string().min(1).max(200),
  angemeldet_bleiben: z.boolean().optional().default(false),
});

export const einrichtenSchema = z.object({
  benutzername: benutzernameSchema,
  name: text(100),
  passwort: passwortSchema,
});

export const passwortAendernSchema = z.object({
  alt: z.string().min(1).max(200),
  neu: passwortSchema,
});

export const notfallSchema = z.object({
  code: z.string().trim().min(1, "Pflichtfeld").max(200),
  benutzername: z.string().trim().min(1, "Pflichtfeld").max(50),
  neues_passwort: passwortSchema,
});

export const benutzerAnlegenSchema = z.object({
  benutzername: benutzernameSchema,
  name: text(100),
  rolle: z.enum(ROLLEN),
  passwort: passwortSchema,
});

export const benutzerAendernSchema = z.object({
  name: text(100).optional(),
  rolle: z.enum(ROLLEN).optional(),
  aktiv: z.boolean().optional(),
  passwort: passwortSchema.optional(),
});

export const platzAnlegenSchema = z.object({
  name: text(100),
  typ: z.enum(["abteilung", "regal", "fach"]),
  eltern_id: z.number().int().positive().nullish(),
  notiz: optText(500),
});

export const platzAendernSchema = z.object({
  name: text(100).optional(),
  notiz: optText(500),
  aktiv: z.boolean().optional(),
});

const datum = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Datum als JJJJ-MM-TT");
const ids = (max = 300) => z.array(z.number().int().positive()).min(1).max(max);

export const stueckAnlegenSchema = z
  .object({
    /** leer nur bei Behältern – dann vergibt der Server einen Code */
    code: optText(200),
    name: text(150),
    kategorie: optText(80),
    beschreibung: optText(1000),
    platz_id: z.number().int().positive().nullish(),
    /** gleich in diesen Behälter legen (statt platz_id) */
    in_behaelter_id: z.number().int().positive().nullish(),
    behaelter: z.boolean().optional().default(false),
    inventur: z.boolean().optional().default(true),
  })
  .refine((e) => e.code || e.behaelter, { message: "Pflichtfeld", path: ["code"] });

export const stueckAendernSchema = z.object({
  name: text(150).optional(),
  kategorie: optText(80),
  beschreibung: optText(1000),
  status: z.enum(["vorhanden", "defekt", "ausgemustert"]).optional(),
  behaelter: z.boolean().optional(),
  inventur: z.boolean().optional(),
  pruef_art: optText(100),
  pruef_intervall: z.number().int().min(1).max(120).nullish(),
  pruef_naechste: datum.nullish(),
});

export const kategorieStilSchema = z.object({
  symbol: z.enum(SYMBOLE),
  farbe: z.enum(FARBEN),
});

export const scanSchema = z.object({
  codes: z.array(z.string().max(200)).min(1).max(300),
});

export const buchenSchema = z
  .object({
    nach_platz_id: z.number().int().positive().nullish(),
    /** Ziel ist ein Behälter statt eines Platzes */
    nach_behaelter_id: z.number().int().positive().nullish(),
    stueck_ids: ids(),
    notiz: optText(500),
    /** Ziel zugleich als neuen Stammplatz der Stücke festlegen */
    stammplatz: z.boolean().optional().default(false),
  })
  .refine((e) => !e.nach_platz_id !== !e.nach_behaelter_id, { message: "Genau ein Ziel angeben", path: ["nach_platz_id"] });

/** Stammplatz festlegen: Platz, Behälter, den aktuellen Ort – oder nichts davon = entfernen */
export const stammplatzSchema = z
  .object({
    stueck_ids: ids(),
    platz_id: z.number().int().positive().nullish(),
    behaelter_id: z.number().int().positive().nullish(),
    aktuell: z.boolean().optional(),
  })
  .refine((e) => [e.platz_id, e.behaelter_id, e.aktuell].filter(Boolean).length <= 1, {
    message: "Höchstens ein Ziel angeben",
    path: ["platz_id"],
  });

export const rueckgaengigSchema = z.object({
  vorgang_id: z.string().uuid(),
});

export const stueckListeSchema = z.object({
  stueck_ids: ids(),
  notiz: optText(500),
});

export const ausleihenSchema = z.object({
  stueck_ids: ids(),
  an: text(100),
  bis: datum.nullish(),
  notiz: optText(500),
});

export const pruefungSchema = z.object({
  stueck_id: z.number().int().positive(),
  datum,
  ergebnis: z.enum(["bestanden", "mangel", "nicht_bestanden"]),
  notiz: optText(1000),
  /** leer = aus dem Intervall berechnen */
  naechste: datum.nullish(),
});

export const inventurSchema = z.object({
  platz_id: z.number().int().positive(),
  gefunden_ids: z.array(z.number().int().positive()).max(2000),
  /** Stücke, die hier gefunden wurden, aber woanders eingetragen sind, hierher buchen */
  zusaetzliche_buchen: z.boolean(),
  /** Fehlende Stücke als vermisst melden */
  fehlende_vermisst: z.boolean(),
});
