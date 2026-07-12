# ScholarTrack Platform

ScholarTrack Platform is the production web application for discovering and
tracking verified scholarship and internship opportunities. The product is being
developed as a guest-friendly, free-first web application, with a responsive PWA
and optional account synchronisation planned for later phases.

Checkpoint 0 establishes repository boundaries, a Docker-first development
contract, and a documented audit of the legacy prototype. It does not implement
the scholarship interface or add product features.

## Workspace rules

The parent workspace contains two sibling directories with different roles:

- `../ScholarTrack_Europe` is the legacy static prototype. It is strictly
  read-only. It may be inspected, but nothing in it may be edited, formatted,
  renamed, moved, deleted, generated, installed, or built.
- `scholartrack-platform` is the only directory in which production work,
  dependency installation, generated output, and build activity may occur.

The complete locked constraints are recorded in [PROJECT_RULES.md](PROJECT_RULES.md).

## Application baseline

The production directory contains a minimal npm-based Next.js, React, and
TypeScript scaffold. It exists only to provide a runnable, lintable, and buildable
foundation for Checkpoint 0; no scholarship interface or product feature has been
implemented. Do not create, install, or run the application inside the legacy
directory.

## Docker prerequisites

- Docker Desktop with the WSL 2 backend enabled on Windows.
- Docker Compose v2 (the `docker compose` command, not legacy
  `docker-compose`).
- Port `3000` available on the host.

Confirm Docker is ready from PowerShell:

```powershell
docker version
docker compose version
```

## Start the development environment

From the parent workspace:

```powershell
Set-Location .\scholartrack-platform
docker compose config
docker compose up --build
```

The development site is expected at <http://localhost:3000> after Next.js reports
that it is ready. Keep the terminal open to see server and hot-reload logs.

To start in the background instead:

```powershell
docker compose up --build --detach
docker compose logs --follow web
```

The Compose service is named `web`. It mounts this source directory at `/app`,
while named volumes keep `/app/node_modules` and `/app/.next` managed by Docker.
Polling is enabled for reliable change detection across Windows bind mounts.

## Environment values

The baseline requires no credentials. If future application configuration needs
local values, copy the placeholder template and replace values locally:

```powershell
Copy-Item .env.example .env.local
```

Never put real credentials in `.env.example`, source files, Dockerfiles, or
Compose configuration. Local `.env*` files are ignored by both Git and the Docker
build context, except for the placeholder-only example.

## Lint and build

Docker-first validation commands, run from `scholartrack-platform`, are:

```powershell
docker compose build
docker compose run --rm --no-deps web npm run lint
docker compose run --rm --no-deps web npm run build
```

If Node.js is intentionally installed on the host, the equivalent host commands
are:

```powershell
npm ci
npm run lint
npm run build
```

Compose-model validation can be run without starting the application:

```powershell
docker compose config --quiet
docker compose config --services
docker compose config --volumes
```

## Stop and clean up

Stop containers while retaining dependency and build-cache volumes:

```powershell
docker compose down --remove-orphans
```

Reset containers and project-managed volumes (use after dependency or cache
problems; dependencies will be repopulated on the next build):

```powershell
docker compose down --volumes --remove-orphans
docker compose up --build
```

Remove the project containers, volumes, and locally built image:

```powershell
docker compose down --volumes --remove-orphans --rmi local
```

## Windows troubleshooting

### Source mount is denied or files are missing

Make sure Docker Desktop is running with WSL 2 integration and can access the
drive containing the workspace. Restart Docker Desktop after changing its file
sharing or WSL integration settings. Confirm the resolved mount is the production
folder—not `ScholarTrack_Europe`:

```powershell
docker compose config
docker compose run --rm --no-deps web sh -lc "pwd && ls -la"
```

### Changes do not hot reload

`WATCHPACK_POLLING` and `CHOKIDAR_USEPOLLING` are already enabled in Compose.
After confirming that the source mount resolves to `/app`, recreate the service:

```powershell
docker compose down
docker compose up --build --force-recreate
```

If file events remain slow, use Docker Desktop's WSL 2 backend and keep Docker
Desktop and VS Code up to date. Large antivirus scans of `.next` can also delay
rebuilds; `.next` is kept in a Docker-managed volume for this reason.

### Dependencies are stale after `package.json` changes

Recreate the container-managed dependency volume and rebuild:

```powershell
docker compose down --volumes --remove-orphans
docker compose up --build
```

Do not install host `node_modules` to fix the container. The `/app/node_modules`
named volume deliberately prevents host and Linux container dependencies from
being mixed.

### Port 3000 is already in use

Identify the existing listener or another Compose project, stop it, and retry:

```powershell
Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue
docker compose ps
```

### Environment changes are not visible

Next.js reads environment files at process start. Recreate the service after
editing a local environment file:

```powershell
docker compose up --detach --force-recreate web
docker compose logs --follow web
```

## Checkpoint documentation

- [Baseline audit](docs/checkpoint-0/baseline-audit.md)
- [Feature inventory](docs/checkpoint-0/feature-inventory.md)
- [Dataset inventory](docs/checkpoint-0/dataset-inventory.md)
