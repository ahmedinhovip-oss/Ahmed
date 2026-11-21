# AI Office — Phase 1

A 3D office where the AI team of Synergies Castings lives a working day: they arrive, work at their desks, walk to
the daily stand-up with Ahmed, take the coffee break, sit in Hisham's skill session, visit each other's desks and go
home. Click anyone to read their job description. English / Arabic switch at the top right.

**Open `AI-Office.html`** in any browser. It is one offline file and needs no internet.

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
Up to 4 departments × 6 desks and 9 seats at the meeting table; extra people stand along the meeting room wall.
Looks: `outfit` is `dishdasha`, `suit`, `hijab` or `coverall`; `cap`, `scarf`, `hardhat`, `skin`, `color` are colours.

## Assumptions [A]

Ahmed has not sent the team list yet. Everything below is a starter set to replace:

- Hisham (Skills & Training Lead) and Saif (HR Manager) are named by Ahmed; their duties are written by us [A].
- Khalid, Maryam, Yousef, Salim, Aisha, Fatma, Nasser and all their duties [A].
- Working week Sun–Thu, 07:30–16:30 [A].
- Meetings: stand-up with Ahmed 08:00, skill session 11:00, production review 13:45, end-of-day report to Ahmed 15:30 [A].
- Breaks: coffee 10:00–10:20, lunch 12:15–13:00 [A].

## Phase 2 (not started)

The agent files already hold each person's job; to make them do real work:

1. Run Claude Code inside this folder: `/agents` lists the team; ask e.g. "Hisham, find three new skills on GitHub".
2. Connect what each needs (`tools_phase2` in `team.json`): Outlook, OneDrive folders, GitHub.
3. Turn each meeting in `team.json` into a scheduled task that writes minutes and reports.
4. Feed the real status of each agent into the office so the characters show what the agents are actually doing.
