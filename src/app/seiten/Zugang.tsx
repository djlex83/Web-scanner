import { Eye, EyeOff, KeyRound, LifeBuoy, ShieldCheck } from "lucide-react";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import { fehlerText, holen, senden } from "../lib/api";
import { useSitzung } from "../lib/sitzung";
import { Logo } from "../Rahmen";
import { Eingabe, Feld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis } from "../ui/zustand";

function Huelle({ titel, text, children }: { titel: string; text: string; children: ReactNode }) {
  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-clip px-4 py-10">
      <div aria-hidden className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[820px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--primaer-weich),transparent)] opacity-90" />
      <div className="anim-ein relative w-full max-w-sm">
        <div className="mb-8 flex justify-center">
          <Logo gross />
        </div>
        <div className="rounded-[28px] border border-rand bg-flaeche p-6 shadow-hoch sm:p-8">
          <h1 className="text-2xl font-bold tracking-tight">{titel}</h1>
          <p className="mb-6 mt-1 text-[15px] text-gedaempft">{text}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function PasswortFeld({
  beschriftung,
  wert,
  setzen,
  neu,
  hinweis,
  autoComplete,
}: {
  beschriftung: string;
  wert: string;
  setzen: (s: string) => void;
  neu?: boolean;
  hinweis?: string;
  autoComplete?: string;
}) {
  const [sichtbar, setSichtbar] = useState(false);
  return (
    <Feld beschriftung={beschriftung} hinweis={hinweis}>
      {(p) => (
        <div className="relative">
          <Eingabe
            {...p}
            type={sichtbar ? "text" : "password"}
            value={wert}
            onChange={(e) => setzen(e.target.value)}
            autoComplete={autoComplete ?? (neu ? "new-password" : "current-password")}
            className="pr-14"
            required
          />
          <button
            type="button"
            onClick={() => setSichtbar(!sichtbar)}
            aria-label={sichtbar ? "Passwort verbergen" : "Passwort anzeigen"}
            className="absolute right-1 top-1/2 flex size-11 -translate-y-1/2 items-center justify-center rounded-lg text-gedaempft hover:text-text"
          >
            {sichtbar ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
          </button>
        </div>
      )}
    </Feld>
  );
}

function useAbsenden(aktion: () => Promise<void>) {
  const [laedt, setLaedt] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);
  const absenden = async (e: FormEvent) => {
    e.preventDefault();
    setLaedt(true);
    setFehler(null);
    try {
      await aktion();
    } catch (err) {
      setFehler(fehlerText(err));
    } finally {
      setLaedt(false);
    }
  };
  return { laedt, fehler, absenden };
}

export function Anmelden() {
  const { neuLaden } = useSitzung();
  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const [bleiben, setBleiben] = useState(true);
  const [notfallMoeglich, setNotfallMoeglich] = useState(false);
  const [notfall, setNotfall] = useState(false);
  useEffect(() => {
    holen<{ verfuegbar: boolean }>("/auth/notfall")
      .then((r) => setNotfallMoeglich(r.verfuegbar))
      .catch(() => {});
  }, []);
  const f = useAbsenden(async () => {
    await senden("/auth/anmelden", { benutzername, passwort, angemeldet_bleiben: bleiben });
    await neuLaden();
  });

  if (notfall) return <NotfallZugang zurueck={() => setNotfall(false)} />;

  return (
    <Huelle titel="Anmelden" text="Mit deinem persönlichen Konto.">
      <form onSubmit={f.absenden} className="space-y-5">
        {f.fehler && <FehlerHinweis text={f.fehler} />}
        <Feld beschriftung="Benutzername">
          {(p) => (
            <Eingabe
              {...p}
              value={benutzername}
              onChange={(e) => setBenutzername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          )}
        </Feld>
        <PasswortFeld beschriftung="Passwort" wert={passwort} setzen={setPasswort} />
        <label className="flex min-h-12 cursor-pointer items-center gap-3 px-1 text-[15px]">
          <input type="checkbox" checked={bleiben} onChange={(e) => setBleiben(e.target.checked)} className="size-5 accent-[var(--primaer)]" />
          Angemeldet bleiben (30 Tage)
        </label>
        <Knopf type="submit" art="primaer" groesse="l" breit laedt={f.laedt}>
          Anmelden
        </Knopf>
        <p className="text-center text-[13px] text-gedaempft">Passwort vergessen? Ein Admin kann es zurücksetzen.</p>
        {notfallMoeglich && (
          <button
            type="button"
            onClick={() => setNotfall(true)}
            className="mx-auto flex min-h-11 items-center gap-2 rounded-lg px-3 text-[13px] font-semibold text-primaer-text hover:bg-primaer-weich"
          >
            <LifeBuoy className="size-4" /> Admin-Zugang wiederherstellen
          </button>
        )}
      </form>
    </Huelle>
  );
}

/** Admin-Passwort mit dem Notfall-Code neu setzen (Code liegt als Secret in Cloudflare). */
function NotfallZugang({ zurueck }: { zurueck: () => void }) {
  const { neuLaden } = useSitzung();
  const [code, setCode] = useState("");
  const [benutzername, setBenutzername] = useState("");
  const [neu, setNeu] = useState("");
  const f = useAbsenden(async () => {
    await senden("/auth/notfall", { code, benutzername, neues_passwort: neu });
    await neuLaden();
  });

  return (
    <Huelle
      titel="Admin-Zugang wiederherstellen"
      text="Mit dem Notfall-Code aus den Cloudflare-Einstellungen setzt du ein neues Passwort für ein Admin-Konto."
    >
      <form onSubmit={f.absenden} className="space-y-5">
        {f.fehler && <FehlerHinweis text={f.fehler} />}
        <PasswortFeld beschriftung="Notfall-Code" wert={code} setzen={setCode} autoComplete="off" hinweis="Steht als Secret NOTFALL_CODE beim Worker in Cloudflare" />
        <Feld beschriftung="Benutzername des Admins">
          {(p) => (
            <Eingabe
              {...p}
              value={benutzername}
              onChange={(e) => setBenutzername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              autoCorrect="off"
              required
            />
          )}
        </Feld>
        <PasswortFeld beschriftung="Neues Passwort" wert={neu} setzen={setNeu} neu hinweis="Mindestens 8 Zeichen" />
        <Knopf type="submit" art="primaer" groesse="l" breit laedt={f.laedt} symbol={<KeyRound className="size-5" />}>
          Neues Passwort setzen
        </Knopf>
        <Knopf art="leise" breit onClick={zurueck}>
          Zurück zur Anmeldung
        </Knopf>
        <p className="text-center text-[13px] text-gedaempft">Jeder Versuch wird im Protokoll vermerkt.</p>
      </form>
    </Huelle>
  );
}

export function Einrichten() {
  const { neuLaden } = useSitzung();
  const [name, setName] = useState("");
  const [benutzername, setBenutzername] = useState("");
  const [passwort, setPasswort] = useState("");
  const f = useAbsenden(async () => {
    await senden("/auth/einrichten", { name, benutzername, passwort });
    await neuLaden();
  });

  return (
    <Huelle titel="Willkommen!" text="Lege das erste Konto an. Es bekommt alle Rechte (Admin) und kann weitere Benutzer einladen.">
      <form onSubmit={f.absenden} className="space-y-5">
        {f.fehler && <FehlerHinweis text={f.fehler} />}
        <Feld beschriftung="Dein Name">
          {(p) => <Eingabe {...p} value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" required />}
        </Feld>
        <Feld beschriftung="Benutzername" hinweis="Zum Anmelden, z. B. vorname.nachname">
          {(p) => (
            <Eingabe
              {...p}
              value={benutzername}
              onChange={(e) => setBenutzername(e.target.value)}
              autoComplete="username"
              autoCapitalize="none"
              required
            />
          )}
        </Feld>
        <PasswortFeld beschriftung="Passwort" wert={passwort} setzen={setPasswort} neu hinweis="Mindestens 8 Zeichen" />
        <Knopf type="submit" art="primaer" groesse="l" breit laedt={f.laedt} symbol={<ShieldCheck className="size-5" />}>
          Konto anlegen
        </Knopf>
      </form>
    </Huelle>
  );
}

/** Pflicht beim ersten Anmelden mit einem Startpasswort vom Admin. */
export function PasswortPflicht() {
  const { neuLaden, abmelden } = useSitzung();
  const [alt, setAlt] = useState("");
  const [neu, setNeu] = useState("");
  const f = useAbsenden(async () => {
    await senden("/auth/passwort", { alt, neu });
    await neuLaden();
  });

  return (
    <Huelle titel="Eigenes Passwort festlegen" text="Dein Konto wurde mit einem Startpasswort angelegt. Bitte wähle jetzt ein eigenes.">
      <form onSubmit={f.absenden} className="space-y-5">
        {f.fehler && <FehlerHinweis text={f.fehler} />}
        <PasswortFeld beschriftung="Startpasswort" wert={alt} setzen={setAlt} />
        <PasswortFeld beschriftung="Neues Passwort" wert={neu} setzen={setNeu} neu hinweis="Mindestens 8 Zeichen" />
        <Knopf type="submit" art="primaer" groesse="l" breit laedt={f.laedt} symbol={<KeyRound className="size-5" />}>
          Passwort speichern
        </Knopf>
        <Knopf art="leise" breit onClick={() => void abmelden()}>
          Abmelden
        </Knopf>
      </form>
    </Huelle>
  );
}
