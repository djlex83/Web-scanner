import { ArrowRightLeft, Handshake, ListX, PackageCheck, ScanSearch, Undo2, Warehouse } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router";
import type { Platz, ScanTreffer, Stueck } from "../../gemeinsam/typen";
import { AusleiheBlatt } from "../komponenten/AusleiheBlatt";
import { ErfassenBlatt } from "../komponenten/ErfassenBlatt";
import { PlatzWahl } from "../komponenten/PlatzWahl";
import { fehlerText, holen, senden } from "../lib/api";
import { anzahl } from "../lib/format";
import { signalFertig } from "../lib/rueckmeldung";
import { useBuchungMelden } from "../lib/rueckgaengig";
import { useSitzung } from "../lib/sitzung";
import { nichtMoeglich, schonDort, zielFelder, type Ziel } from "../lib/ziel";
import { ManuelleEingabe, useHandscanner } from "../scanner/eingabe";
import { Kamera } from "../scanner/Kamera";
import { TrefferKarte } from "../scanner/TrefferKarte";
import { useScanListe, type Eintrag } from "../scanner/useScanListe";
import { ZielKarte } from "../scanner/ZielKarte";
import { ScanBild, useErfolg } from "../ui/bewegung";
import { Abschnitt } from "../ui/karte";
import { Segmente } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";

type Modus = "suchen" | "einlagern" | "ausleihe";

const stueckVon = (e: Eintrag): Stueck | null => (e.treffer?.art === "stueck" ? e.treffer.stueck : null);

const LEER_TEXT: Record<Modus, string> = {
  suchen: "Scanne einen oder mehrere Codes – du siehst sofort, wo jedes Stück liegt. Auch ein Foto mit vielen Etiketten geht.",
  einlagern:
    "Scanne das Regal-Etikett oder einen Behälter und danach alle Stücke, die dort hinein sollen. Unbekannte Codes kannst du direkt erfassen.",
  ausleihe: "Scanne die Stücke. Freie Stücke gibst du an eine Person aus, verliehene nimmst du zurück.",
};

export default function Scannen() {
  const { darf } = useSitzung();
  const melden = useMeldung();
  const buchungMelden = useBuchungMelden();
  const feiern = useErfolg();
  const [param, setParam] = useSearchParams();
  const kannBuchen = darf("buchen");
  const gewuenscht = param.get("modus");
  const modus: Modus = kannBuchen && (gewuenscht === "einlagern" || gewuenscht === "ausleihe") ? gewuenscht : "suchen";

  const [ziel, setZiel] = useState<Ziel | null>(null);
  const [wahlOffen, setWahlOffen] = useState(false);
  const [erfassenCode, setErfassenCode] = useState<string | null>(null);
  const [neuErfasst, setNeuErfasst] = useState<Set<string>>(new Set());
  const [bucht, setBucht] = useState(false);
  const [ausgeben, setAusgeben] = useState<Stueck[] | null>(null);

  // Ziel aus der Adresse übernehmen ("Hier einlagern" auf einer Platz-Seite, "Befüllen" bei einem Behälter)
  const zielParam = param.get("ziel");
  const behaelterParam = param.get("behaelter");
  useEffect(() => {
    if (zielParam) {
      holen<{ platz: Platz }>(`/plaetze/${Number(zielParam)}`)
        .then((r) => setZiel({ art: "platz", platz: r.platz }))
        .catch(() => {});
    } else if (behaelterParam) {
      holen<{ stueck: Stueck }>(`/stuecke/${Number(behaelterParam)}`)
        .then((r) => r.stueck.behaelter && setZiel({ art: "behaelter", stueck: r.stueck }))
        .catch(() => {});
    }
  }, [zielParam, behaelterParam]);

  const beiTreffer = useCallback(
    (t: ScanTreffer) => {
      if (modus !== "einlagern") return;
      // Im Einlagern-Modus ist ein Platz-Etikett immer das Ziel, ein Behälter nur, solange noch keins gewählt ist
      if (t.art === "platz") {
        setZiel({ art: "platz", platz: t.platz });
        melden(`Ziel: ${t.platz.pfad}`, "info");
        liste.entfernen(t.code);
      } else if (t.art === "stueck" && t.stueck.behaelter && !ziel) {
        const z: Ziel = { art: "behaelter", stueck: t.stueck };
        setZiel(z);
        melden(`Ziel: Behälter „${z.stueck.name}“`, "info");
        liste.entfernen(t.code);
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [modus, ziel],
  );
  const liste = useScanListe(beiTreffer);
  useHandscanner((code) => liste.hinzufuegen([code]));

  const stuecke = liste.eintraege.map(stueckVon).filter((s): s is Stueck => !!s);
  const zuBuchen = ziel ? stuecke.filter((s) => !schonDort(ziel, s) && !nichtMoeglich(ziel, s)) : [];
  const offeneUnbekannte = liste.eintraege.filter((e) => e.treffer?.art === "unbekannt").length;
  const frei = stuecke.filter((s) => !s.ausleihe && s.status !== "ausgemustert");
  const verliehen = stuecke.filter((s) => s.ausleihe);

  function modusWechseln(m: Modus) {
    setParam(m === "suchen" ? {} : { modus: m }, { replace: true });
    // Ein schon gescanntes Regal wird beim Wechsel zum Einlagern das Ziel
    if (m === "einlagern" && !ziel) {
      const platz = liste.eintraege.find((e) => e.treffer?.art === "platz");
      if (platz?.treffer?.art === "platz") {
        setZiel({ art: "platz", platz: platz.treffer.platz });
        liste.entfernen(platz.code);
      }
    }
  }

  /** Stücke nach einer Aktion mit frischen Daten neu auflösen */
  function aktualisieren(codes: string[]) {
    codes.forEach((c) => liste.entfernen(c));
    if (codes.length) setTimeout(() => liste.hinzufuegen(codes), 0);
  }

  async function buchen() {
    if (!ziel || !zuBuchen.length) return;
    setBucht(true);
    try {
      const r = await senden<{ gebucht: number; ziel: string; vorgang_id: string | null }>("/buchungen", {
        ...zielFelder(ziel),
        stueck_ids: zuBuchen.map((s) => s.id),
      });
      signalFertig();
      feiern(`${anzahl(r.gebucht, "Stück", "Stücke")} eingelagert`);
      buchungMelden(`${anzahl(r.gebucht, "Stück", "Stücke")} nach ${r.ziel} gebucht`, r.vorgang_id);
      liste.leeren((e) => e.treffer?.art === "stueck");
      setNeuErfasst(new Set());
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setBucht(false);
    }
  }

  async function zuruecknehmen() {
    setBucht(true);
    try {
      const r = await senden<{ zurueck: number }>("/ausleihen/zurueck", { stueck_ids: verliehen.map((s) => s.id) });
      signalFertig();
      feiern("Zurückgenommen");
      melden(`${anzahl(r.zurueck, "Stück", "Stücke")} zurückgenommen`);
      liste.leeren((e) => !!stueckVon(e)?.ausleihe);
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setBucht(false);
    }
  }

  async function gefunden(s: Stueck) {
    try {
      await senden("/vermisst/gefunden", { stueck_ids: [s.id] });
      melden(`„${s.name}“ als gefunden markiert`);
      aktualisieren([s.code]);
    } catch (e) {
      melden(fehlerText(e), "fehler");
    }
  }

  function erfasst(s: Stueck) {
    const code = erfassenCode!;
    setErfassenCode(null);
    liste.ersetzen(code, { code, art: "stueck", stueck: s });
    setNeuErfasst((n) => new Set(n).add(code));
    melden(`„${s.name}“ erfasst${s.platz ? ` → ${s.platz.pfad}` : ""}`);
  }

  // Aktionsleiste erst, wenn etwas gescannt ist – vorher erklärt die Ziel-Karte bzw. der Leertext alles
  const mitLeiste = (modus === "einlagern" || modus === "ausleihe") && liste.eintraege.length > 0;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="sr-only">Scannen</h1>
      {kannBuchen && (
        <Segmente
          beschriftung="Was möchtest du tun?"
          wert={modus}
          aendern={modusWechseln}
          optionen={[
            { wert: "suchen", text: "Wo ist?", symbol: <ScanSearch /> },
            { wert: "einlagern", text: "Einlagern", symbol: <ArrowRightLeft /> },
            { wert: "ausleihe", text: "Ausleihe", symbol: <Handshake /> },
          ]}
        />
      )}

      <Kamera
        beiCodes={liste.hinzufuegen}
        hinweis={modus === "einlagern" && !ziel ? "Erst Regal oder Behälter scannen" : undefined}
      />
      <ManuelleEingabe beiCode={(c) => liste.hinzufuegen([c])} />

      {modus === "einlagern" && <ZielKarte ziel={ziel} waehlen={() => setWahlOffen(true)} />}

      <Abschnitt
        titel={liste.eintraege.length ? `${modus === "suchen" ? "Gescannt" : "Stücke"} · ${liste.eintraege.length}` : undefined}
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
          <div className="flex flex-col items-center gap-4 rounded-2xl border border-dashed border-rand px-6 py-7 text-center">
            <ScanBild />
            <p className="max-w-md text-[15px] text-gedaempft">{LEER_TEXT[modus]}</p>
          </div>
        ) : (
          <div className="space-y-2.5">
            {liste.eintraege.map((e) => (
              <TrefferKarte
                key={e.code}
                eintrag={e}
                modus={modus}
                ziel={ziel}
                neuErfasst={neuErfasst.has(e.code)}
                erfassen={darf("erfassen") ? setErfassenCode : undefined}
                gefunden={kannBuchen ? (s) => void gefunden(s) : undefined}
                entfernen={liste.entfernen}
              />
            ))}
          </div>
        )}
      </Abschnitt>

      {mitLeiste && (
        <div className="sticky bottom-[calc(72px+env(safe-area-inset-bottom))] z-30 -mx-4 bg-gradient-to-t from-hg from-60% to-transparent px-4 pb-3 pt-6 lg:bottom-0 lg:pb-6">
          <div className="flex gap-2">
            {modus === "einlagern" ? (
              <Knopf
                art="primaer"
                groesse="xl"
                breit
                laedt={bucht}
                disabled={!!ziel && zuBuchen.length === 0}
                onClick={() => (ziel ? void buchen() : setWahlOffen(true))}
                symbol={ziel ? <PackageCheck className="size-6" /> : <Warehouse className="size-6" />}
                className="shadow-hoch"
              >
                {!ziel
                  ? "Ziel wählen"
                  : zuBuchen.length
                    ? `${anzahl(zuBuchen.length, "Stück", "Stücke")} einlagern`
                    : offeneUnbekannte
                      ? "Unbekannte zuerst erfassen"
                      : "Stücke scannen"}
              </Knopf>
            ) : (
              <>
                {verliehen.length > 0 && (
                  <Knopf
                    groesse={frei.length ? "l" : "xl"}
                    breit
                    laedt={bucht}
                    onClick={() => void zuruecknehmen()}
                    symbol={<Undo2 className="size-5" />}
                    className="whitespace-nowrap shadow-hoch"
                  >
                    {verliehen.length} zurück
                  </Knopf>
                )}
                {(frei.length > 0 || verliehen.length === 0) && (
                  <Knopf
                    art="primaer"
                    groesse={verliehen.length ? "l" : "xl"}
                    breit
                    disabled={frei.length === 0}
                    onClick={() => setAusgeben(frei)}
                    symbol={<Handshake className="size-5" />}
                    className="whitespace-nowrap shadow-hoch"
                  >
                    {frei.length ? `${frei.length} ausgeben` : "Stücke scannen"}
                  </Knopf>
                )}
              </>
            )}
          </div>
        </div>
      )}

      <PlatzWahl
        offen={wahlOffen}
        schliessen={() => setWahlOffen(false)}
        waehlen={(p: Platz) => setZiel({ art: "platz", platz: p })}
        aktuell={ziel?.art === "platz" ? ziel.platz.id : undefined}
        titel="Wohin einlagern?"
      />
      <ErfassenBlatt
        code={erfassenCode}
        ziel={modus === "einlagern" ? ziel : null}
        schliessen={() => setErfassenCode(null)}
        fertig={erfasst}
      />
      <AusleiheBlatt
        stuecke={ausgeben}
        schliessen={() => setAusgeben(null)}
        fertig={(n, an) => {
          setAusgeben(null);
          signalFertig();
          feiern(`An ${an} ausgegeben`);
          melden(`${anzahl(n, "Stück", "Stücke")} an ${an} ausgegeben`);
          liste.leeren((e) => frei.some((s) => s.code === e.code));
        }}
      />
    </div>
  );
}
