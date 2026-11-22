# Daily run of the AI team

This is what runs every working day (Sun–Thu, 07:40 Muscat) and what to say to Claude Code to run the team by hand:
"Run the AI office for today."

1. Work on branch `claude/ai-agents-job-descriptions-gpxcx1` of this repository. Today's date is the report date.
2. For each agent in `team.json` → `run.order` (Hisham, Ahmed, Ram, Aiman, Saif, then Ali):
   read its agent file in `AI-Office/.claude/agents/`, then do its **daily routine** with what is in
   `AI-Office/inbox/<id>/` (and Microsoft 365 / OneDrive once that connector is connected). Write the report to
   `AI-Office/work/<id>/<date>-<topic>.md` with the header from the agent file. If inputs are missing, write a short
   `status: waiting` report naming the files needed. **Never invent numbers.**
3. Ali writes the stand-up minutes from all of today's reports: round the table, decisions for Ahmed (yes/no
   questions), the action list carried forward from the last minutes.
4. Rules: read-only on mail and files; anything that would leave the team (email, letter, purchase, customer reply)
   is written as a draft in the agent's work folder, never sent. Do not install skills without Ahmed's yes.
5. Rebuild: `AI-Office/build.sh` (status.json, agent files, AI-Office.html), then `python3 Library/build_dashboard.py`.
6. Commit "AI office: daily run <date>" and push to the branch.
