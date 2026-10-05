import { useCallback } from "react";
import { fehlerText, senden } from "./api";
import { anzahl } from "./format";
import { useMeldung } from "../ui/meldungen";

/** Meldung nach einer Buchung mit Knopf „Rückgängig“ (Gegenbuchung auf dem Server). */
export function useBuchungMelden() {
  const melden = useMeldung();
  return useCallback(
    (text: string, vorgangId: string | null, danach?: () => void) => {
      if (!vorgangId) return melden(text);
      melden(text, "erfolg", {
        text: "Rückgängig",
        ausfuehren: () => {
          senden<{ zurueck: number; uebersprungen: number }>("/buchungen/rueckgaengig", { vorgang_id: vorgangId })
            .then((r) => {
              melden(
                `${anzahl(r.zurueck, "Stück", "Stücke")} zurückgebucht` +
                  (r.uebersprungen ? ` · ${r.uebersprungen} inzwischen weiterbewegt` : ""),
                "info",
              );
              danach?.();
            })
            .catch((e) => melden(fehlerText(e), "fehler"));
        },
      });
    },
    [melden],
  );
}
