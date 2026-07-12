# ADR-007: Docker-first local development

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

The project must run consistently across Windows development machines while avoiding host/container dependency conflicts. Future production deployment should be able to build from the same locked application inputs.

## Decision

Use the existing Docker development target and Compose `web` service as the primary local workflow. Source is bind-mounted for hot reload; Linux `node_modules` and `.next` stay in named volumes; dependencies come from the committed npm lockfile; the runtime process is non-root. Lint, validation, and builds must have Docker-compatible commands.

## Consequences

- Contributors need Docker Desktop/Compose but not a matching host Node installation.
- Dependency-volume refresh is required after lockfile changes.
- Windows polling trades some CPU for reliable file watching.
- Production stages can be added later without changing the local source boundary.

## Alternatives considered

- **Host-only Node development:** supported as an optional convenience, not the canonical path.
- **Full virtual machine:** rejected as unnecessarily heavy.
- **Add databases to Compose now:** rejected because Checkpoint 0 does not create the production datastore.

