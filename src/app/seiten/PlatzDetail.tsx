import { ArrowRightLeft, ChevronRight, ClipboardCheck, Download, PackageOpen, Pencil, Plus, Printer, Warehouse } from "lucide-react";
import { useState } from "react";
import { Link, useParams } from "react-router";
import { PLATZ_TYP_NAME, type Platz, type PlatzTyp, type Stueck } from "../../gemeinsam/typen";
import { StueckBild } from "../komponenten/kategorie";
import { PlatzAnlegen, PlatzBearbeiten } from "../komponenten/PlatzAnlegen";
import { natuerlich } from "../komponenten/PlatzWahl";
import { QrCode } from "../komponenten/QrCode";
import { StueckMerkmale } from "../komponenten/StueckMerkmale";
import { anzahl } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useSitzung } from "../lib/sitzung";
import { Abzeichen } from "../ui/abzeichen";
import { Abschnitt, Karte, Liste, Zeile } from "../ui/karte";
import { Knopf, KnopfLink, knopfKlassen } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Laden, Leer } from "../ui/zustand";

const UNTER_TYP: Record<PlatzTyp, PlatzTyp | null> = { abteilung: "regal", regal: "fach", fach: null };

export default function PlatzDetail() {
  const { id } = useParams();
  const { darf } = useSitzung();
  const melden = useMeldung();
  const { daten, fehler, neuLaden } = useLaden<{ platz: Platz; unterplaetze: Platz[]; stuecke: Stueck[] }>(`/plaetze/${id}`);
  const [anlegen, setAnlegen] = useState(false);
  const [bearbeiten, setBearbeiten] = useState(false);

  if (fehler) return <FehlerHinweis text={fehler} nochmal={neuLaden} />;
  if (!daten) return <Laden />;
  const { platz: p, unterplaetze, stuecke } = daten;
  const unterTyp = UNTER_TYP[p.typ];
  const verwalten = darf("plaetze_verwalten");

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <SeitenKopf
        zurueck
        titel={p.name}
        unter={
          <span className="flex flex-wrap items-center gap-2">
            <Abzeichen ton="primaer">{PLATZ_TYP_NAME[p.typ]}</Abzeichen>
            {p.pfad !== p.name && <span>{p.pfad}</span>}
            {!p.aktiv && <Abzeichen ton="gefahr">Deaktiviert</Abzeichen>}
          </span>
        }
        aktionen={
          verwalten && (
            <Knopf art="zweit" symbol={<Pencil className="size-5" />} onClick={() => setBearbeiten(true)}>
              <span className="sr-only sm:not-sr-only">Bearbeiten</span>
            </Knopf>
          )
        }
      />

      <Karte className="flex flex-col gap-5 p-5 sm:flex-row sm:items-center">
        <div className="mx-auto shrink-0 rounded-2xl bg-white p-3 shadow-karte sm:mx-0">
          <QrCode wert={p.code} className="size-32 [&_svg]:size-full" />
        </div>
        <div className="min-w-0 flex-1 space-y-3 text-center sm:text-left">
          <div>
            <div className="zahlen text-3xl font-bold">{anzahl(stuecke.length, "Stück", "Stücke")}</div>
            <div className="text-[13px] text-gedaempft">
              {unterplaetze.length ? "hier und in den Plätzen darunter" : "auf diesem Platz"}
            </div>
          </div>
          {p.notiz && <p className="text-[15px] text-gedaempft">{p.notiz}</p>}
          <div className="flex flex-wrap justify-center gap-2 sm:justify-start">
            {darf("buchen") && p.aktiv && (
              <KnopfLink to={`/scannen?modus=einlagern&ziel=${p.id}`} art="primaer" symbol={<ArrowRightLeft className="size-5" />}>
                Hier einlagern
              </KnopfLink>
            )}
            {darf("buchen") && p.aktiv && (
              <KnopfLink to={`/inventur/${p.id}`} symbol={<ClipboardCheck className="size-5" />}>
                Inventur
              </KnopfLink>
            )}
            {verwalten && (
              <KnopfLink to={`/etiketten?ids=${p.id}`} symbol={<Printer className="size-5" />}>
                Etikett
              </KnopfLink>
            )}
            <a href={`/api/stuecke/csv?platz=${p.id}`} download title="Inhalt als Excel-Tabelle (CSV)" className={knopfKlassen("zweit")}>
              <Download className="size-5" /> Export
            </a>
          </div>
        </div>
      </Karte>

      {unterTyp && (unterplaetze.length > 0 || verwalten) && (
        <Abschnitt
          titel={`${unterTyp === "regal" ? "Regale" : "Fächer"} · ${unterplaetze.length}`}
          aktion={
            <div className="flex gap-1">
              {verwalten && unterplaetze.length > 0 && (
                <KnopfLink to={`/etiketten?ids=${unterplaetze.map((u) => u.id).join(",")}`} art="leise" className="h-9 px-3 text-sm">
                  <Printer className="size-4" /> Alle drucken
                </KnopfLink>
              )}
              {verwalten && (
                <Knopf art="leise" className="h-9 px-3 text-sm" onClick={() => setAnlegen(true)}>
                  <Plus className="size-4" /> Neu
                </Knopf>
              )}
            </div>
          }
        >
          {unterplaetze.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-rand p-6 text-center text-[15px] text-gedaempft">
              Noch keine {unterTyp === "regal" ? "Regale" : "Fächer"}.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {[...unterplaetze]
                .sort((a, b) => natuerlich(a.name, b.name))
                .map((u) => (
                  <Link
                    key={u.id}
                    to={`/plaetze/${u.id}`}
                    className="flex min-h-16 items-center gap-3 rounded-2xl border border-rand bg-flaeche p-3 shadow-karte transition hover:border-primaer/40 active:scale-[0.98]"
                  >
                    <Warehouse className="size-5 shrink-0 text-gedaempft" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[15px] font-semibold">{u.name}</span>
                      <span className="block text-[12px] text-gedaempft">{anzahl(u.anzahl, "Stück", "Stücke")}</span>
                    </span>
                    <ChevronRight className="size-4 text-gedaempft" />
                  </Link>
                ))}
            </div>
          )}
        </Abschnitt>
      )}

      <Abschnitt titel="Inhalt">
        {stuecke.length === 0 ? (
          <Leer symbol={<PackageOpen />} titel="Leer" text="Hier liegt laut System nichts." />
        ) : (
          <Liste>
            {stuecke.map((s) => (
              <Zeile
                key={s.id}
                zu={`/stuecke/${s.id}`}
                bild={<StueckBild stueck={s} className="size-12 rounded-xl" />}
                titel={s.name}
                unter={
                  <>
                    {s.platz && s.platz.id !== p.id && <span className="font-medium text-text">{s.platz.name} · </span>}
                    {s.in_behaelter && <span className="font-medium text-text">{s.in_behaelter.name} · </span>}
                    <span className="font-mono">{s.code}</span>
                    <StueckMerkmale stueck={s} max={2} mitBehaelter={false} className="mt-1" />
                  </>
                }
                rechts={s.behaelter && <Abzeichen ton="primaer">Behälter</Abzeichen>}
              />
            ))}
          </Liste>
        )}
      </Abschnitt>

      {anlegen && unterTyp && (
        <PlatzAnlegen
          typ={unterTyp}
          eltern={p}
          schliessen={() => setAnlegen(false)}
          fertig={(n) => {
            setAnlegen(false);
            melden(n === 1 ? "Angelegt" : `${n} angelegt`);
            void neuLaden();
          }}
        />
      )}
      {bearbeiten && (
        <PlatzBearbeiten
          platz={p}
          schliessen={() => setBearbeiten(false)}
          fertig={() => {
            setBearbeiten(false);
            melden("Gespeichert");
            void neuLaden();
          }}
        />
      )}
    </div>
  );
}
