// Prüfregeln für Eingaben – der Server prüft jede Anfrage damit.
import { z } from "zod";
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

export const stueckAnlegenSchema = z.object({
  code: text(200),
  name: text(150),
  kategorie: optText(80),
  beschreibung: optText(1000),
  platz_id: z.number().int().positive().nullish(),
});

export const stueckAendernSchema = z.object({
  name: text(150).optional(),
  kategorie: optText(80),
  beschreibung: optText(1000),
  status: z.enum(["vorhanden", "defekt", "ausgemustert"]).optional(),
});

export const scanSchema = z.object({
  codes: z.array(z.string().max(200)).min(1).max(300),
});

export const buchenSchema = z.object({
  nach_platz_id: z.number().int().positive(),
  stueck_ids: z.array(z.number().int().positive()).min(1).max(300),
  notiz: optText(500),
});
