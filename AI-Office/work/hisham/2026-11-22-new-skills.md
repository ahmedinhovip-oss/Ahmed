---
agent: hisham
date: 2026-11-22
title: New skills for the team (week 1)
title_ar: مهارات جديدة للفريق (الأسبوع 1)
status: done
summary: Searched GitHub, read 5 skill libraries; recommend 8D Guru, Excel Hygiene and HR Recruiting. No safety skill worth using yet.
summary_ar: بحثت في GitHub وقرأت 5 مكتبات مهارات؛ أوصي بـ 8D Guru و Excel Hygiene و HR Recruiting. لا توجد مهارة سلامة مناسبة بعد.
skill_of_day: 8D investigations with 8D Guru
skill_of_day_ar: تحقيقات 8D باستخدام 8D Guru
---

# New skills for the team — week 1

**How I searched:** GitHub repository search (10 queries: manufacturing, lean six sigma, Excel, safety, HR, maintenance,
8D quality, meeting minutes, KPI dashboards, the official Anthropic library). I downloaded the five most relevant
libraries and read each `SKILL.md`, its licence and the files that run code. Nothing was installed.

## Recommended (3)

| Skill | For | Why | Licence | Checked |
|---|---|---|---|---|
| **8D Guru** (`jilanfang/8d-guru`) | Ahmed, Ram | Coaches a full 8D investigation (D0–D8) with root-cause challenges and scoring; has an ISO 9001 and an IATF 16949 add-on. Fits customer complaints on castings. | MIT | Pure markdown (244 lines), no scripts run. Safe. |
| **Excel Hygiene** (`BayramAnnakov/excel-hygiene`) | Ram, Ahmed, Ali | Checks any spreadsheet before it goes out: numbers stored as text, typed-over formulas, `#REF!` errors, cut-short SUM ranges. Useful for the production plan and the KPI sheets. | Apache-2.0 | One Python script (openpyxl) that only reads the file. Safe. |
| **HR Recruiting** (`tuanductran/hr-skills`, `hr-recruiting`) | Saif | Job descriptions, interview questions, CV screening, offer and rejection letters. The same library has onboarding and job-analysis skills. | MIT | Markdown only for the skill itself. Safe. |

## Already available to us (no install needed)

The official Anthropic skills for **Excel (xlsx), Word (docx), PDF and PowerPoint** are already enabled on our account.
Everyone can use them today: Ram for plan vs actual sheets, Saif for letters, Aiman for permit forms (PDF).

## Looked at, not recommended

- **Quality engineering skills** (`Siddardth7/quality-engineering-skills`: FMEA, SPC, MSA, 5-Why, fishbone, PPAP): good
  content, but every skill needs a separate "quality-mcp" server to do its calculations, and the repository has no
  licence. Use as reading material only.
- **Safety:** every "safety incident" skill found is about software incidents, not plant safety. **Gap:** I propose
  to write our own plant-safety skill for Aiman (incident log → 5-Why → corrective action → overdue list) once Aiman's
  first incident log arrives.
- **Meeting minutes:** the ones found transcribe Chinese audio; we do not need them, Ali writes minutes from our reports.

## Decision needed (Ahmed)

Install the three recommended skills into this project? **Yes / No.** Installing means copying their folders into
`.claude/skills/`; nothing runs until someone uses them.

## Skill of the day (11:00)

**8D investigations with 8D Guru**: walk through one real casting complaint from D0 to D8.

## IT status

No IT data received yet. Send the asset list (PCs, licences) and any open IT issues to `inbox/hisham/`.

**Done today:** skill search and review. **Planned tomorrow:** install approved skills; draft the plant-safety skill outline.
**Blockers:** approval to install; no IT data yet.
