# AI usage declaration · Groundy (Potatonauts)

NASA Space Apps Challenge 2026 · Field Shift: Adapting Farms with NASA Data

## AI-generated images and video
The following visual assets were generated with AI image/video tools. The tools did not add a visible watermark,
so we declare them here and label them on the site with the note **“AI-generated illustration”**.

| Asset | File | Where it is used |
|---|---|---|
| Potatonaut (potato astronaut mascot) | `frontend/assets-src/Patata astronauta kawaii en 3D.png` → `frontend/public/brand/potatonaut-*.webp` | Assistant avatar, floating button, empty states |
| Farmer character | `frontend/assets-src/Granjero abuelo con rastrillo.png` → `frontend/public/brand/granjero-*.webp` | Landing and onboarding |
| Farm characters (grandmother gardener, farmer with basket, farmer with bucket, farmer with watering can) | `frontend/assets-src/Abuelita jardinera…png`, `Granjera sonriente…png`, `Granjero sonriente con cubeta…png`, `Granjero sonriente con regadera…png` → `frontend/public/brand/avatares/*.webp` (full body and face crops) | Crops, activity types, timeline, empty states |
| Hero video (Potatonaut on a hill) | `frontend/assets-src/hero.mp4` → `frontend/public/media/hero-*.mp4` | Landing hero |

No NASA logos or official NASA graphics were generated or altered with AI.

## AI-assisted software engineering
AI coding assistance (Claude Code, Anthropic) was used to scaffold the web application, write UI components,
and structure documentation. Product decisions, the choice of data sources, the scientific approach and the
validation of results belong to the Potatonauts team.

## Potatonaut (the assistant inside Groundy)
In this version Potatonaut answers with deterministic templates filled only with values returned by the Groundy API.
No language model generates free numbers. No trained model is in use yet; future models are described in
`frontend/docs/01_PLAN_PRODUCTO.md` §4.3.
