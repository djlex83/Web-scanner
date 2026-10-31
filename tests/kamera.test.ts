import { describe, expect, it } from "vitest";
import { istIphone, kameraName, kameraWaehlen } from "../src/app/lib/kamera";

describe("Kamera am Rechner: Auswahl", () => {
  const geraete = [
    { deviceId: "a", label: "FaceTime HD-Kamera" },
    { deviceId: "b", label: "iPhone von Anna Kamera" },
    { deviceId: "c", label: "USB-Webcam" },
  ];

  it("nimmt das iPhone, wenn eines da ist", () => {
    expect(kameraWaehlen(geraete, null)).toBe("b");
    expect(istIphone("iPad (5) Camera")).toBe(true);
    expect(istIphone("FaceTime HD")).toBe(false);
  });

  it("nimmt die gemerkte Kamera vor dem iPhone, aber nur wenn sie noch da ist", () => {
    expect(kameraWaehlen(geraete, "c")).toBe("c");
    expect(kameraWaehlen(geraete, "weg")).toBe("b");
  });

  it("sonst die erste; ohne Kameras null", () => {
    expect(kameraWaehlen([geraete[0]!, geraete[2]!], null)).toBe("a");
    expect(kameraWaehlen([], "a")).toBeNull();
  });

  it("benennt Kameras ohne Namen", () => {
    expect(kameraName({ deviceId: "x", label: "" }, 1)).toBe("Kamera 2");
    expect(kameraName({ deviceId: "x", label: " USB " }, 0)).toBe("USB");
  });
});
