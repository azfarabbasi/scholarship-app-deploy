# ADR-008: Free-first infrastructure with a USD 100 Year 1 ceiling

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

The first-year product must validate user value before taking on recurring infrastructure costs. Paid messaging and premature managed services could exceed the fixed operating ceiling without improving the core catalogue.

## Decision

Choose free-tier or open-source services first and keep total Year 1 operating cost at or below USD 100. Every checkpoint must document incremental cost, free-tier limits, exit/migration options, and a fallback. The platform must not depend on paid email, SMS, or WhatsApp delivery. Cost exceptions require an explicit decision before implementation.

## Consequences

- Architecture favors static/public caching, bounded jobs, quotas, and usage visibility.
- AI, notifications, monitoring, and advertising integrations require hard limits.
- Free-tier suspension or policy changes are operational risks that need fallback plans.
- Cost review becomes part of the definition of done.

## Alternatives considered

- **Paid managed stack from the outset:** rejected as disproportionate to Checkpoint 0/alpha needs.
- **No hosted services ever:** rejected because later optional sync and operations will need infrastructure.
- **Unbounded usage with later optimisation:** rejected because it conflicts with the ceiling.

