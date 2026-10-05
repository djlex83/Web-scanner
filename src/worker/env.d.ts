// Secrets stehen nicht in wrangler.jsonc und fehlen daher in worker-configuration.d.ts.
interface Env {
  /** Notfall-Code zum Wiederherstellen des Admin-Zugangs (mind. 16 Zeichen). Ohne Wert abgeschaltet. */
  NOTFALL_CODE?: string;
}
