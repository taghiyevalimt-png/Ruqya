"""Writes EVIDENCE_INDEX.md: every evidence file (except screenshots, which are counted per folder) with its size,
SHA-256 and first line (the files start with a line saying what, when and on which commit).
Usage: python tools/evidence_index.py"""
import hashlib, os
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EV = os.path.join(ROOT, "evidence")
rows, pics = [], {}
for d, _, files in os.walk(EV):
    for f in sorted(files):
        p = os.path.join(d, f); rel = os.path.relpath(p, ROOT).replace("\\", "/")
        if f.lower().endswith((".jpg", ".png", ".webp")):
            k = os.path.relpath(d, ROOT).replace("\\", "/"); pics[k] = pics.get(k, 0) + 1; continue
        b = open(("\\\\?\\" + os.path.abspath(p)) if os.name == "nt" else p, "rb").read()   # long Windows paths
        first = ""
        try:
            first = b.decode("utf-8").strip().split("\n")[0][:140].replace("|", "/")
        except Exception:
            first = "(binary)"
        rows.append((rel, len(b), hashlib.sha256(b).hexdigest()[:16], first))
rows.sort()
out = ["# EVIDENCE_INDEX — перечень доказательств", "",
       "Каждый файл доказательств начинается со строки: что проверено, когда (UTC) и на каком коммите. Снимки экранов — по папкам (число файлов). SHA-256 — первые 16 знаков; полные суммы — SHA256SUMS.", "",
       "| Файл | Байт | SHA-256 | Первая строка |", "|---|---|---|---|"]
out += ["| `%s` | %d | %s | %s |" % r for r in rows]
out += ["", "## Снимки экранов", "", "| Папка | Снимков |", "|---|---|"] + ["| `%s` | %d |" % (k, v) for k, v in sorted(pics.items())]
open(os.path.join(ROOT, "EVIDENCE_INDEX.md"), "w", encoding="utf-8", newline="\n").write("\n".join(out) + "\n")
print(len(rows), "files,", sum(pics.values()), "screenshots")
