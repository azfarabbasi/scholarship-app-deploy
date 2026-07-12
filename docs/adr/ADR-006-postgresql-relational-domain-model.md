# ADR-006: PostgreSQL-oriented relational domain model

- **Status:** Accepted for future implementation
- **Date:** 2026-07-12

## Context

Opportunities have many cycles, deadlines, sources, rules, benefits, locations, document requirements, and verification events. Users independently own profiles, saved items, trackers, activities, and metadata. These relationships require constraints, history, and transactional updates.

## Decision

Design the commercial domain so it can map cleanly to PostgreSQL tables with stable identifiers, foreign keys, join tables, explicit lifecycle fields, timestamps, and append-oriented audit records. Public catalogue facts remain separated from private user records. This ADR selects the relational modelling direction only; Checkpoint 0 does not create a database, choose a hosted vendor, connect Supabase, or define deployment credentials.

## Consequences

- Referential integrity and source/history queries can be represented explicitly.
- Many-to-many taxonomies and scope-aware deadlines require deliberate junction models.
- Migrations, row-level access policies, backup, and restore design become later implementation work.
- A provider decision remains reversible while the logical contracts are vendor-neutral.

## Alternatives considered

- **Document database as primary store:** rejected because core relationships and verification history benefit from relational constraints.
- **Flat JSON files in production:** retained only for versioned migration/review artifacts, not concurrent application state.
- **Supabase immediately:** deferred; no external database connection is authorised in Checkpoint 0.

