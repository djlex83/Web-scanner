import { KeyRound, Plus, UserRound, Users } from "lucide-react";
import { useState } from "react";
import { ROLLEN, ROLLEN_BESCHREIBUNG, ROLLEN_NAME, type Rolle } from "../../gemeinsam/rechte";
import { zufallsKennung } from "../../gemeinsam/codes";
import type { Benutzer as BenutzerTyp } from "../../gemeinsam/typen";
import { aendern, fehlerText, senden } from "../lib/api";
import { vorWann } from "../lib/format";
import { useLaden } from "../lib/hooks";
import { useIch } from "../lib/sitzung";
import { Abzeichen, RollenAbzeichen } from "../ui/abzeichen";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld } from "../ui/formular";
import { Liste, Zeile } from "../ui/karte";
import { kl } from "../ui/kl";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis, Leer, SkelettListe } from "../ui/zustand";

const startPasswort = () => zufallsKennung(4) + "-" + zufallsKennung(4);

export default function Benutzer() {
  const { daten, fehler, neuLaden } = useLaden<BenutzerTyp[]>("/benutzer");
  const [neu, setNeu] = useState(false);
  const [auswahl, setAuswahl] = useState<BenutzerTyp | null>(null);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <SeitenKopf
        titel="Benutzer"
        unter="Jede Person hat ein eigenes Konto"
        aktionen={
          <Knopf art="primaer" symbol={<Plus className="size-5" />} onClick={() => setNeu(true)}>
            <span className="sr-only sm:not-sr-only">Benutzer</span>
          </Knopf>
        }
      />
      {fehler && <FehlerHinweis text={fehler} nochmal={neuLaden} />}
      {!daten ? (
        <SkelettListe zeilen={3} />
      ) : daten.length === 0 ? (
        <Leer symbol={<Users />} titel="Keine Benutzer" />
      ) : (
        <Liste>
          {daten.map((b) => (
            <Zeile
              key={b.id}
              onClick={() => setAuswahl(b)}
              symbol={<span className="text-base font-bold">{b.name.slice(0, 1).toUpperCase()}</span>}
              titel={<span className={kl(!b.aktiv && "text-gedaempft line-through")}>{b.name}</span>}
              unter={`@${b.benutzername} · ${b.letzte_anmeldung ? "zuletzt " + vorWann(b.letzte_anmeldung) : "noch nie angemeldet"}`}
              rechts={
                <span className="flex flex-col items-end gap-1">
                  <RollenAbzeichen rolle={b.rolle} />
                  {!b.aktiv && <Abzeichen>gesperrt</Abzeichen>}
                </span>
              }
            />
          ))}
        </Liste>
      )}

      {neu && (
        <NeuBlatt
          schliessen={() => setNeu(false)}
          fertig={() => {
            setNeu(false);
            void neuLaden();
          }}
        />
      )}
      {auswahl && (
        <BearbeitenBlatt
          benutzer={auswahl}
          schliessen={() => setAuswahl(null)}
          fertig={() => {
            setAuswahl(null);
            void neuLaden();
          }}
        />
      )}
    </div>
  );
}

function RollenWahl({ wert, aendern }: { wert: Rolle; aendern: (r: Rolle) => void }) {
  return (
    <fieldset className="space-y-2">
      <legend className="mb-1.5 px-1 text-sm font-semibold">Rolle</legend>
      {ROLLEN.map((r) => (
        <label
          key={r}
          className={kl(
            "flex min-h-14 cursor-pointer items-center gap-3 rounded-2xl border px-4 py-2.5 transition",
            wert === r ? "border-primaer bg-primaer-weich" : "border-rand hover:bg-flaeche-2",
          )}
        >
          <input type="radio" name="rolle" checked={wert === r} onChange={() => aendern(r)} className="size-5 accent-[var(--primaer)]" />
          <span>
            <span className="block text-[15px] font-semibold">{ROLLEN_NAME[r]}</span>
            <span className="block text-[13px] text-gedaempft">{ROLLEN_BESCHREIBUNG[r]}</span>
          </span>
        </label>
      ))}
    </fieldset>
  );
}

function NeuBlatt({ schliessen, fertig }: { schliessen: () => void; fertig: () => void }) {
  const melden = useMeldung();
  const [name, setName] = useState("");
  const [benutzername, setBenutzername] = useState("");
  const [rolle, setRolle] = useState<Rolle>("mitarbeiter");
  const [passwort, setPasswort] = useState(startPasswort);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [angelegt, setAngelegt] = useState(false);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      await senden("/benutzer", { name, benutzername, rolle, passwort });
      setAngelegt(true);
      melden("Benutzer angelegt");
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  if (angelegt) {
    return (
      <Blatt offen schliessen={fertig} titel="Benutzer angelegt" fuss={<Knopf art="primaer" groesse="l" breit onClick={fertig}>Fertig</Knopf>}>
        <p className="text-[15px] text-gedaempft">Gib diese Zugangsdaten an {name} weiter. Beim ersten Anmelden muss ein eigenes Passwort gewählt werden.</p>
        <dl className="mt-4 space-y-3 rounded-2xl bg-flaeche-2 p-4">
          <div>
            <dt className="text-[13px] text-gedaempft">Benutzername</dt>
            <dd className="font-mono text-lg font-semibold">{benutzername}</dd>
          </div>
          <div>
            <dt className="text-[13px] text-gedaempft">Startpasswort</dt>
            <dd className="font-mono text-lg font-semibold">{passwort}</dd>
          </div>
        </dl>
      </Blatt>
    );
  }

  return (
    <Blatt
      offen
      schliessen={schliessen}
      titel="Neuer Benutzer"
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Anlegen
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Name">{(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vor- und Nachname" />}</Feld>
        <Feld beschriftung="Benutzername" hinweis="Zum Anmelden – Buchstaben, Ziffern, Punkt, Minus">
          {(p) => (
            <Eingabe {...p} value={benutzername} onChange={(e) => setBenutzername(e.target.value)} autoCapitalize="none" autoCorrect="off" placeholder="vorname.nachname" />
          )}
        </Feld>
        <RollenWahl wert={rolle} aendern={setRolle} />
        <Feld beschriftung="Startpasswort" hinweis="Wird beim ersten Anmelden geändert">
          {(p) => <Eingabe {...p} value={passwort} onChange={(e) => setPasswort(e.target.value)} className="font-mono" />}
        </Feld>
      </div>
    </Blatt>
  );
}

function BearbeitenBlatt({ benutzer, schliessen, fertig }: { benutzer: BenutzerTyp; schliessen: () => void; fertig: () => void }) {
  const melden = useMeldung();
  const ich = useIch();
  const [name, setName] = useState(benutzer.name);
  const [rolle, setRolle] = useState<Rolle>(benutzer.rolle);
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const [neuesPasswort, setNeuesPasswort] = useState<string | null>(null);

  async function speichern(daten: Record<string, unknown>, text: string) {
    setLaedt(true);
    setFehler(null);
    try {
      await aendern(`/benutzer/${benutzer.id}`, daten);
      melden(text);
      if (!("passwort" in daten)) fertig();
    } catch (e) {
      setFehler(fehlerText(e));
      setNeuesPasswort(null);
    } finally {
      setLaedt(false);
    }
  }

  function passwortZuruecksetzen() {
    const pw = startPasswort();
    setNeuesPasswort(pw);
    void speichern({ passwort: pw }, "Passwort zurückgesetzt");
  }

  return (
    <Blatt
      offen
      schliessen={schliessen}
      titel={benutzer.name}
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern({ name, rolle }, "Gespeichert")}>
          Speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <div className="flex items-center gap-3 rounded-2xl bg-flaeche-2 px-4 py-3 text-[15px]">
          <UserRound className="size-5 text-gedaempft" />
          <span className="font-mono">@{benutzer.benutzername}</span>
        </div>
        <Feld beschriftung="Name">{(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} />}</Feld>
        <RollenWahl wert={rolle} aendern={setRolle} />

        <div className="space-y-2 border-t border-rand pt-5">
          {neuesPasswort && !fehler ? (
            <div className="rounded-2xl bg-erfolg-weich p-4 text-erfolg-text">
              <div className="text-[13px] font-semibold">Neues Startpasswort – bitte weitergeben:</div>
              <div className="mt-1 font-mono text-lg font-bold">{neuesPasswort}</div>
            </div>
          ) : (
            <Knopf breit symbol={<KeyRound className="size-5" />} onClick={passwortZuruecksetzen} disabled={laedt}>
              Passwort zurücksetzen
            </Knopf>
          )}
          {benutzer.id !== ich.id && (
            <Knopf
              art="gefahr"
              breit
              disabled={laedt}
              onClick={() => void speichern({ aktiv: !benutzer.aktiv }, benutzer.aktiv ? "Benutzer gesperrt" : "Benutzer entsperrt")}
            >
              {benutzer.aktiv ? "Zugang sperren" : "Zugang wieder freigeben"}
            </Knopf>
          )}
          <p className="px-1 text-[13px] text-gedaempft">
            Benutzer werden nie gelöscht, nur gesperrt – damit das Protokoll vollständig bleibt.
          </p>
        </div>
      </div>
    </Blatt>
  );
}
