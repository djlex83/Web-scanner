import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zaehlenSchema } from "../../gemeinsam/schemas";
import {
  antwortKurz,
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  moondreamKandidaten,
  moondreamPunkte,
  moondreamRohpunkte,
  type ZaehlAntwort,
  type ZaehlPunkt,
  type ZaehlVersuch,
} from "../../gemeinsam/zaehlen";
import { drosseln } from "../auth/drossel";
import { benutzerVon, braucht, eingabe, fehler, type AppEnv } from "../kontext";

// Zählhilfe: Foto + Arten → ein Punkt je gefundenem Teil. Das Foto wird nur weitergereicht, nie gespeichert.
// Jeder Aufruf beim Modell landet als Versuch in der Antwort und im Cloudflare-Log (Workers → Logs).

const MOONDREAM = "@cf/moondream/moondream3.1-9B-A2B";
const UEBERSETZER = "@cf/meta/m2m100-1.2b";
const GEMINI_STANDARD = "google/gemini-3.6-flash";
/** Notfall-Versuch, wenn keine Art etwas findet: alles zählen, was einzeln im Regal liegt */
const ALLGEMEIN = "individual item on the shelf";

interface Ergebnis {
  punkte: ZaehlPunkt[];
  versuche: ZaehlVersuch[];
}

export const zaehlenRouten = new Hono<AppEnv>();

const fehlerText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

function kiFehler(text: string, modell: string): never {
  if (/neuron|4006|daily|quota|rate limit|429/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: Tageskontingent aufgebraucht – bitte morgen erneut oder das andere Modell nehmen` });
  }
  throw new HTTPException(502, { message: `${modell} hat nicht geantwortet: ${text}` });
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

async function moondreamPunkt(ai: Ai, bild: string, target: string, ziel: number | null, breite: number, hoehe: number) {
  const start = Date.now();
  try {
    const r = await ai.run(MOONDREAM as keyof AiModels, { task: "point", image: bild, target, max_objects: 300 } as never);
    const punkte = moondreamPunkte(moondreamRohpunkte(r), ziel ?? 0, breite, hoehe).map((p) => ({ ...p, ziel }));
    const versuch: ZaehlVersuch = { ziel, gesendet: target, punkte: punkte.length, dauerMs: Date.now() - start, antwort: antwortKurz(r) };
    return { punkte, versuch };
  } catch (err) {
    const versuch: ZaehlVersuch = { ziel, gesendet: target, punkte: 0, dauerMs: Date.now() - start, fehler: fehlerText(err) };
    return { punkte: [] as ZaehlPunkt[], versuch };
  }
}

async function mitMoondream(ai: Ai, bild: string, ziele: string[], breite: number, hoehe: number): Promise<Ergebnis> {
  const englisch = await Promise.all(ziele.map((t) => insEnglische(ai, t)));
  const je = await Promise.all(
    englisch.map(async (text, i) => {
      const versuche: ZaehlVersuch[] = [];
      // Voller Text zuerst, bei 0 Treffern der kurze Begriff vor dem Doppelpunkt
      for (const target of moondreamKandidaten(text)) {
        const r = await moondreamPunkt(ai, bild, target, i, breite, hoehe);
        versuche.push(r.versuch);
        if (r.punkte.length || r.versuch.fehler) return { punkte: r.punkte, versuche };
      }
      return { punkte: [] as ZaehlPunkt[], versuche };
    }),
  );
  const punkte = je.flatMap((j) => j.punkte);
  const versuche = je.flatMap((j) => j.versuche);
  if (!punkte.length) {
    const fehlgeschlagen = versuche.filter((v) => v.fehler);
    // Kam von keinem Aufruf eine Antwort, ist es ein Fehler – nicht „nichts gefunden“
    if (fehlgeschlagen.length === versuche.length) kiFehler(fehlgeschlagen[0]?.fehler ?? "keine Antwort", "Moondream");
    const notfall = await moondreamPunkt(ai, bild, ALLGEMEIN, null, breite, hoehe);
    versuche.push(notfall.versuch);
    punkte.push(...notfall.punkte);
  }
  return { punkte, versuche };
}

async function mitGemini(env: Env, bild: string, ziele: string[]): Promise<Ergebnis> {
  const start = Date.now();
  const modell = env.GEMINI_MODELL?.trim() || GEMINI_STANDARD;
  const anweisung = geminiAnweisung(ziele);
  let antwort: Response;
  try {
    antwort = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: { authorization: `Bearer ${env.OPENROUTER_API_KEY!.trim()}`, "content-type": "application/json" },
      body: JSON.stringify({
        model: modell,
        temperature: 0,
        max_tokens: 12000,
        // Zählen profitiert vom Nachdenken; "low" würde fast nichts denken, "high" kostet deutlich mehr
        reasoning: { effort: "medium" },
        response_format: { type: "json_object" },
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: anweisung },
              { type: "image_url", image_url: { url: bild } },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    kiFehler(fehlerText(err), "Gemini");
  }
  if (!antwort.ok) kiFehler(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`, "Gemini");
  const daten = (await antwort.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  const inhalt = daten.choices?.[0]?.message?.content ?? "";
  const versuch: ZaehlVersuch = { ziel: null, gesendet: `${modell} · ${ziele.length} Arten`, punkte: 0, dauerMs: Date.now() - start, antwort: antwortKurz(inhalt || daten) };
  try {
    const punkte = geminiPunkte(inhalt, ziele.length);
    versuch.punkte = punkte.length;
    return { punkte, versuche: [versuch] };
  } catch (err) {
    versuch.fehler = `${fehlerText(err)} (finish_reason: ${daten.choices?.[0]?.finish_reason ?? "?"})`;
    console.log("Zählhilfe gemini", JSON.stringify(versuch));
    kiFehler(versuch.fehler, "Gemini");
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

  const r = e.modell === "moondream" ? await mitMoondream(c.env.AI, e.bild, e.ziele, e.breite, e.hoehe) : await mitGemini(c.env, e.bild, e.ziele);
  const ergebnis: ZaehlAntwort = {
    modell: e.modell,
    punkte: doppeltePunkteEntfernen(r.punkte, e.breite, e.hoehe),
    diagnose: { bildKb: Math.round((e.bild.length * 3) / 4 / 1024), breite: e.breite, hoehe: e.hoehe, versuche: r.versuche },
  };
  console.log("Zählhilfe", e.modell, JSON.stringify({ ziele: e.ziele, ...ergebnis.diagnose, punkte: ergebnis.punkte.length }));
  return c.json(ergebnis);
});
