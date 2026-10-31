// Secrets stehen nicht in wrangler.jsonc und fehlen daher in worker-configuration.d.ts.
interface Env {
  /** Notfall-Code zum Wiederherstellen des Admin-Zugangs (mind. 16 Zeichen). Ohne Wert abgeschaltet. */
  NOTFALL_CODE?: string;
  /** Google-Schlüssel (AI Studio, kostenloses Kontingent) für die Zählhilfe mit Gemini – hat Vorrang vor OpenRouter. */
  GEMINI_API_KEY?: string;
  /** OpenRouter-Schlüssel für die Zählhilfe mit Gemini (bezahlt). Ohne einen der beiden Schlüssel bietet die App nur die Bildmodelle von Cloudflare an. */
  OPENROUTER_API_KEY?: string;
  /** Optional: anderes Gemini-Modell, Standard google/gemini-3.6-flash (bei Google ohne „google/“) */
  GEMINI_MODELL?: string;
}
