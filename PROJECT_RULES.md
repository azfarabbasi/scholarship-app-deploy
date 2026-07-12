# ScholarTrack Project Rules

These rules define the protected workspace baseline and apply to every contributor,
automation script, and development tool.

## Workspace boundaries

- `../ScholarTrack_Europe` is the legacy static prototype and is strictly read-only.
  It may be inspected for its interface, behaviour, and scholarship data, but no
  file or directory inside it may be modified, renamed, deleted, formatted, moved,
  or generated.
- All production application work must occur in `scholartrack-platform`.
- Do not direct build output, generated files, dependency installs, caches, or
  formatting tools into `../ScholarTrack_Europe`.

## Locked product constraints

- ScholarTrack is a web application only.
- A responsive Progressive Web App (PWA) is planned.
- Services must be selected using a free-first approach.
- Total first-year operating cost must not exceed USD 100.
- The first-year core version must not accept uploads of sensitive student
  documents.
- The platform must not depend on paid email, SMS, or WhatsApp services.
- Every opportunity fact must cite an official source and include a verification
  status and a last-checked date.
- The platform must not autonomously submit scholarship or internship
  applications.
- Guest mode must remain available.
- Optional accounts will be added later for synchronisation; they must not
  replace guest mode.

Changes that conflict with these constraints require an explicit project decision
before implementation.
