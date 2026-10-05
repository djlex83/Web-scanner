import type { Ctx } from "./kontext";

export const ortszeit = new Intl.DateTimeFormat("de-DE", {
  timeZone: "Europe/Berlin",
  dateStyle: "short",
  timeStyle: "medium",
});

/** Datum JJJJ-MM-TT als TT.MM.JJJJ */
export function deDatum(d: string | null): string {
  return d ? d.split("-").reverse().join(".") : "";
}

export function csv(kopf: string[], zeilen: (string | number | null)[][]): string {
  const feld = (v: string | number | null) => {
    const s = v == null ? "" : String(v);
    return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  // BOM + Semikolon, damit Excel (deutsch) Umlaute und Spalten richtig erkennt
  return "﻿" + [kopf, ...zeilen].map((z) => z.map(feld).join(";")).join("\r\n") + "\r\n";
}

export function csvAntwort(c: Ctx, name: string, inhalt: string) {
  const tag = new Date().toISOString().slice(0, 10);
  return c.body(inhalt, 200, {
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${name}-${tag}.csv"`,
  });
}
