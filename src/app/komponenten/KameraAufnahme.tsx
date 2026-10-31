import { Camera } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { istIphone, kameraName, kameraWaehlen, type KameraGeraet } from "../lib/kamera";
import { Auswahl, Feld } from "../ui/formular";
import { Knopf } from "../ui/knopf";
import { FehlerHinweis, Kreisel } from "../ui/zustand";

const MERKER = "kamera-geraet";

/**
 * Foto mit einer Kamera des Rechners aufnehmen – mit Auswahl der Kamera. Ein iPhone in der Nähe
 * taucht am Mac als Kamera auf (Kamera-Übergabe von Apple) und wird bevorzugt.
 * Am Handy nicht nötig: Dort öffnet das Datei-Feld mit `capture` direkt die Kamera.
 * Wird innerhalb eines Blatts angezeigt (kein eigenes Blatt, damit Escape und Fokus eindeutig bleiben).
 */
export function KameraAufnahme({ offen, schliessen, beiFoto }: { offen: boolean; schliessen: () => void; beiFoto: (f: File) => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const [geraete, setGeraete] = useState<KameraGeraet[]>([]);
  const [gewaehlt, setGewaehlt] = useState<string | null>(null);
  const [laeuft, setLaeuft] = useState(false);
  const [fehler, setFehler] = useState<string | null>(null);

  const stoppen = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setLaeuft(false);
  }, []);

  const kamerasLesen = useCallback(async (): Promise<KameraGeraet[]> => {
    const alle = await navigator.mediaDevices.enumerateDevices();
    const kameras = alle.filter((d) => d.kind === "videoinput").map((d) => ({ deviceId: d.deviceId, label: d.label }));
    setGeraete(kameras);
    return kameras;
  }, []);

  const starten = useCallback(
    async (deviceId: string | null) => {
      stoppen();
      setFehler(null);
      if (!navigator.mediaDevices?.getUserMedia) {
        setFehler("Dieser Browser kann keine Kamera ansprechen. Bitte „Bild hochladen“ nutzen.");
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { ...(deviceId ? { deviceId: { exact: deviceId } } : {}), width: { ideal: 1920 }, height: { ideal: 1080 } },
        });
        streamRef.current = stream;
        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          await video.play().catch(() => {});
        }
        setLaeuft(true);
        // Namen der Kameras gibt es erst nach der Freigabe – jetzt nachlesen und ggf. aufs iPhone wechseln
        const kameras = await kamerasLesen();
        const aktuell = stream.getVideoTracks()[0]?.getSettings().deviceId ?? null;
        const lieber = kameraWaehlen(kameras, deviceId ?? localStorage.getItem(MERKER));
        setGewaehlt(lieber ?? aktuell);
        if (!deviceId && lieber && lieber !== aktuell) await starten(lieber);
      } catch (e) {
        const name = (e as DOMException).name;
        setFehler(
          name === "NotAllowedError" || name === "SecurityError"
            ? "Kein Zugriff auf die Kamera. Bitte in den Browser-Einstellungen die Kamera für diese Seite erlauben."
            : name === "NotFoundError" || name === "OverconstrainedError"
              ? "Keine Kamera gefunden. Ein iPhone erscheint hier, wenn es in der Nähe liegt und die Kamera-Übergabe eingeschaltet ist."
              : "Kamera nicht verfügbar. Bitte „Bild hochladen“ nutzen.",
        );
      }
    },
    [kamerasLesen, stoppen],
  );

  useEffect(() => {
    if (!offen) return;
    void starten(null);
    // Taucht eine Kamera neu auf (iPhone kommt in die Nähe), Liste auffrischen
    const neu = () => void kamerasLesen();
    navigator.mediaDevices?.addEventListener?.("devicechange", neu);
    return () => {
      navigator.mediaDevices?.removeEventListener?.("devicechange", neu);
      stoppen();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [offen]);

  function wechseln(deviceId: string) {
    setGewaehlt(deviceId);
    localStorage.setItem(MERKER, deviceId);
    void starten(deviceId);
  }

  async function aufnehmen() {
    const video = videoRef.current;
    if (!video || !video.videoWidth) return;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext("2d")!.drawImage(video, 0, 0);
    const blob = await new Promise<Blob | null>((ok) => canvas.toBlob(ok, "image/jpeg", 0.92));
    if (!blob) {
      setFehler("Aufnahme fehlgeschlagen, bitte erneut versuchen");
      return;
    }
    beiFoto(new File([blob], "aufnahme.jpg", { type: "image/jpeg" }));
    schliessen();
  }

  const iphoneDa = geraete.some((g) => istIphone(g.label));

  if (!offen) return null;
  return (
    <div className="space-y-4">
        <h3 className="text-[13px] font-semibold uppercase tracking-wider text-gedaempft">Foto aufnehmen</h3>
        {fehler && <FehlerHinweis text={fehler} nochmal={() => void starten(gewaehlt)} />}
        <div className="relative aspect-[4/3] overflow-hidden rounded-2xl bg-[#0b0c10]">
          <video ref={videoRef} muted playsInline autoPlay aria-label="Kamerabild" className="absolute inset-0 size-full object-contain" />
          {!laeuft && !fehler && (
            <div className="absolute inset-0 flex items-center justify-center">
              <Kreisel className="text-white" />
            </div>
          )}
        </div>
        {geraete.length > 0 && (
          <Feld
            beschriftung="Kamera"
            hinweis={
              iphoneDa
                ? "Das iPhone ist als Kamera verfügbar."
                : "Ein iPhone erscheint hier, wenn es entsperrt in der Nähe liegt und auf dem iPhone unter Einstellungen → Allgemein → AirPlay & Übergabe die Kamera-Übergabe eingeschaltet ist."
            }
          >
            {(p) => (
              <Auswahl {...p} value={gewaehlt ?? ""} onChange={(ev) => wechseln(ev.target.value)}>
                {geraete.map((g, i) => (
                  <option key={g.deviceId || i} value={g.deviceId}>
                    {kameraName(g, i)}
                  </option>
                ))}
              </Auswahl>
            )}
          </Feld>
        )}
        <Knopf art="primaer" groesse="l" breit disabled={!laeuft} symbol={<Camera className="size-5" />} onClick={() => void aufnehmen()}>
          Aufnehmen
        </Knopf>
        <Knopf breit art="leise" onClick={schliessen}>
          Abbrechen
        </Knopf>
    </div>
  );
}
