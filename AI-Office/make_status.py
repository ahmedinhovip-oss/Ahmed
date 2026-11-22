#!/usr/bin/env python3
"""Collect the agents' real reports from work/<agent>/*.md into status.json, which the 3D office shows.

Each report starts with a header between --- lines:
    agent, date (YYYY-MM-DD), title, title_ar, status (done | waiting | blocked), summary, summary_ar,
    and optionally skill_of_day / skill_of_day_ar (Hisham).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
team = json.loads((HERE / "team.json").read_text(encoding="utf-8"))


def parse(path):
    text = path.read_text(encoding="utf-8")
    head, body = {}, text
    if text.startswith("---"):
        _, h, body = text.split("---", 2)
        for line in h.strip().splitlines():
            if ":" in line:
                k, v = line.split(":", 1)
                head[k.strip()] = v.strip()
    head["file"] = str(path.relative_to(HERE))
    head["body"] = body.strip()
    return head


status = {"agents": {}, "updated": None, "skill_of_day": None, "skill_of_day_ar": None}
for a in team["agents"]:
    reports = [parse(p) for p in sorted((HERE / "work" / a["id"]).glob("*.md"))]
    reports.sort(key=lambda r: (r.get("date", ""), r["file"]), reverse=True)
    status["agents"][a["id"]] = reports[:6]
    for r in reports:
        if not status["updated"] or r.get("date", "") > status["updated"]:
            status["updated"] = r.get("date")
        if r.get("skill_of_day") and not status["skill_of_day"]:
            status["skill_of_day"] = r["skill_of_day"]
            status["skill_of_day_ar"] = r.get("skill_of_day_ar")

(HERE / "status.json").write_text(json.dumps(status, ensure_ascii=False, indent=1), encoding="utf-8")
n = sum(len(v) for v in status["agents"].values())
print(f"status.json: {n} reports, latest {status['updated']}")
