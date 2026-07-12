# ADR-002: Guest-first use with optional accounts

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

The prototype succeeds partly because students can begin tracking without registration. Mandatory accounts would add friction and collect personal data before it is needed, while some users will later need synchronisation across devices.

## Decision

Guest mode remains a first-class path. Guest tracking data stays on the device. Optional accounts may be introduced later for explicit cloud synchronisation. Migration from guest storage to an account requires an informed confirmation, a preview of the data, conflict handling, and a reversible failure path; it must never happen silently.

## Consequences

- Public discovery and local tracking remain available without identity collection.
- Cloud features must distinguish local guest ownership from account ownership.
- Export, deletion, schema migration, and merge behavior must work for both modes.
- Some cross-device capabilities are unavailable until a user opts into an account.

## Alternatives considered

- **Mandatory account before use:** rejected because it conflicts with the guest-mode constraint and data minimisation.
- **Anonymous cloud account created automatically:** rejected because it obscures consent and ownership.
- **Permanent local-only product:** rejected because optional synchronisation is a planned later capability.

