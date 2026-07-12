# ADR-001: Read-only prototype and separate production codebase

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

`ScholarTrack_Europe` is a static prototype containing useful behavior and the original 55-record dataset, but it has no production data governance, types, tests, or safe persistence boundary. Mixing new work into it would destroy the reference baseline and make migration evidence harder to audit.

## Decision

Treat `ScholarTrack_Europe` as strictly read-only. All production source, documentation, generated output, dependencies, and tooling belong in `scholartrack-platform`. Prototype facts may be inspected and migrated through versioned, validated artifacts, but the prototype itself is never formatted, built into, or used as the production runtime.

## Consequences

- The original behavior and hashes remain available as evidence.
- Production work has an explicit security, quality, and deployment boundary.
- Useful prototype behavior must be reimplemented deliberately rather than copied blindly.
- Contributors must take care that scripts and editor tools never emit files into the sibling prototype.

## Alternatives considered

- **Upgrade the static prototype in place:** rejected because it would erase the protected reference boundary.
- **Copy all prototype files into the production runtime:** rejected because it would preserve unsafe architecture and unverified data assumptions.
- **Delete the prototype after migration:** rejected because it remains valuable audit evidence.

