// Secrets stehen nicht in wrangler.jsonc und fehlen daher in worker-configuration.d.ts.
interface Env {
  /** Notfall-Code zum Wiederherstellen des Admin-Zugangs (mind. 16 Zeichen). Ohne Wert abgeschaltet. */
  NOTFALL_CODE?: string;
  /** OpenRouter-Schlüssel für die Zählhilfe mit Gemini. Ohne Wert bietet die App nur Moondream an. */
  OPENROUTER_API_KEY?: string;
  /** Optional: anderes Gemini-Modell bei OpenRouter, Standard google/gemini-3.6-flash */
  GEMINI_MODELL?: string;
}
