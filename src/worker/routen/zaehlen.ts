import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { zaehlenSchema } from "../../gemeinsam/schemas";
import {
  antwortKurz,
  datenUrlZuBytes,
  doppeltePunkteEntfernen,
  geminiAnweisung,
  geminiPunkte,
  moondreamAntwortFehler,
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
 * Wie das Bild an die Bindung geht. Das Modell meldet „'string' not in 'array','binary'“:
 * - „binär“: Datenstrom + Inhaltstyp, wie Cloudflare es für Partnermodelle (z. B. Deepgram) vorsieht –
 *   über die REST-API nicht möglich (verlangt JSON), über die Bindung vielleicht.
 * - „array“: Byte-Array im JSON. Über die REST-API wandelt Cloudflare es wieder in Text um und lehnt es ab.
 * Eine Zeichenkette (Adresse/Daten-URL) ergibt stillschweigend eine leere Antwort.
 */
type BildForm = "binär" | "array";
const BILD_FORMEN: BildForm[] = ["binär", "array"];

function bildEingabe(bild: Uint8Array, form: BildForm): unknown {
  if (form === "array") return Array.from(bild);
  return { body: new Blob([bild.buffer.slice(bild.byteOffset, bild.byteOffset + bild.byteLength) as ArrayBuffer], { type: "image/jpeg" }).stream(), contentType: "image/jpeg" };
}

/**
 * Rohe HTTP-Antwort holen und selbst lesen: So sehen wir Status, Inhaltstyp und Text,
 * statt dass die Bindung Unerwartetes (Stream, leeres Objekt) stillschweigend durchreicht.
 */
async function moondreamAufruf(ai: Ai, bild: Uint8Array, target: string, form: BildForm): Promise<unknown> {
  // Binär geht als Formular: Zusatzfelder kommen dort als Text an, und das Modell lehnt "300" als Zahl ab
  // („\"300\" is not of type \"integer\"“). Deshalb ohne max_objects; beim Array als Zahl.
  const eingabe = form === "binär" ? { task: "point", image: bildEingabe(bild, form), target } : { task: "point", image: bildEingabe(bild, form), target, max_objects: 300 };
  const antwort = await ai.run(MOONDREAM as keyof AiModels, eingabe as never, { returnRawResponse: true });
  const text = await antwort.text();
  if (!antwort.ok) throw new Error(`HTTP ${antwort.status}: ${text.slice(0, 300)}`);
  let r: unknown;
  try {
    r = JSON.parse(text);
  } catch {
    throw new Error(`Antwort kein JSON (${antwort.headers.get("content-type") ?? "ohne Inhaltstyp"}): ${text.slice(0, 200)}`);
  }
  const problem = moondreamAntwortFehler(r);
  if (problem) throw new Error(problem);
  return r;
}

async function moondreamPunkt(ai: Ai, bild: Uint8Array, target: string, ziel: number | null, breite: number, hoehe: number) {
  const start = Date.now();
  const fehlerJeForm: string[] = [];
  try {
    let r: unknown;
    let genommen: BildForm = BILD_FORMEN[0]!;
    // Erst binär, bei Ablehnung das Array – die Form, die durchkommt, steht in den Details
    for (const form of BILD_FORMEN) {
      try {
        r = await moondreamAufruf(ai, bild, target, form);
        genommen = form;
        break;
      } catch (err) {
        fehlerJeForm.push(`${form}: ${fehlerText(err)}`);
        if (form === BILD_FORMEN[BILD_FORMEN.length - 1]) throw new Error(fehlerJeForm.join(" | "));
      }
    }
    const punkte = moondreamPunkte(moondreamRohpunkte(r), ziel ?? 0, breite, hoehe).map((p) => ({ ...p, ziel }));
    const versuch: ZaehlVersuch = { ziel, gesendet: `${target} (${genommen})`, punkte: punkte.length, dauerMs: Date.now() - start, antwort: antwortKurz(r) };
    return { punkte, versuch };
  } catch (err) {
    const versuch: ZaehlVersuch = { ziel, gesendet: target, punkte: 0, dauerMs: Date.now() - start, fehler: fehlerText(err) };
    return { punkte: [] as ZaehlPunkt[], versuch };
  }
}

async function mitMoondream(ai: Ai, datenUrl: string, ziele: string[], breite: number, hoehe: number): Promise<Ergebnis> {
  let bild: Uint8Array;
  try {
    bild = datenUrlZuBytes(datenUrl);
  } catch {
    fehler(400, "Das Foto ist nicht als gültige Base64-Daten-URL angekommen");
  }
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
