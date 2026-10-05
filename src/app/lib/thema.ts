// Hell/Dunkel: "system" folgt der Geräteeinstellung.
export type Thema = "system" | "hell" | "dunkel";

const SCHLUESSEL = "ws-thema";

export function gespeichertesThema(): Thema {
  try {
    const t = localStorage.getItem(SCHLUESSEL);
    if (t === "hell" || t === "dunkel") return t;
  } catch {
    /* egal */
  }
  return "system";
}

const dunkelAbfrage = () => window.matchMedia("(prefers-color-scheme: dark)");

export function themaAnwenden(t: Thema = gespeichertesThema()) {
  const dunkel = t === "dunkel" || (t === "system" && dunkelAbfrage().matches);
  document.documentElement.dataset.theme = dunkel ? "dunkel" : "hell";
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", dunkel ? "#15161c" : "#f6f7fb");
}

export function themaSetzen(t: Thema) {
  try {
    if (t === "system") localStorage.removeItem(SCHLUESSEL);
    else localStorage.setItem(SCHLUESSEL, t);
  } catch {
    /* egal */
  }
  themaAnwenden(t);
}

export function themaBeobachten() {
  dunkelAbfrage().addEventListener("change", () => themaAnwenden());
}
