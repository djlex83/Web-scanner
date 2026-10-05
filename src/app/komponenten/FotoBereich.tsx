import { Camera, ImagePlus, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import type { Stueck } from "../../gemeinsam/typen";
import { fehlerText, loeschen } from "../lib/api";
import { fotoHochladen } from "../lib/bild";
import { useSitzung } from "../lib/sitzung";
import { Blatt } from "../ui/blatt";
import { Karte } from "../ui/karte";
import { kl } from "../ui/kl";
import { knopfKlassen } from "../ui/knopf";
import { useMeldung } from "../ui/meldungen";
import { Kreisel } from "../ui/zustand";
import { fotoAdresse, KategorieSymbol, stilFuer, useKategorien } from "./kategorie";

/** Knopf, der Kamera bzw. Fotoauswahl öffnet. */
export function FotoWaehlen({
  beiDatei,
  text,
  art = "zweit",
  className,
  deaktiviert,
}: {
  beiDatei: (f: File) => void;
  text: string;
  art?: "primaer" | "zweit" | "leise";
  className?: string;
  deaktiviert?: boolean;
}) {
  return (
    <label className={kl(knopfKlassen(art, "m"), "cursor-pointer", deaktiviert && "pointer-events-none opacity-50", className)}>
      <Camera className="size-5" />
      {text}
      <input
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        disabled={deaktiviert}
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = "";
          if (f) beiDatei(f);
        }}
      />
    </label>
  );
}

/** Foto eines Stücks: anzeigen, vergrößern, aufnehmen/ersetzen, entfernen. */
export function FotoBereich({ stueck, geaendert }: { stueck: Stueck; geaendert: (version: number | null) => void }) {
  const { darf } = useSitzung();
  const melden = useMeldung();
  const kategorien = useKategorien();
  const [laedt, setLaedt] = useState(false);
  const [gross, setGross] = useState(false);
  const [sicher, setSicher] = useState(false);

  useEffect(() => {
    if (!sicher) return;
    const t = setTimeout(() => setSicher(false), 4000);
    return () => clearTimeout(t);
  }, [sicher]);

  async function hochladen(datei: File) {
    setLaedt(true);
    try {
      geaendert(await fotoHochladen(stueck.id, datei));
      melden(stueck.foto_version ? "Foto ersetzt" : "Foto gespeichert");
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setLaedt(false);
    }
  }

  async function entfernen() {
    if (!sicher) return setSicher(true);
    setLaedt(true);
    try {
      await loeschen(`/stuecke/${stueck.id}/foto`);
      geaendert(null);
      melden("Foto entfernt");
    } catch (e) {
      melden(fehlerText(e), "fehler");
    } finally {
      setLaedt(false);
      setSicher(false);
    }
  }

  const kannAufnehmen = darf("erfassen") && stueck.status !== "ausgemustert";

  if (!stueck.foto_version) {
    return (
      <Karte className="flex items-center gap-4 p-4">
        <KategorieSymbol stil={stilFuer(stueck.kategorie, kategorien)} className="size-16 rounded-2xl" />
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-semibold">Noch kein Foto</div>
          <div className="text-[13px] text-gedaempft">Ein Foto hilft, das richtige Stück schnell zu erkennen.</div>
        </div>
        {kannAufnehmen && (
          laedt ? <Kreisel /> : <FotoWaehlen beiDatei={(f) => void hochladen(f)} text="Foto" art="primaer" />
        )}
      </Karte>
    );
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={() => setGross(true)}
        aria-label="Foto vergrößern"
        className="relative block w-full overflow-hidden rounded-karte border border-rand bg-flaeche-2 shadow-karte"
      >
        <img src={fotoAdresse(stueck, true)} alt={`Foto: ${stueck.name}`} className="aspect-[4/3] w-full object-cover" />
        {laedt && (
          <span className="absolute inset-0 flex items-center justify-center bg-black/40">
            <Kreisel className="text-white" />
          </span>
        )}
      </button>
      {(kannAufnehmen || darf("stuecke_verwalten")) && (
        <div className="flex gap-2">
          {kannAufnehmen && (
            <FotoWaehlen beiDatei={(f) => void hochladen(f)} text="Neues Foto" art="leise" className="flex-1" deaktiviert={laedt} />
          )}
          {darf("stuecke_verwalten") && (
            <button
              type="button"
              disabled={laedt}
              onClick={() => void entfernen()}
              className={kl(knopfKlassen(sicher ? "gefahr" : "leise", "m"), "flex-1")}
            >
              <Trash2 className="size-5" />
              {sicher ? "Wirklich entfernen?" : "Entfernen"}
            </button>
          )}
        </div>
      )}
      <Blatt offen={gross} schliessen={() => setGross(false)} titel={stueck.name}>
        <img src={fotoAdresse(stueck, true)} alt={`Foto: ${stueck.name}`} className="w-full rounded-2xl" />
      </Blatt>
    </div>
  );
}

/** Kleine Foto-Vorschau mit Auswahlknopf – für Formulare (vor dem Speichern). */
export function FotoFeld({ datei, setDatei }: { datei: File | null; setDatei: (f: File | null) => void }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!datei) return setUrl(null);
    const u = URL.createObjectURL(datei);
    setUrl(u);
    return () => URL.revokeObjectURL(u);
  }, [datei]);

  return (
    <div className="flex items-center gap-3">
      {url ? (
        <img src={url} alt="Gewähltes Foto" className="size-16 rounded-xl object-cover" />
      ) : (
        <span className="flex size-16 items-center justify-center rounded-xl border border-dashed border-rand-stark text-gedaempft">
          <ImagePlus className="size-6" />
        </span>
      )}
      <FotoWaehlen beiDatei={setDatei} text={datei ? "Anderes Foto" : "Foto aufnehmen"} />
      {datei && (
        <button type="button" onClick={() => setDatei(null)} className="h-12 rounded-xl px-3 text-sm font-semibold text-gedaempft hover:bg-flaeche-2">
          Entfernen
        </button>
      )}
    </div>
  );
}
