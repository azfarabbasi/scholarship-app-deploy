# ADR-003: No sensitive student file storage in Year 1

- **Status:** Accepted
- **Date:** 2026-07-12

## Context

Passports, transcripts, certificates, bank statements, and similar files create high-impact confidentiality, breach, retention, and access-control obligations. The core planning value can be delivered by tracking readiness without receiving those files.

## Decision

The Year 1 platform must not upload, receive, proxy, persist, preview, extract, or back up sensitive student document files. It may store only the approved planning metadata: a document template or type, readiness status, optional expiry date, version label, requirement relationship, timestamps, and a minimal reviewed display label. Free-form document notes, issue or issuer details, file-existence hints, file bytes, storage paths, download URLs, and extracted document content are outside this metadata record.

## Consequences

- The first-year breach surface and infrastructure cost remain smaller.
- Checklists and reusable-document records are metadata-only.
- Users retain their files outside ScholarTrack and must submit them through official application channels.
- Any later file-storage proposal requires a new privacy/security review and ADR.

## Alternatives considered

- **Encrypted object storage in Year 1:** rejected because encryption alone does not resolve access, retention, deletion, support, or breach obligations.
- **Browser-only file cache:** rejected because it can still create confusing retention and exposure behavior.
- **Links to third-party personal drives:** deferred; even links can disclose sensitive metadata and require a separate threat model.
