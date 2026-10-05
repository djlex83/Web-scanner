import { Wrench } from "lucide-react";
import type { Stueck } from "../../gemeinsam/typen";
import { StueckBild } from "../komponenten/kategorie";
import { datumText, pruefStand, type PruefStand } from "../komponenten/StueckMerkmale";
import { useLaden } from "../lib/hooks";
import { Abzeichen } from "../ui/abzeichen";
import { Abschnitt, Liste, Zeile } from "../ui/karte";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

const GRUPPEN: { stand: PruefStand; titel: string }[] = [
  { stand: "ueberfaellig", titel: "Überfällig" },
  { stand: "bald", titel: "In den nächsten 30 Tagen" },
  { stand: "ok", titel: "Später" },
];

/** Prüf- und Wartungstermine aller Stücke. */
export default function Pruefungen() {
  const { daten, fehler, neuLaden } = useLaden<Stueck[]>("/pruefungen");

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <SeitenKopf titel="Prüfungen" unter="Prüf- und Wartungstermine – überfällige zuerst" />
      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
      {!daten ? (
        <SkelettListe />
      ) : daten.length === 0 ? (
        <Leer
          symbol={<Wrench />}
          titel="Keine Prüftermine"
          text="Beim Stück unter „Bearbeiten“ eine Prüfung (z. B. Elektroprüfung) mit Intervall und nächstem Termin eintragen."
        />
      ) : (
        GRUPPEN.map(({ stand, titel }) => {
          const liste = daten.filter((s) => pruefStand(s.pruefung.naechste) === stand);
          if (!liste.length) return null;
          return (
            <Abschnitt key={stand} titel={`${titel} · ${liste.length}`}>
              <Liste>
                {liste.map((s) => (
                  <Zeile
                    key={s.id}
                    zu={`/stuecke/${s.id}`}
                    bild={<StueckBild stueck={s} className="size-12 rounded-xl" />}
                    titel={s.name}
                    unter={
                      <>
                        <span className="font-medium text-text">{s.pruefung.art ?? "Prüfung"}</span>
                        {s.platz && ` · ${s.platz.pfad}`}
                      </>
                    }
                    rechts={
                      <Abzeichen ton={stand === "ueberfaellig" ? "gefahr" : stand === "bald" ? "warnung" : "neutral"}>
                        {datumText(s.pruefung.naechste)}
                      </Abzeichen>
                    }
                  />
                ))}
              </Liste>
            </Abschnitt>
          );
        })
      )}
    </div>
  );
}
