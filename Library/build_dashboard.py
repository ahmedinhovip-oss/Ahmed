"""Writes dashboard.html next to the Library folder from Library/index.json and each package's manifest.json.

    python3 Library/build_dashboard.py            (run from the folder that holds Library/)
    python3 Library/build_dashboard.py --single   one self-contained dashboard.html: every simulator, video,
                                                  poster and manual embedded, nothing else needed beside it

The catalogue is embedded in the page, so dashboard.html works opened straight from disk or OneDrive (file://),
where a browser would refuse to fetch index.json. Run it again whenever a package is added or changed.
"""

import base64
import json
import os
import sys
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LIB = os.path.basename(HERE)


def url(*parts):
    return "/".join(quote(p) for p in "/".join(parts).split("/"))


MIME = {".html": "text/html", ".mp4": "video/mp4", ".jpg": "image/jpeg", ".png": "image/png", ".pdf": "application/pdf",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}


def main():
    single = "--single" in sys.argv
    assets = []

    def ref(folder, base, rel):
        """A link to a package file: a relative path, or in --single mode an id of the file embedded in the page."""
        if not single:
            return url(base, rel)
        path = os.path.join(folder, rel)
        aid = f"a{len(assets)}"
        mime = MIME.get(os.path.splitext(rel)[1].lower(), "application/octet-stream")
        assets.append((aid, mime, base64.b64encode(open(path, "rb").read()).decode()))
        return "asset:" + aid

    index = json.load(open(os.path.join(HERE, "index.json"), encoding="utf-8"))
    areas = []
    for a in index["areas"]:
        pkgs = []
        for pid in a["packages"]:
            folder = os.path.join(HERE, a["folder"], pid)
            m = json.load(open(os.path.join(folder, "manifest.json"), encoding="utf-8"))
            f = m["files"]
            base = f"{LIB}/{a['folder']}/{pid}"

            def size(rel):
                p = os.path.join(folder, rel)
                return os.path.getsize(p) if os.path.exists(p) else 0

            pkgs.append({
                "id": pid,
                "title": m["title"],
                "equipment": m.get("equipment", ""),
                "summary": m.get("summary", ""),
                "updated": m.get("updated", ""),
                "sim": ref(folder, base, f["simulator"]) if f.get("simulator") else None,
                "simName": os.path.basename(f.get("simulator", "")),
                "simLabel": m.get("simulator_label", ""),
                "simSize": size(f.get("simulator", "")),
                "video": ref(folder, base, f["video"]) if f.get("video") else None,
                "videoName": os.path.basename(f.get("video", "")),
                "videoSize": size(f.get("video", "")),
                "poster": ref(folder, base, f["poster"]) if f.get("poster") else None,
                "docs": [{"label": d["label"], "name": os.path.basename(d["file"]), "href": ref(folder, base, d["file"]), "size": size(d["file"])} for d in f.get("sources", [])],
                "folder": url(base),
            })
        areas.append({"id": a["id"], "name": a["name"], "folder": a["folder"], "packages": pkgs})
    # the AI Office (../AI-Office) shows as a banner above the plant areas
    office = None
    odir = os.path.join(ROOT, "AI-Office")
    if os.path.exists(os.path.join(odir, "team.json")) and os.path.exists(os.path.join(odir, "AI-Office.html")):
        team = json.load(open(os.path.join(odir, "team.json"), encoding="utf-8"))
        office = {
            "href": ref(odir, "AI-Office", "AI-Office.html"),
            "size": os.path.getsize(os.path.join(odir, "AI-Office.html")),
            "people": [{"name": a["name"], "role": a["role"], "dept": a["dept"]} for a in team["agents"]],
            "colors": {d["id"]: d["color"] for d in team["departments"]},
            "meetings": [{"name": m["name"], "start": m["start"]} for m in team["meetings"]],
        }
    data = json.dumps({"title": index["title"], "single": single, "areas": areas, "office": office}, ensure_ascii=False).replace("</", "<\\/")
    tpl = open(os.path.join(HERE, "dashboard.template.html"), encoding="utf-8").read()
    blobs = "".join(f'<script type="application/octet-stream" id="{a}" data-mime="{m}">{b}</script>\n' for a, m, b in assets)
    html = tpl.replace("/*__DATA__*/null", data).replace("<!--__ASSETS__-->", blobs)
    out = os.path.join(ROOT, "dashboard-single.html" if single else "dashboard.html")
    open(out, "w", encoding="utf-8").write(html)
    print(f"{os.path.getsize(out) / 1048576:.1f} MB")
    n = sum(len(a["packages"]) for a in areas)
    print(f"wrote {out}: {len(areas)} areas, {n} packages")


if __name__ == "__main__":
    main()
