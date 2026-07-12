# ADR-009: Responsive PWA before native mobile applications

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

Students use varied devices, but separate native applications would duplicate product, accessibility, release, and maintenance work before the core workflow is proven.

## Decision

Deliver ScholarTrack as a responsive web application and progressively add deliberate PWA capabilities before considering native mobile clients. Installation, offline behavior, cache freshness, update prompts, and failure states must be designed explicitly; static-file availability is not sufficient PWA behavior.

## Consequences

- One accessible web codebase serves desktop and mobile in Year 1.
- Browser/platform limitations must be documented and tested.
- Offline caches must not make stale opportunity facts appear verified or current.
- Native applications are deferred beyond Year 1 unless a new decision changes scope.

## Alternatives considered

- **Native iOS and Android first:** rejected for cost and duplicated effort.
- **Thin native wrappers immediately:** rejected because they add release complexity without solving product foundations.
- **Desktop-only web:** rejected because responsive access is a planned core requirement.

