import QRCode from "qrcode";
import { useEffect, useState } from "react";

/** QR-Code als SVG (scharf beim Drucken). */
export function QrCode({ wert, className }: { wert: string; className?: string }) {
  const [svg, setSvg] = useState("");
  useEffect(() => {
    let aktiv = true;
    void QRCode.toString(wert, { type: "svg", margin: 0, errorCorrectionLevel: "M", color: { dark: "#000000", light: "#ffffff" } }).then(
      (s) => aktiv && setSvg(s),
    );
    return () => {
      aktiv = false;
    };
  }, [wert]);
  return <div role="img" aria-label={`QR-Code ${wert}`} className={className} dangerouslySetInnerHTML={{ __html: svg }} />;
}
