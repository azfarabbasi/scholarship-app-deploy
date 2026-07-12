# ADR-010: Human approval for AI-extracted opportunity data

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

AI may later help turn official source text into candidate deadlines, benefits, eligibility rules, or document requirements. Extraction errors could create authoritative-looking but false public facts.

## Decision

AI output is always a suggestion linked to its source evidence, model/run metadata, and confidence limitations. A qualified human reviewer must compare it with the official source and approve each material fact before it can enter a publishable record. AI may not publish, verify, roll forward, or overwrite opportunity facts autonomously. Sensitive student data must be minimised or excluded from prompts, and usage is quota-controlled.

## Consequences

- Review assignments and audit records must distinguish machine suggestion from human decision.
- AI can reduce drafting effort without becoming an authority.
- Throughput remains bounded by reviewer capacity.
- Model/vendor changes require evaluation, privacy, and cost review.

## Alternatives considered

- **Automatic publication above a confidence threshold:** rejected because model confidence is not official evidence.
- **AI extraction with spot checks:** rejected for material public facts.
- **No AI extraction:** retained as a safe operational fallback if quality, privacy, or cost is unacceptable.
