import { lazy, Suspense, type ReactNode } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router";
import type { Recht } from "../gemeinsam/rechte";
import { SitzungsAnbieter, useSitzung } from "./lib/sitzung";
import { Rahmen } from "./Rahmen";
import { Anmelden, Einrichten, PasswortPflicht } from "./seiten/Zugang";
import { ErfolgsAnbieter } from "./ui/bewegung";
import { MeldungenAnbieter } from "./ui/meldungen";
import { Laden } from "./ui/zustand";

// Seiten erst beim Öffnen laden – der Scanner (mit WebAssembly) ist das größte Bündel
const Start = lazy(() => import("./seiten/Start"));
const Scannen = lazy(() => import("./seiten/Scannen"));
const Bestand = lazy(() => import("./seiten/Bestand"));
const StueckDetail = lazy(() => import("./seiten/StueckDetail"));
const Plaetze = lazy(() => import("./seiten/Plaetze"));
const PlatzDetail = lazy(() => import("./seiten/PlatzDetail"));
const Etiketten = lazy(() => import("./seiten/Etiketten"));
const Protokoll = lazy(() => import("./seiten/Protokoll"));
const Benutzer = lazy(() => import("./seiten/Benutzer"));
const Konto = lazy(() => import("./seiten/Konto"));
const Kategorien = lazy(() => import("./seiten/Kategorien"));
const Ausleihen = lazy(() => import("./seiten/Ausleihen"));
const Pruefungen = lazy(() => import("./seiten/Pruefungen"));
const Inventur = lazy(() => import("./seiten/Inventur"));
const InventurPlatz = lazy(() => import("./seiten/InventurPlatz"));
const Mehr = lazy(() => import("./seiten/Konto").then((m) => ({ default: m.Mehr })));

function Nur({ recht, children }: { recht: Recht; children: ReactNode }) {
  const { darf } = useSitzung();
  return darf(recht) ? children : <Navigate to="/" replace />;
}

function Inhalt() {
  const { ich, bereit, einrichtungNoetig } = useSitzung();
  if (!bereit) return <Laden text="Startet …" />;
  if (!ich) return einrichtungNoetig ? <Einrichten /> : <Anmelden />;
  if (ich.passwort_aendern) return <PasswortPflicht />;

  return (
    <Suspense fallback={<Laden />}>
      <Routes>
        <Route path="/etiketten" element={<Nur recht="erfassen"><Etiketten /></Nur>} />
        <Route element={<Rahmen />}>
          <Route index element={<Start />} />
          <Route path="scannen" element={<Scannen />} />
          <Route path="stuecke" element={<Bestand />} />
          <Route path="stuecke/:id" element={<StueckDetail />} />
          <Route path="kategorien" element={<Nur recht="stuecke_verwalten"><Kategorien /></Nur>} />
          <Route path="plaetze" element={<Plaetze />} />
          <Route path="plaetze/:id" element={<PlatzDetail />} />
          <Route path="ausleihen" element={<Ausleihen />} />
          <Route path="pruefungen" element={<Pruefungen />} />
          <Route path="inventur" element={<Inventur />} />
          <Route path="inventur/:id" element={<Nur recht="buchen"><InventurPlatz /></Nur>} />
          <Route path="protokoll" element={<Protokoll />} />
          <Route path="benutzer" element={<Nur recht="benutzer_verwalten"><Benutzer /></Nur>} />
          <Route path="konto" element={<Konto />} />
          <Route path="mehr" element={<Mehr />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </Suspense>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <SitzungsAnbieter>
        <MeldungenAnbieter>
          <ErfolgsAnbieter>
            <Inhalt />
          </ErfolgsAnbieter>
        </MeldungenAnbieter>
      </SitzungsAnbieter>
    </BrowserRouter>
  );
}
