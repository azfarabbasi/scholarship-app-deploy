# ADR-005: Official-source verification before publication

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

The migrated catalogue is guide-derived, all records are `not-reverified`, and deadline precision does not establish truth. Publishing stale or inferred opportunity facts could cause students to miss applications.

## Decision

Every public opportunity fact must be supported by an official, scope-appropriate source, a verification status, and a last-checked timestamp. Estimated, conflicting, stale, or historical data remains visibly qualified. Publication requires human review; annual dates are never rolled forward automatically. Source evidence and verification history are retained rather than overwritten.

## Consequences

- The 55 migrated records remain review inputs, not approved production records.
- Editorial workflows, source evidence, and audit history are core domain requirements.
- Verification creates ongoing operational work and freshness queues.
- Users can distinguish official facts from estimates and personal reminders.

## Alternatives considered

- **Publish the seed with a general disclaimer:** rejected because a disclaimer does not cure false precision.
- **Crowdsource facts without staff review:** rejected for publication; correction reports may inform a reviewed workflow.
- **Automatically infer the next annual cycle:** rejected by the deadline-intelligence policy.

