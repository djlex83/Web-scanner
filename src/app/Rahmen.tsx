import { Boxes, ClipboardCheck, Handshake, History, Home, LogOut, Menu, ScanLine, UserRound, Users, Warehouse, Wrench } from "lucide-react";
import type { ReactNode } from "react";
import { NavLink, Outlet, useLocation } from "react-router";
import type { Recht } from "../gemeinsam/rechte";
import { useIch, useSitzung } from "./lib/sitzung";
import { RollenAbzeichen } from "./ui/abzeichen";
import { kl } from "./ui/kl";

interface NavPunkt {
  zu: string;
  text: string;
  symbol: ReactNode;
  recht?: Recht;
}

const NAVIGATION: NavPunkt[] = [
  { zu: "/", text: "Start", symbol: <Home /> },
  { zu: "/scannen", text: "Scannen", symbol: <ScanLine /> },
  { zu: "/stuecke", text: "Bestand", symbol: <Boxes /> },
  { zu: "/plaetze", text: "Plätze", symbol: <Warehouse /> },
  { zu: "/ausleihen", text: "Ausleihen", symbol: <Handshake /> },
  { zu: "/inventur", text: "Inventur", symbol: <ClipboardCheck /> },
  { zu: "/pruefungen", text: "Prüfungen", symbol: <Wrench /> },
  { zu: "/protokoll", text: "Protokoll", symbol: <History /> },
  { zu: "/benutzer", text: "Benutzer", symbol: <Users />, recht: "benutzer_verwalten" },
  { zu: "/konto", text: "Mein Konto", symbol: <UserRound /> },
];

export function Logo({ gross }: { gross?: boolean }) {
  return (
    <div className="flex items-center gap-3">
      <div
        className={kl(
          "flex items-center justify-center rounded-2xl bg-gradient-to-br from-primaer to-[oklch(0.6_0.2_300)] text-white shadow-[0_8px_20px_-8px_var(--primaer)]",
          gross ? "size-14" : "size-10",
        )}
      >
        <ScanLine className={gross ? "size-7" : "size-5"} />
      </div>
      <span className={kl("font-bold tracking-tight", gross ? "text-2xl" : "text-lg")}>Web Scanner</span>
    </div>
  );
}

export function Rahmen() {
  const { darf, abmelden } = useSitzung();
  const ich = useIch();
  const ort = useLocation();
  const punkte = NAVIGATION.filter((p) => !p.recht || darf(p.recht));
  const vollbild = ort.pathname.startsWith("/scannen");

  return (
    <div className="min-h-dvh">
      {/* Seitenleiste ab Desktop */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col border-r border-rand bg-flaeche/80 px-4 py-6 backdrop-blur-xl lg:flex">
        <div className="px-2">
          <Logo />
        </div>
        <nav aria-label="Hauptnavigation" className="mt-6 flex-1 space-y-0.5 overflow-y-auto">
          {punkte.map((p) => (
            <NavLink
              key={p.zu}
              to={p.zu}
              end={p.zu === "/"}
              className={({ isActive }) =>
                kl(
                  "flex h-11 items-center gap-3 rounded-xl px-3 text-[15px] font-semibold transition [&_svg]:size-5",
                  isActive ? "bg-primaer-weich text-primaer-text" : "text-gedaempft hover:bg-flaeche-2 hover:text-text",
                )
              }
            >
              {p.symbol}
              {p.text}
            </NavLink>
          ))}
        </nav>
        <div className="flex items-center gap-3 rounded-2xl border border-rand bg-flaeche p-3">
          <div className="flex size-10 items-center justify-center rounded-full bg-primaer-weich font-bold text-primaer-text">
            {ich.name.slice(0, 1).toUpperCase()}
          </div>
          <div className="min-w-0 flex-1">
            <div className="truncate text-sm font-semibold">{ich.name}</div>
            <RollenAbzeichen rolle={ich.rolle} />
          </div>
          <button
            onClick={() => void abmelden()}
            aria-label="Abmelden"
            title="Abmelden"
            className="flex size-10 items-center justify-center rounded-full text-gedaempft hover:bg-flaeche-2 hover:text-text"
          >
            <LogOut className="size-5" />
          </button>
        </div>
      </aside>

      <main
        className={kl(
          "sicher-oben px-4 pb-[calc(112px+env(safe-area-inset-bottom))] lg:pb-12 lg:pl-[calc(18rem+2rem)] lg:pr-8",
          vollbild ? "pt-3 lg:pt-8" : "pt-4 lg:pt-10",
        )}
      >
        <div className="mx-auto max-w-5xl">
          <Outlet />
        </div>
      </main>

      <UnterNavigation />
    </div>
  );
}

/** Untere Leiste am Handy, Scannen als großer Knopf in der Mitte. */
function UnterNavigation() {
  const reiter: NavPunkt[] = [
    { zu: "/", text: "Start", symbol: <Home /> },
    { zu: "/stuecke", text: "Bestand", symbol: <Boxes /> },
    { zu: "/scannen", text: "Scannen", symbol: <ScanLine /> },
    { zu: "/plaetze", text: "Plätze", symbol: <Warehouse /> },
    { zu: "/mehr", text: "Mehr", symbol: <Menu /> },
  ];
  const ort = useLocation();
  const mehrAktiv = ["/mehr", "/protokoll", "/benutzer", "/konto", "/kategorien", "/ausleihen", "/inventur", "/pruefungen"].some((p) => ort.pathname.startsWith(p));

  return (
    <nav
      aria-label="Hauptnavigation"
      className="sicher-unten fixed inset-x-0 bottom-0 z-40 border-t border-rand bg-flaeche/85 backdrop-blur-xl lg:hidden"
    >
      <div className="mx-auto flex h-[72px] max-w-lg items-stretch justify-around px-2">
        {reiter.map((r) =>
          r.zu === "/scannen" ? (
            <NavLink key={r.zu} to={r.zu} aria-label="Scannen" className="relative -mt-6 flex w-20 flex-col items-center">
              {({ isActive }) => (
                <>
                  <span
                    className={kl(
                      "flex size-16 items-center justify-center rounded-[22px] bg-gradient-to-br from-primaer to-[oklch(0.6_0.2_300)] text-white transition active:scale-95 [&_svg]:size-7",
                      "shadow-[0_10px_24px_-8px_var(--primaer)] ring-4 ring-hg",
                      isActive && "scale-105",
                    )}
                  >
                    {r.symbol}
                  </span>
                  <span className="mt-1 text-[11px] font-semibold text-primaer-text">{r.text}</span>
                </>
              )}
            </NavLink>
          ) : (
            <NavLink
              key={r.zu}
              to={r.zu}
              end={r.zu === "/"}
              className={({ isActive }) =>
                kl(
                  "flex w-16 flex-col items-center justify-center gap-1 text-[11px] font-semibold transition [&_svg]:size-6",
                  isActive || (r.zu === "/mehr" && mehrAktiv) ? "text-primaer-text" : "text-gedaempft",
                )
              }
            >
              {r.symbol}
              {r.text}
            </NavLink>
          ),
        )}
      </div>
    </nav>
  );
}
