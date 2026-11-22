# Contributing to 8d-guru

## How to contribute

1. Open an issue to discuss the change before writing code.
2. Fork the repository and create a branch.
3. Make your changes.
4. Run `./test.sh` to verify structural integrity.
5. Submit a pull request.

## What we're looking for

- **Methodology improvements**: better exploration questions, sharper falsification challenges, deeper first-principles追问 chains.
- **Industry practice updates**: new quality standards, audit criteria, or best practices that should be incorporated.
- **Prompt refinements**: clearer language, better examples, stronger anti-pattern guidance.
- **Translation**: high-quality translations of prompts and methodology to other languages.
- **Example cases**: real-world (anonymized) 8D walkthroughs that demonstrate the skill's depth.

## What we're not looking for

- Python code, CLI tools, databases, or web frameworks. This is a pure-markdown skill.
- Features that belong in Layer 2/3 (factory data modeling, IM integration, attachment parsing).

## Design principles

- Keep it stateless. The skill describes what an agent should do; it doesn't execute anything itself.
- All prompts should push beyond surface answers. If a prompt would accept "operator error" as a root cause, it needs to be rewritten.
- Falsification is mandatory. Every major conclusion should be challenged.
- Industry standards should be cited, not invented.
- Chinese-quality-engineering language should sound like what quality engineers actually say, not translated English.

## Pull request checklist

- [ ] `./test.sh` passes
- [ ] No `.py` files, no `pyproject.toml`
- [ ] New/changed prompts follow S1-S5 structure
- [ ] Scoring rubrics have clear Insufficient/Basic/Excellent criteria
- [ ] Counterfactual challenges are specific, not generic
