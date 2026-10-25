"""Zählmodell für die Inventur-Zählhilfe erzeugen (YOLOE-26 → ONNX, ohne Masken-Zweig).

Einmalig von Hand ausführen, wenn das Vokabular oder die Modellgröße geändert werden soll:

    python3 -m venv .venv && . .venv/bin/activate
    pip install ultralytics onnx onnxslim onnxruntime "git+https://github.com/ultralytics/CLIP.git"
    python werkzeuge/zaehlmodell_export.py            # n (Standard, 10,5 MB)
    python werkzeuge/zaehlmodell_export.py --groesse s  # genauer, aber 39 MB → siehe docs/zaehlhilfe.md

Danach die Version in MODELL_URL (src/app/zaehlen/modell.ts) hochzählen, sonst halten Browser die alte Datei.
Nicht quantisieren: int8 verfälscht die Ergebnisse dieses Modells stark (gemessen 2026-10-25).
"""

import argparse
import os

import onnx
from ultralytics import YOLOE

# Was gezählt werden soll. Die Texte werden beim Export einmal in Merkmale umgerechnet und fest
# ins Modell eingebaut – im Browser läuft kein Sprachmodell. Englisch, weil der Text-Encoder so trainiert ist.
# Die Klasse selbst wird in der App nicht angezeigt; sie entscheidet nur, WAS als Gegenstand gilt.
VOKABULAR = [
    "tool", "power tool", "hand tool", "drill", "toolbox", "box", "cardboard box", "plastic crate",
    "case", "bag", "bottle", "spray can", "can", "jar", "bucket", "container", "device",
    "electronic device", "cable", "extension cord", "helmet", "safety glasses", "gloves",
    "measuring tape", "level", "saw", "hammer", "screwdriver", "wrench", "pliers", "machine", "lamp",
    "battery", "charger", "folder", "binder", "book", "laptop", "monitor", "keyboard", "printer", "bin",
]


def main() -> None:
    a = argparse.ArgumentParser()
    a.add_argument("--groesse", choices=["n", "s", "m"], default="n")
    a.add_argument("--version", default="v1")
    a.add_argument("--ziel", default=os.path.join(os.path.dirname(__file__), "..", "public", "modelle"))
    args = a.parse_args()

    modell = YOLOE(f"yoloe-26{args.groesse}-seg.pt")
    modell.set_classes(VOKABULAR, modell.get_text_pe(VOKABULAR))
    # nms=False: End-to-End-Ausgabe [1, 300, 6 + 32] statt Rohausgabe, die NMS im Browser bräuchte
    roh = modell.export(format="onnx", imgsz=640, simplify=True, opset=17, nms=False)

    ziel = os.path.join(args.ziel, f"yoloe-26{args.groesse}-werkstatt-{args.version}.onnx")
    # Nur output0 behalten: die Masken-Prototypen (output1) braucht die Zählhilfe nicht
    onnx.utils.extract_model(roh, ziel, ["images"], ["output0"])
    mb = os.path.getsize(ziel) / 1e6
    print(f"{ziel}: {mb:.1f} MB")
    if mb > 25:
        print("ACHTUNG: über 25 MiB – Cloudflare liefert so große Einzeldateien nicht aus.")


if __name__ == "__main__":
    main()
