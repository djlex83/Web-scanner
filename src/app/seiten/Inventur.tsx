import { ClipboardCheck, ScanLine, Warehouse } from "lucide-react";
import { useState } from "react";
import { useNavigate } from "react-router";
import { istPlatzCode } from "../../gemeinsam/codes";
import type { InventurEintrag, Platz, ScanTreffer } from "../../gemeinsam/typen";
import { PlatzWahl } from "../komponenten/PlatzWahl";
import { fehlerText, senden } from "../lib/api";
import { vorWann, zeitpunkt } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { ManuelleEingabe, useHandscanner } from "../scanner/eingabe";
import { Abzeichen } from "../ui/abzeichen";
import { Abschnitt, Karte, Liste, Zeile } from "../ui/karte";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

/** Inventur starten (Regal wählen oder Etikett scannen) und letzte Inventuren ansehen. */
export default function Inventur() {
  const { darf } = useSitzung();
  const navigate = useNavigate();
  const melden = useMeldung();
  const [wahl, setWahl] = useState(false);
  const { daten, fehler, neuLaden } = useLaden<InventurEintrag[]>("/inventur");

  async function platzCode(code: string) {
    if (!istPlatzCode(code)) return melden("Bitte das Etikett eines Regals scannen", "info");
    try {
      const [t] = await senden<ScanTreffer[]>("/scan", { codes: [code] });
      if (t?.art === "platz") navigate(`/inventur/${t.platz.id}`);
      else melden("Unbekanntes Regal-Etikett", "fehler");
    } catch (e) {
      melden(fehlerText(e), "fehler");
    }
  }
  useHandscanner((c) => void platzCode(c));

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SeitenKopf titel="Inventur" unter="Regal für Regal zählen: Soll und Ist vergleichen" />

      {darf("buchen") && (
        <Karte className="space-y-4 p-5">
          <ol className="space-y-3 text-[15px]">
            {[
              ["Regal wählen", "Etikett scannen oder aus der Liste wählen"],
              ["Alles scannen, was im Regal liegt", "ein Behälter zählt mit seinem Inhalt"],
              ["Abschließen", "Fehlendes als vermisst melden, Zusätzliches hierher buchen"],
            ].map(([titel, text], i) => (
              <li key={titel} className="flex gap-3">
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primaer text-sm font-bold text-auf-primaer">{i + 1}</span>
                <span>
                  <span className="block font-semibold">{titel}</span>
                  <span className="block text-[13px] text-gedaempft">{text}</span>
                </span>
              </li>
            ))}
          </ol>
          <Knopf art="primaer" groesse="l" breit symbol={<Warehouse className="size-5" />} onClick={() => setWahl(true)}>
            Regal wählen
          </Knopf>
          <div className="flex items-center gap-2 text-[13px] text-gedaempft">
            <ScanLine className="size-4" /> oder das Regal-Etikett mit dem Handscanner scannen bzw. eintippen:
          </div>
          <ManuelleEingabe beiCode={(c) => void platzCode(c)} />
        </Karte>
      )}

      <Abschnitt titel="Letzte Inventuren">
        {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
        {!daten ? (
          <SkelettListe />
        ) : daten.length === 0 ? (
          <Leer symbol={<ClipboardCheck />} titel="Noch keine Inventur" text="Abgeschlossene Inventuren erscheinen hier." />
        ) : (
          <Liste>
            {daten.map((i) => (
              <Zeile
                key={i.id}
                zu={i.platz ? `/inventur/${i.platz.id}` : undefined}
                symbol={<ClipboardCheck />}
                titel={i.platz?.pfad ?? "Platz gelöscht"}
                unter={
                  <span title={zeitpunkt(i.zeitpunkt)}>
                    {vorWann(i.zeitpunkt)} · {i.benutzer} · {i.gefunden} von {i.erwartet} gefunden
                  </span>
                }
                rechts={
                  i.fehlend ? (
                    <Abzeichen ton="gefahr">{i.fehlend} fehlen</Abzeichen>
                  ) : (
                    <Abzeichen ton="erfolg">vollständig</Abzeichen>
                  )
                }
              />
            ))}
          </Liste>
        )}
      </Abschnitt>

      <PlatzWahl offen={wahl} schliessen={() => setWahl(false)} waehlen={(p: Platz) => navigate(`/inventur/${p.id}`)} titel="Welches Regal zählen?" />
    </div>
  );
}
