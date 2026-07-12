# ADR-004: Deterministic eligibility before AI explanation

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

Eligibility decisions affect student time and expectations. Generative models can be useful for explanation but can omit conditions, invent rules, or produce inconsistent answers when asked to decide directly from prose.

## Decision

Eligibility matching must first use reviewed, structured rules and deterministic evaluation that can return eligible, ineligible, conditional, or unknown with rule-level reasons. AI may later explain those results in plain language or help staff draft structured suggestions, but it must not silently create rules, override deterministic outcomes, or claim final eligibility. Human approval is required before AI-extracted rules become published facts.

## Consequences

- Eligibility results can be tested, traced, and reproduced.
- Unknown or conflicting inputs fail closed instead of becoming optimistic AI guesses.
- Structured rule modelling and verification are prerequisites for personalised matching.
- AI remains an explanatory assistant rather than an autonomous decision maker.

## Alternatives considered

- **Prompt-only eligibility chatbot:** rejected because outputs would be difficult to reproduce and audit.
- **AI score with no rule trace:** rejected because students could not understand or challenge the result.
- **No AI assistance at all:** retained as a valid fallback, but source-grounded explanation may add value after deterministic foundations exist.

