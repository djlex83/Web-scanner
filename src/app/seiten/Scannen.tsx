import { ArrowRightLeft, ListX, PackageCheck, ScanSearch, Warehouse } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Platz, PlatzKurz, ScanTreffer, Stueck } from "../../gemeinsam/typen";
import { ErfassenBlatt } from "../komponenten/ErfassenBlatt";
import { PlatzWahl } from "../komponenten/PlatzWahl";
import { fehlerText, holen, senden } from "../lib/api";
import { anzahl } from "../lib/format";
import { signalFertig } from "../lib/rueckmeldung";
import { useSitzung } from "../lib/sitzung";
import { ManuelleEingabe, useHandscanner } from "../scanner/eingabe";
import { Kamera } from "../scanner/Kamera";
import { TrefferKarte } from "../scanner/TrefferKarte";
import { useScanListe } from "../scanner/useScanListe";
import { Abschnitt } from "../ui/karte";
import { Segmente } from "../ui/formular";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";

type Modus = "suchen" | "einlagern";

export default function Scannen() {
  const { darf } = useSitzung();
  const melden = useMeldung();
  const [param, setParam] = useSearchParams();
  const kannBuchen = darf("buchen");
  const modus: Modus = kannBuchen && param.get("modus") === "einlagern" ? "einlagern" : "suchen";

  const [ziel, setZiel] = useState<PlatzKurz | null>(null);
  const [wahlOffen, setWahlOffen] = useState(false);
  const [erfassenCode, setErfassenCode] = useState<string | null>(null);
  const [neuErfasst, setNeuErfasst] = useState<Set<string>>(new Set());
  const [bucht, setBucht] = useState(false);

  // Ziel aus der Adresse übernehmen (z. B. "Hier einlagern" auf einer Platz-Seite)
  const zielParam = param.get("ziel");
  useEffect(() => {
    if (!zielParam) return;
    holen<{ platz: Platz }>(`/plaetze/${Number(zielParam)}`)
      .then((r) => setZiel(r.platz))
      .catch(() => {});
  }, [zielParam]);

  const beiTreffer = useCallback(
    (t: ScanTreffer) => {
      // Im Einlagern-Modus ist ein Platz-Etikett das Ziel
      if (t.art === "platz" && modus === "einlagern") {
        setZiel(t.platz);
        melden(`Ziel: ${t.platz.pfad}`, "info");
        liste.entfernen(t.code);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modus],
  );
  const liste = useScanListe(beiTreffer);
  useHandscanner((code) => liste.hinzufuegen([code]));

  const stuecke = liste.eintraege.filter((e) => e.treffer?.art === "stueck");
  const zuBuchen = ziel
    ? stuecke.filter((e) => e.treffer?.art === "stueck" && e.treffer.stueck.platz?.id !== ziel.id && e.treffer.stueck.status !== "ausgemustert")
    : [];
  const offeneUnbekannte = liste.eintraege.filter((e) => e.treffer?.art === "unbekannt").length;

  function modusWechseln(m: Modus) {
    setParam(m === "suchen" ? {} : { modus: m }, { replace: true });
    // Ein schon gescanntes Regal wird beim Wechsel zum Einlagern das Ziel
    if (m === "einlagern" && !ziel) {
      const platz = liste.eintraege.find((e) => e.treffer?.art === "platz");
      if (platz?.treffer?.art === "platz") {
        setZiel(platz.treffer.platz);
        liste.entfernen(platz.code);
      }
    }
  }

  async function buchen() {
    if (!ziel || !zuBuchen.length) return;
    setBucht(true);
    try {
      const ids = zuBuchen.map((e) => (e.treffer as Extract<ScanTreffer, { art: "stueck" }>).stueck.id);
      const r = await senden<{ gebucht: number; ziel: string }>("/buchungen", { nach_platz_id: ziel.id, stueck_ids: ids });
      signalFertig();
      melden(`${anzahl(r.gebucht, "Stück", "Stücke")} nach ${r.ziel} gebucht`);
      liste.leeren((e) => e.treffer?.art === "stueck");
      setNeuErfasst(new Set());
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setBucht(false);
    }
  }

  function erfasst(s: Stueck) {
    const code = erfassenCode!;
    setErfassenCode(null);
    liste.ersetzen(code, { code, art: "stueck", stueck: s });
    setNeuErfasst((n) => new Set(n).add(code));
    melden(`„${s.name}“ erfasst${s.platz ? ` → ${s.platz.pfad}` : ""}`);
  }

  return (
    <div className={kl("mx-auto max-w-2xl space-y-4", modus === "einlagern" && "pb-24 lg:pb-24")}>
      <h1 className="sr-only">Scannen</h1>
      {kannBuchen && (
        <Segmente
          beschriftung="Was möchtest du tun?"
          wert={modus}
          aendern={modusWechseln}
          optionen={[
            { wert: "suchen", text: "Wo ist?", symbol: <ScanSearch /> },
            { wert: "einlagern", text: "Einlagern", symbol: <ArrowRightLeft /> },
          ]}
        />
      )}

      <Kamera
        beiCodes={liste.hinzufuegen}
        hinweis={modus === "einlagern" && !ziel ? "Zuerst das Regal-Etikett scannen" : undefined}
      />
      <ManuelleEingabe beiCode={(c) => liste.hinzufuegen([c])} />

      {modus === "einlagern" && (
        <ZielKarte ziel={ziel} waehlen={() => setWahlOffen(true)} />
      )}

      <Abschnitt
        titel={
          liste.eintraege.length
            ? `${modus === "einlagern" ? "Stücke" : "Gescannt"} · ${liste.eintraege.length}`
            : undefined
        }
        aktion={
          liste.eintraege.length > 0 && (
            <button
              onClick={() => {
                liste.leeren();
                setNeuErfasst(new Set());
              }}
              className="flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-gedaempft hover:text-text"
            >
              <ListX className="size-4" /> Leeren
            </button>
          )
        }
      >
        {liste.eintraege.length === 0 ? (
          <p className="rounded-2xl border border-dashed border-rand px-6 py-8 text-center text-[15px] text-gedaempft">
            {modus === "einlagern"
              ? "Scanne das Regal-Etikett und danach alle Stücke, die dort hinein sollen. Unbekannte Codes kannst du direkt erfassen."
              : "Scanne einen oder mehrere Codes – du siehst sofort, wo jedes Stück liegt. Auch ein Foto mit vielen Etiketten geht."}
          </p>
        ) : (
          <div className="space-y-2.5">
            {liste.eintraege.map((e) => (
              <TrefferKarte
                key={e.code}
                eintrag={e}
                zielId={modus === "einlagern" ? (ziel?.id ?? -1) : null}
                zielName={ziel?.name ?? "Ziel wählen"}
                neuErfasst={neuErfasst.has(e.code)}
                erfassen={darf("erfassen") ? setErfassenCode : undefined}
                entfernen={liste.entfernen}
              />
            ))}
          </div>
        )}
      </Abschnitt>

      {modus === "einlagern" && (
        <div className="fixed inset-x-0 bottom-[calc(108px+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:left-72">
          <div className="mx-auto max-w-2xl">
            <Knopf
              art="primaer"
              groesse="xl"
              breit
              laedt={bucht}
              disabled={!ziel || zuBuchen.length === 0}
              onClick={() => void buchen()}
              symbol={<PackageCheck className="size-6" />}
              className="shadow-hoch"
            >
              {!ziel
                ? "Zuerst Ziel wählen"
                : zuBuchen.length
                  ? `${anzahl(zuBuchen.length, "Stück", "Stücke")} einlagern`
                  : offeneUnbekannte
                    ? "Unbekannte zuerst erfassen"
                    : "Stücke scannen"}
            </Knopf>
          </div>
        </div>
      )}

      <PlatzWahl
        offen={wahlOffen}
        schliessen={() => setWahlOffen(false)}
        waehlen={(p: Platz) => setZiel(p)}
        aktuell={ziel?.id}
        titel="Wohin einlagern?"
      />
      <ErfassenBlatt
        code={erfassenCode}
        platz={modus === "einlagern" ? ziel : null}
        schliessen={() => setErfassenCode(null)}
        fertig={erfasst}
      />
    </div>
  );
}

function ZielKarte({ ziel, waehlen }: { ziel: PlatzKurz | null; waehlen: () => void }) {
  if (!ziel) {
    return (
      <button
        onClick={waehlen}
        className="flex w-full items-center gap-4 rounded-2xl border-2 border-dashed border-primaer/40 bg-primaer-weich/40 p-4 text-left transition hover:bg-primaer-weich active:scale-[0.99]"
      >
        <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-primaer text-auf-primaer">
          <Warehouse className="size-6" />
        </span>
        <span className="flex-1">
          <span className="block text-[15px] font-bold">Ziel: Regal-Etikett scannen</span>
          <span className="block text-[13px] text-gedaempft">oder hier antippen und aus der Liste wählen</span>
        </span>
      </button>
    );
  }
  return (
    <div className="anim-plopp flex items-center gap-4 rounded-2xl bg-primaer p-4 text-auf-primaer shadow-hoch">
      <span className="flex size-12 shrink-0 items-center justify-center rounded-xl bg-white/20">
        <Warehouse className="size-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium opacity-80">Einlagern nach</span>
        <span className="block truncate text-lg font-bold">{ziel.pfad}</span>
      </span>
      <button onClick={waehlen} className="h-11 rounded-xl bg-white/20 px-4 text-sm font-semibold transition hover:bg-white/30 active:scale-95">
        Ändern
      </button>
    </div>
  );
}
