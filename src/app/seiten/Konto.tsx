import { ChevronRight, ClipboardCheck, DatabaseBackup, Handshake, History, KeyRound, LogOut, Monitor, Moon, Shapes, Sun, UserRound, Users, Wrench } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";
import { fehlerText, senden } from "../lib/api";
import { einstellungSetzen, tonAn, vibrationAn } from "../lib/rueckmeldung";
import { useIch, useSitzung } from "../lib/sitzung";
import { gespeichertesThema, themaSetzen, type Thema } from "../lib/thema";
import { RollenAbzeichen } from "../ui/abzeichen";
import { Blatt } from "../ui/blatt";
import { Eingabe, Feld, Schalter, Segmente } from "../ui/formular";
import { Abschnitt, Karte, Liste, Zeile } from "../ui/karte";
import { Knopf } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { SeitenKopf } from "../ui/seitenkopf";
import { FehlerHinweis } from "../ui/zustand";

export default function Konto() {
  const ich = useIch();
  const { abmelden, darf } = useSitzung();
  const [thema, setThema] = useState<Thema>(gespeichertesThema);
  const [ton, setTon] = useState(tonAn);
  const [vibration, setVibration] = useState(vibrationAn);
  const [passwortOffen, setPasswortOffen] = useState(false);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SeitenKopf titel="Mein Konto" />
      <Karte className="flex items-center gap-4 p-5">
        <div className="flex size-14 items-center justify-center rounded-full bg-gradient-to-br from-primaer to-[oklch(0.6_0.2_300)] text-xl font-bold text-white">
          {ich.name.slice(0, 1).toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <div className="truncate text-lg font-bold">{ich.name}</div>
          <div className="text-[13px] text-gedaempft">@{ich.benutzername}</div>
        </div>
        <RollenAbzeichen rolle={ich.rolle} />
      </Karte>

      <Abschnitt titel="Darstellung">
        <Segmente
          beschriftung="Farbschema"
          wert={thema}
          aendern={(t) => {
            setThema(t);
            themaSetzen(t);
          }}
          optionen={[
            { wert: "system", text: "Auto", symbol: <Monitor /> },
            { wert: "hell", text: "Hell", symbol: <Sun /> },
            { wert: "dunkel", text: "Dunkel", symbol: <Moon /> },
          ]}
        />
      </Abschnitt>

      <Abschnitt titel="Scannen">
        <Liste>
          <Schalter
            an={ton}
            aendern={(a) => {
              setTon(a);
              einstellungSetzen("ws-ton", a);
            }}
            beschriftung="Ton bei Treffer"
            beschreibung="Kurzer Piepton für jeden erkannten Code"
          />
          <Schalter
            an={vibration}
            aendern={(a) => {
              setVibration(a);
              einstellungSetzen("ws-vibration", a);
            }}
            beschriftung="Vibration"
            beschreibung="Nur auf Geräten, die das unterstützen"
          />
        </Liste>
      </Abschnitt>

      <Abschnitt titel="Konto">
        <Liste>
          <Zeile symbol={<KeyRound />} titel="Passwort ändern" onClick={() => setPasswortOffen(true)} />
          <Zeile symbol={<History />} titel={darf("protokoll_alle") ? "Protokoll" : "Meine Buchungen"} zu="/protokoll" />
          {darf("benutzer_verwalten") && <Zeile symbol={<Users />} titel="Benutzer verwalten" zu="/benutzer" />}
          {darf("sicherung") && (
            <a href="/api/uebersicht/sicherung" download className="flex min-h-16 items-center gap-3 px-4 py-3 transition-colors hover:bg-flaeche-2">
              <span className="flex size-11 items-center justify-center rounded-xl bg-flaeche-2 text-gedaempft">
                <DatabaseBackup className="size-5" />
              </span>
              <span className="flex-1">
                <span className="block text-[15px] font-semibold">Datensicherung herunterladen</span>
                <span className="block text-[13px] text-gedaempft">Alle Daten als JSON-Datei (ohne Passwörter)</span>
              </span>
              <ChevronRight className="size-5 text-gedaempft/60" />
            </a>
          )}
        </Liste>
      </Abschnitt>

      <Knopf art="gefahr" groesse="l" breit symbol={<LogOut className="size-5" />} onClick={() => void abmelden()}>
        Abmelden
      </Knopf>

      {passwortOffen && <PasswortBlatt schliessen={() => setPasswortOffen(false)} />}
    </div>
  );
}

function PasswortBlatt({ schliessen }: { schliessen: () => void }) {
  const melden = useMeldung();
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  async function speichern() {
    setLaedt(true);
    setFehler(null);
    try {
      await senden("/auth/passwort", { alt, neu });
      melden("Passwort geändert – andere Geräte wurden abgemeldet");
      schliessen();
    } catch (e) {
      setFehler(fehlerText(e));
    } finally {
      setLaedt(false);
    }
  }

  return (
    <Blatt
      offen
      schliessen={schliessen}
      titel="Passwort ändern"
      fuss={
        <Knopf art="primaer" groesse="l" breit laedt={laedt} onClick={() => void speichern()}>
          Speichern
        </Knopf>
      }
    >
      <div className="space-y-5">
        {fehler && <FehlerHinweis text={fehler} />}
        <Feld beschriftung="Bisheriges Passwort">
          {(p) => <Eingabe {...p} type="password" autoComplete="current-password" value={alt} onChange={(e) => setAlt(e.target.value)} />}
        </Feld>
        <Feld beschriftung="Neues Passwort" hinweis="Mindestens 8 Zeichen">
          {(p) => <Eingabe {...p} type="password" autoComplete="new-password" value={neu} onChange={(e) => setNeu(e.target.value)} />}
        </Feld>
      </div>
    </Blatt>
  );
}

/** "Mehr"-Seite am Handy. */
export function Mehr() {
  const ich = useIch();
  const { darf } = useSitzung();
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <SeitenKopf titel="Mehr" />
      <Liste>
        <Zeile symbol={<UserRound />} titel={ich.name} unter="Mein Konto und Einstellungen" zu="/konto" />
        <Zeile symbol={<Handshake />} titel="Ausleihen" unter="Wer hat was – und bis wann?" zu="/ausleihen" />
        <Zeile symbol={<ClipboardCheck />} titel="Inventur" unter="Regal für Regal zählen" zu="/inventur" />
        <Zeile symbol={<Wrench />} titel="Prüfungen" unter="Prüf- und Wartungstermine" zu="/pruefungen" />
        <Zeile symbol={<History />} titel="Protokoll" unter="Bewegungen und Aktionen" zu="/protokoll" />
        {darf("stuecke_verwalten") && <Zeile symbol={<Shapes />} titel="Kategorien" unter="Symbole und Farben festlegen" zu="/kategorien" />}
        {darf("benutzer_verwalten") && <Zeile symbol={<Users />} titel="Benutzer" unter="Konten und Rollen verwalten" zu="/benutzer" />}
      </Liste>
      <p className="text-center text-[13px] text-gedaempft">
        <Link to="/konto" className="underline">
          Abmelden
        </Link>{" "}
        unter „Mein Konto“
      </p>
    </div>
  );
}
