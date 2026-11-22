#!/usr/bin/env python3
"""Write one Claude Code agent file per team member, from team.json, into .claude/agents/.

Run from anywhere:  python3 AI-Office/make_agents.py
Claude Code started inside AI-Office/ finds these agents automatically (type /agents to list them).
"""
import json
import pathlib

HERE = pathlib.Path(__file__).resolve().parent
team = json.loads((HERE / "team.json").read_text(encoding="utf-8"))
out = HERE / ".claude" / "agents"
out.mkdir(parents=True, exist_ok=True)
for old in out.glob("*.md"):
    old.unlink()

by_id = {a["id"]: a for a in team["agents"]}
owner = {a["id"]: a for a in team["agents"]}[team["owner"]]
depts = {d["id"]: d for d in team["departments"]}


def boss(aid):
    if not aid:
        return "the Board [A]"
    b = by_id[aid]
    return f'{b["name"]} ({b["role"]})'


def meetings_for(aid):
    rows = []
    for m in team["meetings"]:
        att = m["attendees"]
        if att == "all" or aid in att or "*rotate3" in att:
            who = "everyone" if att == "all" else ("Hisham + three team members in turn" if "*rotate3" in att else ", ".join(by_id[x]["name"] for x in att))
            chair = by_id[m["chair"]]["name"] if m.get("chair") else "-"
            mine = " **You chair it.**" if m.get("chair") == aid else ""
            rows.append(f'- **{m["name"]}** (chair: {chair}): {m["days"]} {m["start"]}–{m["end"]}, {who}. Agenda: {m["agenda"]}.{mine}')
    return "\n".join(rows)


for a in team["agents"]:
    slug = f'{a["id"]}-' + a["role"].lower().replace("&", "and").replace(" ", "-").replace("--", "-")
    slug = "".join(c for c in slug if c.isalnum() or c == "-")
    team_list = ", ".join(f'{x["name"]} ({x["role"]})' for x in team["agents"] if x["id"] != a["id"])
    assumed = "\n> [A] Starter job description, not yet confirmed by Ahmed.\n" if a.get("assumed") else ""
    body = f"""---
name: {slug}
description: {a["name"]}, {a["role"]} at {team["company"]}. {a["summary"]} Use for: {"; ".join(d[0].lower() + d[1:] for d in a["duties"][:3])}.
tools: Read, Write, Edit, Grep, Glob, WebSearch, WebFetch
---

You are **{a["name"]}** ({a["name_ar"]}), **{a["role"]}** ({a["role_ar"]}) in the AI office of {team["company"]}.
{assumed}
## Your job
{a["summary"]}

## Duties
{chr(10).join("- " + d for d in a["duties"])}

## What you deliver
{a["delivers"]}

## Your daily routine
{chr(10).join(f"{i+1}. {x}" for i, x in enumerate(a.get("routine", [])))}

## Your inputs
Files Ahmed sends you land in `AI-Office/inbox/{a["id"]}/`. You need:
{chr(10).join("- " + x for x in a.get("inputs", []))}
If an input is missing, say exactly which file you need. Never invent numbers.

## Filing your work
Write each report to `AI-Office/work/{a["id"]}/<YYYY-MM-DD>-<topic>.md`, starting with this header:

```
---
agent: {a["id"]}
date: <YYYY-MM-DD>
title: <short title>
title_ar: <the title in Arabic>
status: done | waiting | blocked
summary: <one line>
summary_ar: <the line in Arabic>
---
```

## Your place in the team
- Department: {depts[a["dept"]]["name"]}
- You report to: {boss(a["reports_to"])}
- This AI office is run by {owner["name"]} ({owner["role"]}). Anything that spends money, changes a process on the shop
  floor, or goes to a customer or an employee is a **draft for human approval**, never sent by you.
- Colleagues: {team_list}

## Meetings
{meetings_for(a["id"])}

## How you work
- Working days {team["workweek"]}, {team["hours"]["start"]}–{team["hours"]["end"]} (Oman time).
- Write in clear English; write in Arabic when the reader writes in Arabic.
- Keep machine tags, part numbers, units and numbers exactly as in the source documents.
- Mark anything you assumed with [A] and say what you would need to confirm it.
- End every report with: done today, planned tomorrow, blockers.

## Tools (Phase 2, not connected yet)
{chr(10).join("- " + t for t in a["tools_phase2"])}
"""
    (out / f"{slug}.md").write_text(body, encoding="utf-8")
    print(out / f"{slug}.md")
