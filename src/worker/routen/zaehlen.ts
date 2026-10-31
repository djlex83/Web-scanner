import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zaehlenSchema } from "../../gemeinsam/schemas";
import {
  antwortKurz,
  datenUrlTeile,
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  googleAntwortText,
  googleModell,
  moondreamAntwortFehler,
  moondreamAntwortPunkte,
  moondreamFrage,
  moondreamKandidaten,
  moondreamPunkte,
  moondreamStromLesen,
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

/**
 * Fehler des Modells in eine Meldung übersetzen. Der Originaltext bleibt immer dran,
 * damit man im Zweifel sieht, was Cloudflare bzw. OpenRouter wirklich gesagt haben.
 */
function kiFehler(text: string, modell: string): never {
  const original = text.replace(/\s+/g, " ").trim().slice(0, 240);
  if (/neuron|4006|daily|quota|exceeded|insufficient/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: Kontingent aufgebraucht – bitte morgen erneut oder das andere Modell nehmen (${original})` });
  }
  if (/rate limit|too many|429/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: zu viele Anfragen kurz hintereinander – bitte eine Minute warten (${original})` });
  }
  throw new HTTPException(502, { message: `${modell} hat nicht geantwortet: ${original}` });
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

/**
 * Moondream bei Cloudflare (Stand Oktober 2026, per curl belegt):
 * - Ohne Datenstrom kommt bei jeder Aufgabe `{}` zurück – das Modell rechnet nicht bzw. nichts wird eingesammelt.
 * - `point` lehnt den Datenstrom ab („task=point does not support stream=True“).
 * - `query` mit `stream: true` funktioniert. Also fragen wir nach den Punkten als JSON und nehmen
 *   im Denkmodus zusätzlich die Punkte, die das Modell selbst setzt (`reasoning.grounding`).
 */
async function moondreamAufruf(ai: Ai, bild: string, target: string): Promise<unknown> {
  const eingabe = { task: "query", image: bild, question: moondreamFrage(target), reasoning: true, temperature: 0, max_tokens: 4000, stream: true };
  const strom = (await ai.run(MOONDREAM as keyof AiModels, eingabe as never)) as unknown;
  // Die Bindung gibt einen Datenstrom zurück; zur Sicherheit auch ein fertiges Objekt annehmen
  const r = strom instanceof ReadableStream ? moondreamStromLesen(await new Response(strom).text()) : strom;
  const problem = moondreamAntwortFehler(r);
  if (problem) throw new Error(problem);
  return r;
}

async function moondreamPunkt(ai: Ai, bild: string, target: string, ziel: number | null, breite: number, hoehe: number) {
  const start = Date.now();
  try {
    const r = await moondreamAufruf(ai, bild, target);
    const punkte = moondreamPunkte(moondreamAntwortPunkte(r), ziel ?? 0, breite, hoehe).map((p) => ({ ...p, ziel }));
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
      // Voller Text zuerst, bei 0 Treffern der kurze Begriff vor dem Doppelpunkt, zuletzt das deutsche Wort
      for (const target of moondreamKandidaten(text, ziele[i]!)) {
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

/** Gemini ist eingerichtet, wenn ein Google-Schlüssel (kostenlos aus AI Studio) oder ein OpenRouter-Schlüssel da ist. */
const geminiDa = (env: Env) => Boolean(env.GEMINI_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim());

/** Direkt bei Google (generateContent). Liefert den Antworttext und den Grund fürs Ende. */
async function geminiBeiGoogle(schluessel: string, modell: string, anweisung: string, bild: string): Promise<{ text: string; ende: string; roh: unknown }> {
  const { typ, daten } = datenUrlTeile(bild);
  const antwort = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(googleModell(modell))}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": schluessel, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: anweisung }, { inline_data: { mime_type: typ, data: daten } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 12000, responseMimeType: "application/json" },
    }),
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
  const roh = (await antwort.json()) as unknown;
  return { ...googleAntwortText(roh), roh };
}

/** Über OpenRouter (bezahlt, ein Schlüssel für viele Modelle). */
async function geminiBeiOpenRouter(schluessel: string, modell: string, anweisung: string, bild: string): Promise<{ text: string; ende: string; roh: unknown }> {
  const antwort = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${schluessel}`, "content-type": "application/json" },
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
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
  const roh = (await antwort.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  return { text: roh.choices?.[0]?.message?.content ?? "", ende: roh.choices?.[0]?.finish_reason ?? "?", roh };
}

async function mitGemini(env: Env, bild: string, ziele: string[]): Promise<Ergebnis> {
  const start = Date.now();
  const modell = env.GEMINI_MODELL?.trim() || GEMINI_STANDARD;
  const anweisung = geminiAnweisung(ziele);
  const google = env.GEMINI_API_KEY?.trim();
  const weg = google ? "Google" : "OpenRouter";
  let r: { text: string; ende: string; roh: unknown };
  try {
    r = google
      ? await geminiBeiGoogle(google, modell, anweisung, bild)
      : await geminiBeiOpenRouter(env.OPENROUTER_API_KEY!.trim(), modell, anweisung, bild);
  } catch (err) {
    kiFehler(fehlerText(err), `Gemini (${weg})`);
  }
  const versuch: ZaehlVersuch = {
    ziel: null,
    gesendet: `${google ? googleModell(modell) : modell} über ${weg} · ${ziele.length} Arten`,
    punkte: 0,
    dauerMs: Date.now() - start,
    antwort: antwortKurz(r.text || r.roh),
  };
  try {
    const punkte = geminiPunkte(r.text, ziele.length);
    versuch.punkte = punkte.length;
    return { punkte, versuche: [versuch] };
  } catch (err) {
    versuch.fehler = `${fehlerText(err)} (Ende: ${r.ende})`;
    console.log("Zählhilfe gemini", JSON.stringify(versuch));
    kiFehler(versuch.fehler, `Gemini (${weg})`);
  }
}

/** Welche Modelle eingerichtet sind – die Oberfläche bietet nur diese an. */
zaehlenRouten.get("/modelle", braucht("buchen"), (c) => c.json({ moondream: Boolean(c.env.AI), gemini: geminiDa(c.env) }));

zaehlenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, zaehlenSchema);
  if (e.modell === "gemini" && !geminiDa(c.env)) fehler(409, "Gemini ist nicht eingerichtet (GEMINI_API_KEY oder OPENROUTER_API_KEY fehlt)");
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
