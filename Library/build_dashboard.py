"""Writes dashboard.html next to the Library folder from Library/index.json and each package's manifest.json.

    python3 Library/build_dashboard.py            (run from the folder that holds Library/)

The catalogue is embedded in the page, so dashboard.html works opened straight from disk or OneDrive (file://),
where a browser would refuse to fetch index.json. Run it again whenever a package is added or changed.
"""

import json
import os
from urllib.parse import quote

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
LIB = os.path.basename(HERE)


def url(*parts):
    return "/".join(quote(p) for p in "/".join(parts).split("/"))


def main():
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
                "sim": url(base, f["simulator"]) if f.get("simulator") else None,
                "simSize": size(f.get("simulator", "")),
                "video": url(base, f["video"]) if f.get("video") else None,
                "videoSize": size(f.get("video", "")),
                "poster": url(base, f["poster"]) if f.get("poster") else None,
                "docs": [{"label": d["label"], "name": os.path.basename(d["file"]), "href": url(base, d["file"]), "size": size(d["file"])} for d in f.get("sources", [])],
                "folder": url(base),
            })
        areas.append({"id": a["id"], "name": a["name"], "folder": a["folder"], "packages": pkgs})
    data = json.dumps({"title": index["title"], "areas": areas}, ensure_ascii=False).replace("</", "<\\/")
    tpl = open(os.path.join(HERE, "dashboard.template.html"), encoding="utf-8").read()
    out = os.path.join(ROOT, "dashboard.html")
    open(out, "w", encoding="utf-8").write(tpl.replace("/*__DATA__*/null", data))
    n = sum(len(a["packages"]) for a in areas)
    print(f"wrote {out}: {len(areas)} areas, {n} packages")


if __name__ == "__main__":
    main()
