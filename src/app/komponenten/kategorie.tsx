import {
  Archive, Armchair, BatteryFull, Bike, BookOpen, Box, Cable, Camera, Car, Cog, Cylinder, Drill, Droplet, Fan,
  FlaskConical, Flame, Forklift, Gauge, Hammer, HardHat, Headphones, KeyRound, Laptop, Lightbulb, Microscope,
  Monitor, Package, Paintbrush, Plug, Printer, Radio, Ruler, Scissors, Server, ShieldCheck, Shirt, Smartphone,
  Stethoscope, Thermometer, Truck, Utensils, Wrench, Zap, type LucideIcon,
} from "lucide-react";
import { useEffect, useState } from "react";
import { OHNE_KATEGORIE, standardStil, type Kategorie, type KategorieStil, type Symbol } from "../../gemeinsam/kategorien";
import type { Stueck } from "../../gemeinsam/typen";
import { holen } from "../lib/api";
import { kl } from "../ui/kl";

export const SYMBOL: Record<Symbol, { bild: LucideIcon; name: string }> = {
  box: { bild: Box, name: "Kiste" },
  wrench: { bild: Wrench, name: "Werkzeug" },
  hammer: { bild: Hammer, name: "Hammer" },
  drill: { bild: Drill, name: "Bohrmaschine" },
  ruler: { bild: Ruler, name: "Lineal" },
  gauge: { bild: Gauge, name: "Messgerät" },
  thermometer: { bild: Thermometer, name: "Thermometer" },
  microscope: { bild: Microscope, name: "Labor" },
  zap: { bild: Zap, name: "Elektrik" },
  plug: { bild: Plug, name: "Stecker" },
  cable: { bild: Cable, name: "Kabel" },
  battery: { bild: BatteryFull, name: "Akku" },
  lightbulb: { bild: Lightbulb, name: "Lampe" },
  fan: { bild: Fan, name: "Lüfter" },
  laptop: { bild: Laptop, name: "Laptop" },
  monitor: { bild: Monitor, name: "Bildschirm" },
  smartphone: { bild: Smartphone, name: "Handy" },
  printer: { bild: Printer, name: "Drucker" },
  camera: { bild: Camera, name: "Kamera" },
  server: { bild: Server, name: "Server" },
  headphones: { bild: Headphones, name: "Kopfhörer" },
  radio: { bild: Radio, name: "Funk" },
  truck: { bild: Truck, name: "Transport" },
  forklift: { bild: Forklift, name: "Stapler" },
  car: { bild: Car, name: "Fahrzeug" },
  bike: { bild: Bike, name: "Fahrrad" },
  package: { bild: Package, name: "Paket" },
  archive: { bild: Archive, name: "Archiv" },
  cylinder: { bild: Cylinder, name: "Gasflasche" },
  droplet: { bild: Droplet, name: "Flüssigkeit" },
  flame: { bild: Flame, name: "Brandschutz" },
  flask: { bild: FlaskConical, name: "Chemie" },
  hardhat: { bild: HardHat, name: "Schutzausrüstung" },
  shield: { bild: ShieldCheck, name: "Sicherheit" },
  shirt: { bild: Shirt, name: "Kleidung" },
  stethoscope: { bild: Stethoscope, name: "Erste Hilfe" },
  paintbrush: { bild: Paintbrush, name: "Malerbedarf" },
  scissors: { bild: Scissors, name: "Schere" },
  key: { bild: KeyRound, name: "Schlüssel" },
  book: { bild: BookOpen, name: "Handbuch" },
  cog: { bild: Cog, name: "Maschinenteil" },
  armchair: { bild: Armchair, name: "Möbel" },
  utensils: { bild: Utensils, name: "Küche" },
};

// ─── Kategorien einmal laden und überall teilen ─────────────────────────────
let daten: Kategorie[] | null = null;
let laeuft: Promise<void> | null = null;
const hoerer = new Set<() => void>();

export function kategorienAktualisieren(): Promise<void> {
  laeuft ??= holen<Kategorie[]>("/kategorien")
    .then((d) => {
      daten = d;
      hoerer.forEach((f) => f());
    })
    .catch(() => {})
    .finally(() => {
      laeuft = null;
    });
  return laeuft;
}

export function useKategorien(): Kategorie[] | null {
  const [, neuZeichnen] = useState(0);
  useEffect(() => {
    const f = () => neuZeichnen((z) => z + 1);
    hoerer.add(f);
    if (!daten) void kategorienAktualisieren();
    return () => {
      hoerer.delete(f);
    };
  }, []);
  return daten;
}

export function stilFuer(name: string | null | undefined, liste: Kategorie[] | null): KategorieStil {
  if (!name) return OHNE_KATEGORIE;
  return liste?.find((k) => k.name.toLowerCase() === name.toLowerCase()) ?? standardStil(name);
}

// ─── Darstellung ─────────────────────────────────────────────────────────────

/** Farbiges Kategorie-Symbol. Größe und Rundung über className (z. B. "size-11 rounded-xl"). */
export function KategorieSymbol({ stil, className }: { stil: KategorieStil; className?: string }) {
  const Bild = SYMBOL[stil.symbol]?.bild ?? Box;
  return (
    <span
      aria-hidden
      className={kl("flex shrink-0 items-center justify-center", className)}
      style={{ background: `var(--kat-${stil.farbe}-bg)`, color: `var(--kat-${stil.farbe}-fg)` }}
    >
      <Bild className="size-[46%]" strokeWidth={2} />
    </span>
  );
}

export function fotoAdresse(s: Pick<Stueck, "id" | "foto_version">, gross = false): string {
  return `/api/stuecke/${s.id}/foto?v=${s.foto_version}${gross ? "&groesse=gross" : ""}`;
}

/** Foto des Stücks, sonst das Symbol seiner Kategorie. */
export function StueckBild({
  stueck,
  gross,
  className,
}: {
  stueck: Pick<Stueck, "id" | "kategorie" | "foto_version">;
  gross?: boolean;
  className?: string;
}) {
  const kategorien = useKategorien();
  const [kaputt, setKaputt] = useState(false);
  if (stueck.foto_version && !kaputt) {
    return (
      <img
        src={fotoAdresse(stueck, gross)}
        alt=""
        loading="lazy"
        decoding="async"
        onError={() => setKaputt(true)}
        className={kl("shrink-0 bg-flaeche-2 object-cover", className)}
      />
    );
  }
  return <KategorieSymbol stil={stilFuer(stueck.kategorie, kategorien)} className={className} />;
}
