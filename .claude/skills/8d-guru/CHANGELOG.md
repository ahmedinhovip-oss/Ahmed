# Changelog

## [0.2.1] - 2026-06-20

### Added

- **IATF 16949 profile** (`profiles/iatf16949/`): Automotive quality overlay with 40+ clause references, CC/SC/HIC management, PPAP linkage, OEM timelines, Safe Launch, supplier 8D flow-down, Red Rabbit mandatory, CSR compliance. Includes 5 prompts, 3 references, 1 walkthrough example.
- **ISO 9001:2015 profile** (`profiles/iso9001/`): General QMS overlay with clause-level enforcement. Includes 5 prompts (risk-thinking, change-control, ncr-control, corrective-action, doc-control), 2 references, 1 walkthrough example. Features 23 Hard Gates, evidence standards, and audit readiness checklist.
- **Quality Methodologies framework** (`docs/methodology/quality-methodologies.md`, 17KB): Default agent thinking framework covering PDCA, CAPA, statistical thinking (sample size/MSA/hypothesis testing), process approach (SIPOC/Turtle), risk-based thinking, Lean 8 wastes, systems thinking, and MSA fundamentals. Active even without profile loading.
- **Temporal pattern detection** (`docs/patterns/temporal-patterns.md`): Six defect-rate time patterns (sudden step, gradual drift, intermittent, bathtub, cyclical, random scatter) with root cause pointers and agent追问 per pattern.
- **Bayesian hypothesis tracking** (`docs/patterns/bayesian-hypothesis.md`): Probability-driven root cause candidate management with update rules and exploration direction decisions based on probability distribution state.
- **TRIZ 8 principles** (`docs/patterns/triz-8-principles.md`): Eight TRIZ principles condensed for quality engineering with factory-floor examples and concrete追问 per principle.
- **OEM deadline awareness**: Time limit capture in INTAKE + per-D time remaining assessment + OEM timeline reference in IATF profile.
- **Quick Reference Card** (`docs/quick-ref.md`, 11KB): Printable desk reference with per-D core追问, banned answers, Excellent benchmarks, TRIZ quick lookup, Truth Chain template, scoring rubric, skip pattern blockers, and profile add-ons.
- **Hard Gates for both profiles**: ISO 9001 (23 blocking rules) and IATF 16949 (25 blocking rules) with 🔴BLOCK/🟡WARN severity levels, evidence standards, and audit readiness checklists.
- **Profile gate aggregation rules** in `docs/gates.md`: Agent merges base gates + profile hard gates with AND logic.

### Changed

- SKILL.md: Added ISO 9001 profile declaration, quality-methodologies loading, profile detection logic, gate reference de-duplication.
- AGENTS.md: Default thinking framework consolidated, now references quality-methodologies.md for full methodology definition.
- constraints.txt: Updated with quality-methodologies reference, ISO 9001 profile, v0.2.1 mechanisms, corrected loading order.
- llms.txt: Updated file count (~90) and feature descriptions.
- README.md: Added ISO 9001 to profile table.
- quick-ref.md: Added Agent default methodologies section + ISO 9001 add-ons section.
- IATF 16949 overlay.md: Added Hard Gates (25 rules), evidence standards, and audit readiness checklist (matching ISO 9001 structure).
- Version numbers synced across all files to v0.2.1.

## [0.2.0] - 2026-06-20

### Added

- **5-state exploration cycle per D**: S1 divergent exploration → S2 first-principles convergence → S3 falsification challenge → S4 answer scoring → S5 integrated delivery. Each D is now a coaching session, not a linear questionnaire.
- **Industry-standard answer scoring**: Insufficient / Basic / Excellent with custom rubrics per question point. Insufficient blocks progress.
- **Falsification challenges**: Every prompt includes S3 counterfactual challenges that actively try to disprove the user's conclusions.
- **First-principles anchors**: Physical mechanism, design assumptions, control loop, human factors, and organizational layer追问 chains at key investigation nodes.
- **Exploration direction matrices**: Each D has 5-12 exploration directions with concrete example questions. Agent tracks covered/uncovered angles and prioritizes gaps.
- **Dual root cause system**: Technical Root Cause (TRC) + Managerial Root Cause (MRC, 4 elements: Management System, Business Processes, Personnel, Organization) + Escape Point — per ASQ/MAHLE/BSH standards.
- **Poka-Yoke hierarchy enforcement**: elimination > detection > mitigation. Every PCA must be classified.
- **Statistical evidence requirements in D6**: Cpk≥1.33, confidence intervals, Red Rabbit testing, plan-vs-actual consistency check.
- **D5 Verification vs D6 Validation** distinction with separate criteria for each.
- **D7 Yokoten + four-document sync** (FMEA/Control Plan/SOP/drawings) requirements.
- **D8 Truth Chain encoding + uncertainty declaration + meta-learning**.
- **Basic/Excellent dual deliverable templates** for every stage.
- **42 prompts rewritten** from ~500B to 2-8KB each with full S1-S5 structure.
- **9 methodology docs rewritten** to 5-10KB each with exploration matrices and first-principles anchors.
- **Industry standards referenced throughout**: ASQ, Ford 8D, IATF 16949, AIAG CQI-20, VDA 8, MAHLE, BSH.

### Changed

- SKILL.md: replaced linear workflow with 5-state cycle model.
- AGENTS.md: added exploration direction matrices, scoring dimensions, decision rules, and first-principles追问 examples per D.
- gates.md: added scoring-based gate rules (Insufficient blocks progress at any D).
- deliverables.md: Basic + Excellent templates for all 9 stages.
- All methodology and prompt files: complete rewrite from v0.1.0 skeleton.

### Removed

- Nothing. All v0.1.0 content was expanded, not deleted.

## [0.1.0] - 2026-06-19

### Added

- Initial release: D0-D8 methodology, 42 question-point prompts, gate checklists, deliverables
- Pure markdown format, zero Python, zero dependencies
- Stateless skill design for agent marketplaces
