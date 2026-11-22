# AI Office

A 3D office where the AI team of Synergies Castings lives a working day: they arrive, work at their desks, walk to
the daily stand-up, take the coffee break, sit in Hisham's skill session, visit each other's desks and go
home. Click anyone to read their job description. English / Arabic switch at the top right.

**Open `AI-Office.html`** in any browser (one offline file), or the private link
https://claude.ai/artifact/KvSEzhYshRYv61Bbpn1B3q, refreshed by every daily run.

| Control | What it does |
|---|---|
| Pause · 1× · 4× · 16× | Office clock speed (1× = 15 office-seconds per second; a day takes 36 minutes) |
| Work floor · Top view · Meeting room · Cafeteria · Training corner · Lounge | Camera views (drag to orbit, wheel to zoom) |
| Start a meeting now | Everyone, and Ahmed, walk to the meeting room for 25 minutes |
| Break time / Back to work | Send everyone to the cafeteria / back to their desks |
| Labels | Names → names + what they are doing → off |
| Agenda → Jump here | Move the clock to just before that meeting |
| Click a person or a name | Job description, duties, deliverables, today's meetings, Follow camera |

## Files

| File | Job |
|---|---|
| `team.json` | **The one file to edit**: people, job descriptions (English + Arabic), departments, meetings, breaks, looks |
| `.claude/agents/*.md` | One Claude Code agent per person, written from `team.json` by `make_agents.py` |
| `src/` | The 3D page: `office.js` (rooms, furniture, walking grid), `people.js` (characters and poses), `plan.js` (who is where at what time), `main.js` (screen, buttons, camera), `i18n*.js` (Arabic) |
| `build.sh` | Rebuilds the agent files and `AI-Office.html` |

To change the team: edit `team.json`, then run `./build.sh` (needs `npm install` once in `.claude/skills/teardown`).
Up to 4 departments × 6 desks, 9 chairs plus the head chair at the meeting table; extra people stand along the wall.
The dashboard (`python3 Library/build_dashboard.py`) shows the AI Office as a banner above the plant areas.
Looks: `outfit` is `dishdasha`, `suit`, `hijab` or `coverall`; `cap`, `scarf`, `hardhat`, `skin`, `color` are colours.

## The team

Given by Ahmed: Ali (CEO), Ram (COO), Ahmed (Business Improvement Manager), Saif (HR Manager), Hisham (IT Manager,
and gives people skills: finds Claude skills on GitHub and teaches them), Aiman (Safety Manager).
All six are characters in the office and each has an agent file. Ahmed runs the AI office: "Start a meeting now" puts
him at the head of the table.

## Assumptions [A]

- Duties of Ali, Ram, Ahmed and Aiman; who reports to whom (Ram, Ahmed, Saif, Hisham → Ali; Aiman → Ram) [A].
- Departments: Executive, Business Improvement, People & IT, Health & Safety [A].
- Working week Sun–Thu, 07:30–16:30 [A].
- Meetings: stand-up 08:00 (chair Ali), skill session 11:00 (Hisham), operations & safety review 13:45 (chair Ram),
  end-of-day report to the CEO 15:30 (chair Ali) [A].
- Breaks: coffee 10:00–10:20, lunch 12:15–13:00 [A].

## Phase 2: real work (started 22 Nov 2026)

- Each agent has a **daily routine**, an **inbox** (`inbox/<id>/`, files Ahmed sends) and a **work folder**
  (`work/<id>/`, its dated reports with a header: status done / waiting / blocked, summary in English and Arabic).
- `make_status.py` collects the reports into `status.json`; the office shows them (click a person → Latest work) and
  the dashboard banner shows each agent's status and the latest stand-up minutes.
- `RUN.md` is the daily run: every agent does its routine, Ali writes the minutes, everything is rebuilt and pushed.
  Scheduled every Sun–Thu at 07:40 Muscat (approved 22 Nov); or say "Run the AI office for today" to Claude Code.
- Rules: read-only on mail and files; anything leaving the team is a draft; no numbers invented; no skill installed
  without Ahmed's yes.
- First run (22 Nov): Hisham (skills research) and Ahmed (Equipment Library audit) did real work; Ram, Aiman and Saif
  wait for their files; Ali's minutes list 4 decisions for Ahmed.
- Skills installed 22 Nov: 8D Guru, Excel Hygiene, HR Recruiting (`.claude/skills/INSTALLED.md`).
- Microsoft 365 connector added; the Microsoft sign-in is still to be finished. Until then files come through the chat.
