# Groundy — Frontend

Web application of Groundy (Potatonauts · NASA Space Apps Challenge 2026 · Field Shift).
It consumes the backend in this same repository through **https://api.groundy.site** and is published at **groundy.site**.

- Integration guide: `../backend/docs/GUIA_DESARROLLADORES.md`
- API contract: `../backend/docs/CONTRATO_API.md`
- Product and frontend plans: `docs/00_ANALISIS.md`, `docs/01_PLAN_PRODUCTO.md`, `docs/02_PLAN_FRONTEND.md`

## Run locally

```bash
cd frontend
npm install
npm run dev        # http://localhost:5173
npm run build      # type-check + production build in dist/
```

## Stack

React + Vite + TypeScript · Tailwind CSS v4 · React Router · i18next (EN default, ES) ·
MapLibre GL + Terra Draw + Turf · Dexie (IndexedDB, local-first) · Chart.js · Phosphor Icons.
Fonts: Young Serif (headings) and Quicksand (body), self-hosted.

## Folders

```
frontend/
├── assets-src/     original brand assets from the team (logo, Potatonaut, farmer, hero video)
├── public/brand/   optimized images (WebP/PNG) generated from assets-src
├── public/media/   compressed hero video and poster
├── docs/           analysis and plans
└── src/
    ├── features/   landing, estilo (style guide), and app sections
    ├── i18n/       en.ts · es.ts · useDict()
    └── styles/     design tokens (tokens.css)
```

## Backend updates

This repository (`Tania-M11/Groundy`) contains the team backend from `HACK29C/groundy` in `backend/`.
The workflow `.github/workflows/sync-backend.yml` merges the team's `main` into ours every 30 minutes
(or on demand from the Actions tab). It only reads from the team repository and never writes to it.

To bring the latest backend locally right away:

```bash
git pull               # our main, already synced by the workflow
# or, without waiting for the workflow:
git fetch equipo && git merge equipo/main
```

Remotes: `origin` → github.com/Tania-M11/Groundy (our repo, GitHub Pages deploy) ·
`equipo` → github.com/HACK29C/groundy (read only for us).
