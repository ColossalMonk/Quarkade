# Quarkade

**Quark** (the smallest building block) + **arcade**. This is the home of every web game in the plan, from one-tap hypercasual games up to the 60+ minute flagship.

## Folders

Each bucket has its own numbered folder. The number matches the bucket in the plan.

| Folder | Bucket | Target | Route |
|---|---|---|---|
| `01-hypercasual/` | Hypercasual | 40–50 | Open route |
| `02-quick/` *(later)* | 2–5 min | 30–40 | Mostly open, Poki for a standout |
| `03-short/` *(later)* | 5–8 min | 20–30 | Mostly open, Poki for a standout |
| `04-session/` *(later)* | 8–12 min | 15–20 | Poki first, then open |
| `05-sitting/` *(later)* | 12–15 min | 10–15 | Poki first, then open |
| `06-evening/` *(later)* | 15–20 min | 8–10 | Poki first, then open |
| `07-deep/` *(later)* | 20–30 min | 5–8 | Poki first, then open |
| `08-saga/` *(later)* | 30–45 min | 3–5 | Steam / stores / own site, plus open |
| `09-epic/` *(later)* | 45–60 min | 1–2 | Steam / stores / own site, plus open |
| `10-flagship/` *(later)* | 60+ min | 1 | Steam / stores / own site only |
| `forge/` | The shared template: platform adapter, ads, saves, i18n, audio, tweens (see `forge/README.md`) | — | — |

Only the folders that are needed now get created.

## Setup

npm workspaces live at this root. List each new game in `package.json` → `workspaces`, then run `npm install` here.

In this environment, `npm run` scripts hang, so call the tools directly with `node`:
- Vite: `node node_modules/vite/bin/vite.js <game>`
- Tool scripts: `node <game>/tools/<script>.ts` (Node 23.6+ runs TypeScript directly)

Code shared with Node tools uses relative imports with `.ts` extensions and erasable TypeScript only: no enums and no constructor parameter properties.

## Routes

- **Open route:** CrazyGames first, then Playgama, GameDistribution, GamePix, GameMonetize and YouTube Playables (directly, or through Playgama).
- **Poki route:** Poki only on the web, because Poki is exclusive there. Ask Poki **before** a game is public anywhere else.

## Asset budget (applies to every game)

| Limit | Value |
|---|---|
| Initial download | ≤ 5 MB |
| Total size | ≤ 50 MB |
| Files | ≤ 500 |
| Saved game data | ≤ 1 MB |

These numbers sit inside the strictest platform's limits, which are YouTube Playables'.

## Game folder naming

`<bucket>/<id>-<slug>/`, for example `01-hypercasual/hc06-outbound/`.
