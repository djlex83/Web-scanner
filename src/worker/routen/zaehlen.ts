import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zaehlenSchema } from "../../gemeinsam/schemas";
import {
  antwortKurz,
  CLOUDFLARE_BILDMODELLE,
  cloudflareAntwortText,
  datenUrlTeile,
  doppeltePunkteEntfernen,
  googleAntwortText,
  googleModell,
  modellPunkte,
  zaehlAnweisung,
  ZAEHL_MODELL_NAME,
  ZAEHL_MODELLE,
  type CloudflareBildmodell,
  type ZaehlAntwort,
  type ZaehlModell,
  type ZaehlPunkt,
  type ZaehlVersuch,
} from "../../gemeinsam/zaehlen";
import { drosseln } from "../auth/drossel";
import { benutzerVon, braucht, eingabe, fehler, type AppEnv } from "../kontext";

// Zählhilfe: Foto + Arten → ein Punkt je gefundenem Teil. Das Foto wird nur weitergereicht, nie gespeichert.
// Jeder Aufruf beim Modell landet als Versuch in der Antwort und im Cloudflare-Log (Workers → Logs).

const GEMINI_STANDARD = "google/gemini-3.6-flash";
/** Platz für die Antwort; denkende Modelle (Qwen, Kimi, Gemini) brauchen ihn auch zum Nachdenken vor dem JSON. */
const MAX_TOKENS = 12000;

interface Ergebnis {
  punkte: ZaehlPunkt[];
  versuch: ZaehlVersuch;
}

/** Was ein Modell zurückgegeben hat: der Antworttext, die Rohantwort (für die Diagnose) und ggf. der Grund fürs Ende. */
interface ModellAntwort {
  text: string;
  roh: unknown;
  ende?: string;
}

export const zaehlenRouten = new Hono<AppEnv>();

const fehlerText = (err: unknown) => (err instanceof Error ? err.message : String(err)).slice(0, 300);

/**
 * Fehler des Modells in eine Meldung übersetzen. Der Originaltext bleibt immer dran,
 * damit man im Zweifel sieht, was Cloudflare bzw. Google/OpenRouter wirklich gesagt haben.
 */
function kiFehler(text: string, modell: string): never {
  const original = text.replace(/\s+/g, " ").trim().slice(0, 240);
  if (/neuron|4006|daily|quota|exceeded|insufficient/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: Kontingent aufgebraucht – bitte morgen erneut oder ein anderes Modell nehmen (${original})` });
  }
  if (/rate limit|too many|429/i.test(text)) {
    throw new HTTPException(429, { message: `${modell}: zu viele Anfragen kurz hintereinander – bitte eine Minute warten (${original})` });
  }
  throw new HTTPException(502, { message: `${modell} hat nicht geantwortet: ${original}` });
}

/** Gemini ist eingerichtet, wenn ein Google-Schlüssel (kostenlos aus AI Studio) oder ein OpenRouter-Schlüssel da ist. */
const geminiDa = (env: Env) => Boolean(env.GEMINI_API_KEY?.trim() || env.OPENROUTER_API_KEY?.trim());

/** Chat-Nachricht mit Anweisung und Foto – so verstehen es Cloudflare-Modelle und OpenRouter. */
const chatNachricht = (anweisung: string, bild: string) => ({
  role: "user",
  content: [
    { type: "text", text: anweisung },
    { type: "image_url", image_url: { url: bild } },
  ],
});

/** Direkt bei Google (generateContent). */
async function beiGoogle(schluessel: string, modell: string, anweisung: string, bild: string): Promise<ModellAntwort> {
  const { typ, daten } = datenUrlTeile(bild);
  const antwort = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(googleModell(modell))}:generateContent`, {
    method: "POST",
    headers: { "x-goog-api-key": schluessel, "content-type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: anweisung }, { inline_data: { mime_type: typ, data: daten } }] }],
      generationConfig: { temperature: 0, maxOutputTokens: MAX_TOKENS, responseMimeType: "application/json" },
    }),
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
  const roh = (await antwort.json()) as unknown;
  return { ...googleAntwortText(roh), roh };
}

/** Über OpenRouter (bezahlt, ein Schlüssel für viele Modelle). */
async function beiOpenRouter(schluessel: string, modell: string, anweisung: string, bild: string): Promise<ModellAntwort> {
  const antwort = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: { authorization: `Bearer ${schluessel}`, "content-type": "application/json" },
    body: JSON.stringify({
      model: modell,
      temperature: 0,
      max_tokens: MAX_TOKENS,
      // Zählen profitiert vom Nachdenken; "low" würde fast nichts denken, "high" kostet deutlich mehr
      reasoning: { effort: "medium" },
      response_format: { type: "json_object" },
      messages: [chatNachricht(anweisung, bild)],
    }),
  });
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}: ${(await antwort.text()).slice(0, 300)}`);
  const roh = (await antwort.json()) as { choices?: { message?: { content?: string }; finish_reason?: string }[] };
  return { text: roh.choices?.[0]?.message?.content ?? "", ende: roh.choices?.[0]?.finish_reason, roh };
}

/** Ein Bildmodell bei Cloudflare per Chat, über die Bindung `AI` – kein eigener Schlüssel. */
async function beiCloudflare(ai: Ai, kurz: CloudflareBildmodell, anweisung: string, bild: string): Promise<ModellAntwort> {
  const roh = await ai.run(CLOUDFLARE_BILDMODELLE[kurz] as keyof AiModels, { messages: [chatNachricht(anweisung, bild)], temperature: 0, max_tokens: MAX_TOKENS } as never);
  return { text: cloudflareAntwortText(roh), roh };
}

/** Modell aufrufen und die Antwort in Punkte übersetzen – für alle Modelle gleich. */
async function zaehlen(env: Env, modell: ZaehlModell, bild: string, ziele: string[]): Promise<Ergebnis> {
  const start = Date.now();
  const anweisung = zaehlAnweisung(ziele);
  let name: string = ZAEHL_MODELL_NAME[modell];
  let gesendet: string;
  let a: ModellAntwort;
  try {
    if (modell === "gemini") {
      const gemini = env.GEMINI_MODELL?.trim() || GEMINI_STANDARD;
      const google = env.GEMINI_API_KEY?.trim();
      name = `Gemini (${google ? "Google" : "OpenRouter"})`;
      gesendet = `${google ? googleModell(gemini) : gemini} über ${google ? "Google" : "OpenRouter"}`;
      a = google ? await beiGoogle(google, gemini, anweisung, bild) : await beiOpenRouter(env.OPENROUTER_API_KEY!.trim(), gemini, anweisung, bild);
    } else {
      gesendet = CLOUDFLARE_BILDMODELLE[modell];
      a = await beiCloudflare(env.AI, modell, anweisung, bild);
    }
  } catch (err) {
    kiFehler(fehlerText(err), name);
  }
  const versuch: ZaehlVersuch = { gesendet: `${gesendet} · ${ziele.length} ${ziele.length === 1 ? "Art" : "Arten"}`, punkte: 0, dauerMs: Date.now() - start, antwort: antwortKurz(a.text || a.roh) };
  try {
    const { punkte, anzahl } = modellPunkte(a.text, ziele.length);
    versuch.punkte = punkte.length;
    if (anzahl !== undefined) versuch.anzahl = anzahl;
    return { punkte, versuch };
  } catch (err) {
    versuch.fehler = `${fehlerText(err)}${a.ende ? ` (Ende: ${a.ende})` : ""}`;
    console.log("Zählhilfe", modell, JSON.stringify(versuch));
    kiFehler(`${versuch.fehler}: ${antwortKurz(a.text || a.roh, 200)}`, name);
  }
}

/** Welche Modelle eingerichtet sind – die Oberfläche bietet nur diese an. */
zaehlenRouten.get("/modelle", braucht("buchen"), (c) => {
  const ai = Boolean(c.env.AI);
  return c.json(Object.fromEntries(ZAEHL_MODELLE.map((m) => [m, m === "gemini" ? geminiDa(c.env) : ai])) as Record<ZaehlModell, boolean>);
});

zaehlenRouten.post("/", braucht("buchen"), async (c) => {
  const ich = benutzerVon(c);
  const e = await eingabe(c, zaehlenSchema);
  if (e.modell === "gemini" && !geminiDa(c.env)) fehler(409, "Gemini ist nicht eingerichtet (GEMINI_API_KEY oder OPENROUTER_API_KEY fehlt)");
  if (e.modell !== "gemini" && !c.env.AI) fehler(409, "Workers AI ist nicht eingerichtet");
  // Schutz vor Endlosschleifen und Kosten: 40 Fotos je Person und Stunde
  await drosseln(c, `zaehlen:${ich.id}`, 40, 60, "Zu viele Zählungen – bitte in einer Stunde erneut versuchen");

  const r = await zaehlen(c.env, e.modell, e.bild, e.ziele);
  const ergebnis: ZaehlAntwort = {
    modell: e.modell,
    punkte: doppeltePunkteEntfernen(r.punkte, e.breite, e.hoehe),
    diagnose: { bildKb: Math.round((e.bild.length * 3) / 4 / 1024), breite: e.breite, hoehe: e.hoehe, versuche: [r.versuch] },
  };
  console.log("Zählhilfe", e.modell, JSON.stringify({ ziele: e.ziele, ...ergebnis.diagnose, punkte: ergebnis.punkte.length }));
  return c.json(ergebnis);
});
