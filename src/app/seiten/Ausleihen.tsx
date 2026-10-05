import { Handshake, Undo2 } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import type { Ausleihe } from "../../gemeinsam/typen";
import { StueckBild } from "../komponenten/kategorie";
import { datumText, istUeberfaellig } from "../komponenten/StueckMerkmale";
import { fehlerText, senden } from "../lib/api";
import { anzahl, zeitpunkt } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Abzeichen } from "../ui/abzeichen";
import { Chips } from "../ui/formular";
import { Abschnitt, Liste } from "../ui/karte";
import { KnopfLink, SymbolKnopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

/** Was ist gerade verliehen – überfällige zuerst; Verlauf der letzten Ausleihen. */
export default function Ausleihen() {
  const { darf } = useSitzung();
  const melden = useMeldung();
  const [ansicht, setAnsicht] = useState("offen");
  const { daten, fehler, neuLaden } = useLaden<Ausleihe[]>(ansicht === "offen" ? "/ausleihen" : "/ausleihen?alle=1");

  async function zurueck(a: Ausleihe) {
    try {
      await senden("/ausleihen/zurueck", { stueck_ids: [a.stueck.id] });
      melden(`„${a.stueck.name}“ zurückgenommen`);
      await neuLaden();
    } catch (e) {
      melden(fehlerText(e), "fehler");
    }
  }

  const ueberfaellig = (daten ?? []).filter((a) => !a.zurueck_am && istUeberfaellig(a.bis));
  const uebrige = (daten ?? []).filter((a) => !ueberfaellig.includes(a));

  const zeile = (a: Ausleihe) => (
    <div key={a.id} className="flex items-center gap-1 pr-2">
      <Link to={`/stuecke/${a.stueck.id}`} className="flex min-h-16 min-w-0 flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-flaeche-2">
        <StueckBild stueck={a.stueck} className="size-12 rounded-xl" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[15px] font-semibold">{a.stueck.name}</span>
          <span className="mt-0.5 block truncate text-[13px] text-gedaempft">
            <span className="font-medium text-text">{a.an}</span>
            {a.zurueck_am ? ` · zurück ${zeitpunkt(a.zurueck_am)}` : a.bis ? ` · bis ${datumText(a.bis)}` : " · ohne Datum"}
          </span>
        </span>
        {!a.zurueck_am && istUeberfaellig(a.bis) && <Abzeichen ton="gefahr">überfällig</Abzeichen>}
      </Link>
      {!a.zurueck_am && darf("buchen") && (
        <SymbolKnopf beschriftung={`${a.stueck.name} zurücknehmen`} onClick={() => void zurueck(a)}>
          <Undo2 className="size-5" />
        </SymbolKnopf>
      )}
    </div>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SeitenKopf
        titel="Ausleihen"
        unter="Wer hat was – und bis wann?"
        aktionen={
          darf("buchen") && (
            <KnopfLink to="/scannen?modus=ausleihe" art="primaer" symbol={<Handshake className="size-5" />}>
              <span className="sr-only sm:not-sr-only">Ausgeben</span>
            </KnopfLink>
          )
        }
      />
      <Chips
        optionen={[
          { wert: "offen", text: "Verliehen" },
          { wert: "alle", text: "Verlauf" },
        ]}
        wert={ansicht}
        aendern={setAnsicht}
      />
      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
      {!daten ? (
        <SkelettListe />
      ) : daten.length === 0 ? (
        <Leer
          symbol={<Handshake />}
          titel={ansicht === "offen" ? "Nichts verliehen" : "Noch keine Ausleihen"}
          text="Stücke gibst du unter Scannen › Ausleihe oder auf der Seite eines Stücks aus."
          aktion={darf("buchen") && <KnopfLink to="/scannen?modus=ausleihe" art="primaer">Stücke ausgeben</KnopfLink>}
        />
      ) : (
        <>
          {ueberfaellig.length > 0 && (
            <Abschnitt titel={`Rückgabe überfällig · ${ueberfaellig.length}`}>
              <Liste className="border-gefahr/40">{ueberfaellig.map(zeile)}</Liste>
            </Abschnitt>
          )}
          {uebrige.length > 0 && (
            <Abschnitt titel={ansicht === "offen" ? anzahl(uebrige.length, "Ausleihe", "Ausleihen") : "Letzte Ausleihen"}>
              <Liste>{uebrige.map(zeile)}</Liste>
            </Abschnitt>
          )}
        </>
      )}
    </div>
  );
}
