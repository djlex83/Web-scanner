import { Camera, CameraOff, Flashlight, FlashlightOff, ImageUp, Pause, Play } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { kl } from "../ui/kl";
import { Kreisel } from "../ui/zustand";
import { erkennen, fotoErkennen, type Fund } from "./erkennung";

type Zustand = "startet" | "laeuft" | "pause" | "verweigert" | "fehler";

const WIEDERHOLSPERRE_MS = 2500; // gleicher Code erst nach 2,5 s erneut melden
const TAKT_MS = 110;

/**
 * Kamerabild mit Sucher. Meldet neu erkannte Codes (auch mehrere je Bild) über `beiCodes`.
 */
export function Kamera({ beiCodes, hinweis }: { beiCodes: (codes: string[]) => void; hinweis?: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const leinwandRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const zuletzt = useRef(new Map<string, number>());
  const rueckruf = useRef(beiCodes);
  rueckruf.current = beiCodes;

  const [zustand, setZustand] = useState<Zustand>("startet");
  const [licht, setLicht] = useState<boolean | null>(null); // null = nicht verfügbar
  const [blitz, setBlitz] = useState(0);
  const [fotoLaeuft, setFotoLaeuft] = useState(false);

  const stoppen = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  }, []);

  const starten = useCallback(async () => {
    setZustand("startet");
    if (!navigator.mediaDevices?.getUserMedia) {
      setZustand("fehler");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
      });
      streamRef.current = stream;
      const video = videoRef.current!;
      video.srcObject = stream;
      await video.play().catch(() => {});
      const spur = stream.getVideoTracks()[0];
      const faehig = (spur?.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] };
      setLicht(faehig.torch ? false : null);
      if (faehig.focusMode?.includes("continuous")) {
        await spur?.applyConstraints({ advanced: [{ focusMode: "continuous" } as MediaTrackConstraintSet] }).catch(() => {});
      }
      setZustand("laeuft");
    } catch (e) {
      const name = (e as DOMException).name;
      setZustand(name === "NotAllowedError" || name === "SecurityError" ? "verweigert" : "fehler");
    }
  }, []);

  // Start, und Kamera abschalten wenn die Seite unsichtbar wird (spart Akku)
  useEffect(() => {
    void starten();
    const sicht = () => {
      if (document.hidden) {
        stoppen();
        setZustand((z) => (z === "laeuft" ? "pause" : z));
      }
    };
    document.addEventListener("visibilitychange", sicht);
    return () => {
      document.removeEventListener("visibilitychange", sicht);
      stoppen();
    };
  }, [starten, stoppen]);

  // Erkennungsschleife
  useEffect(() => {
    if (zustand !== "laeuft") return;
    let aus = false;
    let timer: ReturnType<typeof setTimeout>;
    const schritt = async () => {
      const video = videoRef.current;
      if (aus || !video) return;
      if (video.readyState >= 2 && video.videoWidth > 0) {
        try {
          const funde = await erkennen(video);
          if (!aus && funde.length) verarbeiten(funde);
        } catch {
          /* einzelnes Bild nicht lesbar – weiter */
        }
      }
      if (!aus) timer = setTimeout(schritt, TAKT_MS);
    };
    void schritt();
    return () => {
      aus = true;
      clearTimeout(timer);
    };
  }, [zustand]);

  function verarbeiten(funde: Fund[]) {
    zeichnen(funde);
    const nun = Date.now();
    const neu: string[] = [];
    for (const f of funde) {
      if (nun - (zuletzt.current.get(f.code) ?? 0) > WIEDERHOLSPERRE_MS) neu.push(f.code);
      zuletzt.current.set(f.code, nun);
    }
    if (neu.length) {
      setBlitz((b) => b + 1);
      rueckruf.current(neu);
    }
  }

  // Erkannte Codes kurz grün umranden
  function zeichnen(funde: Fund[]) {
    const video = videoRef.current;
    const lw = leinwandRef.current;
    if (!video || !lw) return;
    const breite = lw.clientWidth;
    const hoehe = lw.clientHeight;
    lw.width = breite * devicePixelRatio;
    lw.height = hoehe * devicePixelRatio;
    const ctx = lw.getContext("2d")!;
    ctx.scale(devicePixelRatio, devicePixelRatio);
    // object-cover: Bild wird skaliert und mittig beschnitten
    const s = Math.max(breite / video.videoWidth, hoehe / video.videoHeight);
    const dx = (breite - video.videoWidth * s) / 2;
    const dy = (hoehe - video.videoHeight * s) / 2;
    ctx.lineWidth = 4;
    ctx.lineJoin = "round";
    ctx.strokeStyle = "oklch(0.78 0.17 155)";
    ctx.fillStyle = "oklch(0.78 0.17 155 / 0.22)";
    for (const f of funde) {
      ctx.beginPath();
      f.ecken.forEach((p, i) => (i ? ctx.lineTo(p.x * s + dx, p.y * s + dy) : ctx.moveTo(p.x * s + dx, p.y * s + dy)));
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    setTimeout(() => ctx.clearRect(0, 0, breite, hoehe), 450);
  }

  async function lichtUmschalten() {
    const spur = streamRef.current?.getVideoTracks()[0];
    if (!spur || licht === null) return;
    try {
      await spur.applyConstraints({ advanced: [{ torch: !licht } as MediaTrackConstraintSet] });
      setLicht(!licht);
    } catch {
      setLicht(null);
    }
  }

  function pauseUmschalten() {
    if (zustand === "laeuft") {
      stoppen();
      setZustand("pause");
    } else {
      void starten();
    }
  }

  async function foto(datei: File | undefined) {
    if (!datei) return;
    setFotoLaeuft(true);
    try {
      const codes = await fotoErkennen(datei);
      rueckruf.current(codes);
      if (codes.length) setBlitz((b) => b + 1);
    } finally {
      setFotoLaeuft(false);
    }
  }

  return (
    <div className="relative h-[min(40dvh,420px)] min-h-[240px] overflow-hidden rounded-[28px] bg-[#0b0c10] text-white shadow-hoch">
      <video
        ref={videoRef}
        muted
        playsInline
        autoPlay
        aria-label="Kamerabild"
        className={kl("absolute inset-0 size-full object-cover transition-opacity", zustand === "laeuft" ? "opacity-100" : "opacity-0")}
      />
      <canvas ref={leinwandRef} className="pointer-events-none absolute inset-0 size-full" aria-hidden />

      {/* Sucher */}
      {zustand === "laeuft" && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-8">
          <div
            key={blitz}
            className={kl(
              "relative h-[58%] w-[86%] max-w-md rounded-3xl shadow-[0_0_0_9999px_rgb(0_0_0/0.38)]",
              blitz > 0 && "anim-treffer",
            )}
          >
            {["left-0 top-0 border-l-4 border-t-4 rounded-tl-3xl", "right-0 top-0 border-r-4 border-t-4 rounded-tr-3xl", "left-0 bottom-0 border-l-4 border-b-4 rounded-bl-3xl", "right-0 bottom-0 border-r-4 border-b-4 rounded-br-3xl"].map((k) => (
              <span key={k} className={kl("absolute size-9 border-white", k)} />
            ))}
            <span className="anim-scan absolute inset-x-5 top-0 h-0.5 rounded-full bg-gradient-to-r from-transparent via-[oklch(0.78_0.17_155)] to-transparent shadow-[0_0_14px_oklch(0.78_0.17_155)]" />
          </div>
        </div>
      )}

      {/* Zustände ohne Bild */}
      {zustand !== "laeuft" && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
          {zustand === "startet" && (
            <>
              <Kreisel className="text-white" />
              <p className="text-[15px] text-white/80">Kamera wird gestartet …</p>
            </>
          )}
          {zustand === "pause" && (
            <button onClick={() => void starten()} className="flex flex-col items-center gap-3 rounded-3xl p-4 active:scale-95">
              <span className="flex size-16 items-center justify-center rounded-full bg-white/15 backdrop-blur">
                <Camera className="size-8" />
              </span>
              <span className="text-[15px] font-semibold">Antippen zum Scannen</span>
            </button>
          )}
          {(zustand === "verweigert" || zustand === "fehler") && (
            <>
              <span className="flex size-16 items-center justify-center rounded-full bg-white/10">
                <CameraOff className="size-8" />
              </span>
              <p className="max-w-xs text-[15px] text-white/85">
                {zustand === "verweigert"
                  ? "Kein Zugriff auf die Kamera. Bitte in den Browser-Einstellungen die Kamera für diese Seite erlauben."
                  : "Kamera nicht verfügbar. Codes können unten eingetippt oder mit einem Handscanner gelesen werden."}
              </p>
              <button
                onClick={() => void starten()}
                className="h-12 rounded-xl bg-white px-5 text-[15px] font-semibold text-black active:scale-95"
              >
                Erneut versuchen
              </button>
            </>
          )}
        </div>
      )}

      {/* Bedienleiste */}
      <div className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-black/60 to-transparent p-3 pt-10">
        <p className="min-w-0 flex-1 truncate px-2 pb-3 text-sm font-medium text-white/90">
          {zustand === "laeuft" ? (hinweis ?? "Code in den Rahmen halten") : ""}
        </p>
        <label
          className="flex size-12 cursor-pointer items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition active:scale-95"
          title="Foto auswerten (mehrere Codes auf einmal)"
        >
          <span className="sr-only">Foto auswerten</span>
          {fotoLaeuft ? <Kreisel klein /> : <ImageUp className="size-5" />}
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="sr-only"
            onChange={(e) => {
              void foto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </label>
        {licht !== null && zustand === "laeuft" && (
          <button
            onClick={() => void lichtUmschalten()}
            aria-label={licht ? "Licht aus" : "Licht an"}
            aria-pressed={licht}
            className={kl(
              "flex size-12 items-center justify-center rounded-full backdrop-blur-md transition active:scale-95",
              licht ? "bg-white text-black" : "bg-white/15",
            )}
          >
            {licht ? <FlashlightOff className="size-5" /> : <Flashlight className="size-5" />}
          </button>
        )}
        {(zustand === "laeuft" || zustand === "pause") && (
          <button
            onClick={pauseUmschalten}
            aria-label={zustand === "laeuft" ? "Kamera anhalten" : "Kamera starten"}
            className="flex size-12 items-center justify-center rounded-full bg-white/15 backdrop-blur-md transition active:scale-95"
          >
            {zustand === "laeuft" ? <Pause className="size-5" /> : <Play className="size-5" />}
          </button>
        )}
      </div>
    </div>
  );
}
