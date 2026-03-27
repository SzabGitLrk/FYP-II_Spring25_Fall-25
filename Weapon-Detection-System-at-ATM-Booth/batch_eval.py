import os, base64, json, time, sys
import requests
from pathlib import Path

# Dataset root provided by user
DATASET_ROOT = r"C:\Users\Public\ATM Crime Detection.v5i.yolov8"
API = "http://localhost:5000/detect"

# Folders to scan inside YOLOv8 dataset structure
SUBS = [
    "train/images",
    "val/images",
    "test/images",
]

# Image extensions to include
EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}

def find_images(root: str):
    files = []
    for sub in SUBS:
        p = Path(root, sub)
        if p.exists():
            for f in p.rglob("*"):
                if f.suffix.lower() in EXTS:
                    files.append(str(f))
    return files


def b64_from_path(p: str) -> str:
    with open(p, "rb") as fh:
        return base64.b64encode(fh.read()).decode("ascii")


def main():
    files = find_images(DATASET_ROOT)
    print(f"Found {len(files)} images under {DATASET_ROOT}")
    if not files:
        print("No images found. Check dataset path and subfolders: train/ val/ test/ images/")
        sys.exit(1)

    hits = 0
    miss = 0
    failed = 0

    # Optional: write a CSV report
    out_csv = Path("batch_eval_report.csv")
    with out_csv.open("w", encoding="utf-8") as csv:
        csv.write("file,ok,conf_list\n")

    for i, fp in enumerate(files, 1):
        try:
            b64 = b64_from_path(fp)
            r = requests.post(API, json={"image": b64}, timeout=30)
            if r.status_code != 200:
                failed += 1
                print(f"[{i}/{len(files)}] {fp} -> HTTP {r.status_code}")
                continue
            data = r.json()
            dets = data.get("detections", [])
            if dets:
                hits += 1
                confs = [f"{(d.get('score',[0])[0])*100:.1f}%" for d in dets]
                ok = 1
            else:
                miss += 1
                confs = []
                ok = 0

            with out_csv.open("a", encoding="utf-8") as csv:
                csv.write(f"{fp},{ok},\"{';'.join(confs)}\"\n")

            if i % 25 == 0:
                print(f"... {i} done | hits={hits} miss={miss} failed={failed}")
            time.sleep(0.03)  # be gentle with the server
        except Exception as e:
            failed += 1
            print(f"[{i}/{len(files)}] {fp} -> ERROR {e}")

    total = hits + miss + failed
    acc = (hits / total * 100) if total else 0
    print("\n=== SUMMARY ===")
    print(f"Total: {total}")
    print(f"Hits : {hits}")
    print(f"Miss : {miss}")
    print(f"Fail : {failed}")
    print(f"Hit-rate: {acc:.2f}%")
    print(f"Report: {out_csv.resolve()}")


if __name__ == "__main__":
    main()
