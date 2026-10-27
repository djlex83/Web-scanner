import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zaehlenSchema } from "../../gemeinsam/schemas";
import {
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  moondreamPunkte,
  type ZaehlAntwort,
  type ZaehlPunkt,
} from "../../gemeinsam/zaehlen";
import { drosseln } from "../auth/drossel";
import { benutzerVon, braucht, eingabe, fehler, type AppEnv } from "../kontext";

// Zählhilfe: Foto + Arten → ein Punkt je gefundenem Teil. Das Foto wird nur weitergereicht, nie gespeichert.

const MOONDREAM = "@cf/moondream/moondream3.1-9B-A2B";
const UEBERSETZER = "@cf/meta/m2m100-1.2b";
const GEMINI_STANDARD = "google/gemini-3.6-flash";

export const zaehlenRouten = new Hono<AppEnv>();

function kiFehler(err: unknown, modell: string): never {
  const text = err instanceof Error ? err.message : String(err);
  console.error(`Zählhilfe ${modell}:`, text);
  if (/neuron|4006|daily|quota|rate limit|429/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: Tageskontingent aufgebraucht – bitte morgen erneut oder das andere Modell nehmen` });
  }
  throw new HTTPException(502, { message: `${modell} hat nicht geantwortet – bitte erneut versuchen` });
}

/** Moondream versteht englische Begriffe am besten; deutsche Texte vorher übersetzen (Fehlschlag = Original). */
async function insEnglische(ai: Ai, text: string): Promise<string> {
  try {
    const r = (await ai.run(UEBERSETZER as keyof AiModels, { text, source_lang: "de", target_lang: "en" } as never)) as {
      translated_text?: string;
    };
    return r.translated_text?.trim() || text;
  } catch {
    return text;
  }
}

async function mitMoondream(ai: Ai, bild: string, ziele: string[], breite: number, hoehe: number): Promise<ZaehlPunkt[]> {
  const englisch = await Promise.all(ziele.map((t) => insEnglische(ai, t)));
  const je = await Promise.all(
    englisch.map(async (target, i) => {
      try {
        const r = (await ai.run(MOONDREAM as keyof AiModels, { task: "point", image: bild, target, max_objects: 300 } as never)) as {
          points?: { x: number; y: number }[] | null;
        };
        return moondreamPunkte(r.points, i, breite, hoehe);
      } catch (err) {
        kiFehler(err, "Moondream");
      }
    }),
  );
  return je.flat();
}

async function mitGemini(env: Env, bild: string, ziele: string[]): Promise<ZaehlPunkt[]> {
  let antwort: Response;
  try {
    antwort = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY!.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: env.GEMINI_MODELL?.trim() || GEMINI_STANDARD,
        temperature: 0,
        max_tokens: 12000,
        // Zählen profitiert vom Nachdenken; "low" würde fast nichts denken, "high" kostet deutlich mehr
        reasoning: { effort: "medium" },
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: geminiAnweisung(ziele) },
              { type: "image_url", image_url: { url: bild } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    kiFehler(err, "Gemini");
  }
  if (!antwort.ok) kiFehler(new Error(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`), "Gemini");
  const daten = (await antwort.json()) as { choices?: { message?: { content?: string } }[] };
  const inhalt = daten.choices?.[0]?.message?.content;
  if (!inhalt) kiFehler(new Error("leere Antwort"), "Gemini");
  try {
    return geminiPunkte(inhalt, ziele.length);
  } catch (err) {
    kiFehler(err, "Gemini");
  }
}

/** Welche Modelle eingerichtet sind – die Oberfläche bietet nur diese an. */
zaehlenRouten.get("/modelle", braucht("buchen"), (c) =>
  c.json({ moondream: Boolean(c.env.AI), gemini: Boolean(c.env.OPENROUTER_API_KEY?.trim()) }),
);

zaehlenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, zaehlenSchema);
  if (e.modell === "gemini" && !c.env.OPENROUTER_API_KEY?.trim()) fehler(409, "Gemini ist nicht eingerichtet (OPENROUTER_API_KEY fehlt)");
  if (e.modell === "moondream" && !c.env.AI) fehler(409, "Workers AI ist nicht eingerichtet");
  // Schutz vor Endlosschleifen und Kosten: 40 Fotos je Person und Stunde
  await drosseln(c, `zaehlen:${ich.id}`, 40, 60, "Zu viele Zählungen – bitte in einer Stunde erneut versuchen");

  const punkte =
    e.modell === "moondream" ? await mitMoondream(c.env.AI, e.bild, e.ziele, e.breite, e.hoehe) : await mitGemini(c.env, e.bild, e.ziele);
  const ergebnis: ZaehlAntwort = { modell: e.modell, punkte: doppeltePunkteEntfernen(punkte, e.breite, e.hoehe) };
  return c.json(ergebnis);
});
