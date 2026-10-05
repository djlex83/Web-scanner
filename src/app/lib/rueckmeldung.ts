// Ton und Vibration beim Scannen. Einstellungen im Browser gespeichert.

let ctx: AudioContext | null = null;

function einstellung(name: string): boolean {
  try {
    return localStorage.getItem(name) !== "aus";
  } catch {
    return true;
  }
}

export const tonAn = () => einstellung("ws-ton");
export const vibrationAn = () => einstellung("ws-vibration");

export function einstellungSetzen(name: "ws-ton" | "ws-vibration", an: boolean) {
  try {
    localStorage.setItem(name, an ? "an" : "aus");
  } catch {
    /* egal */
  }
}

function ton(frequenz: number, dauer: number, lautstaerke = 0.08) {
  if (!tonAn()) return;
  try {
    ctx ??= new AudioContext();
    if (ctx.state === "suspended") void ctx.resume();
    const osz = ctx.createOscillator();
    const verst = ctx.createGain();
    osz.type = "sine";
    osz.frequency.value = frequenz;
    verst.gain.setValueAtTime(lautstaerke, ctx.currentTime);
    verst.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dauer);
    osz.connect(verst).connect(ctx.destination);
    osz.start();
    osz.stop(ctx.currentTime + dauer);
  } catch {
    /* kein Ton möglich */
  }
}

function vibrieren(muster: number | number[]) {
  if (vibrationAn() && "vibrate" in navigator) navigator.vibrate(muster);
}

export function signalTreffer() {
  ton(1320, 0.09);
  vibrieren(35);
}

export function signalUnbekannt() {
  ton(520, 0.16);
  vibrieren([40, 60, 40]);
}

export function signalFertig() {
  ton(880, 0.08);
  setTimeout(() => ton(1320, 0.12), 90);
  vibrieren([30, 50, 60]);
}
