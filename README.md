# Jeoparty!

A Jeopardy-style party game for hosting live quiz nights — built for a birthday, then generalised so any topic works: music, trivia, film, company onboarding.

**[▶ Play the live demo](https://sakh26.github.io/Jeoparty/)** — no install, no login, works on a laptop plugged into a TV.

**Stack:** React 19 · TypeScript (strict) · Vite 7 · Vitest · GitHub Actions CI

---

## What it does

- **5×N board** built from a JSON question pack, with per-tile point values
- **2–4 teams**, added and renamed during play, running score per team
- **Double Jeopardy** — two random tiles per game score double
- **Two-stage reveal** — show the hint first, then the answer, so the host controls pacing
- **Built-in pack editor** — write categories and questions in the browser, no JSON editing
- **Three themes** — Ink, Burgunder, Warm
- **Optional Spotify playback** — for music packs, connects via OAuth 2.0 PKCE and auto-plays the track when a tile opens. Entirely optional; without it the host just plays the song.

## Run it locally

```bash
cd web-react
npm install
npm run dev
```

Opens on `http://127.0.0.1:5173/Jeoparty/`.

```bash
npm test         # 51 unit tests (Vitest)
npm run typecheck
npm run lint
npm run build
```

## Repository layout

| Path | What it is |
|---|---|
| `web-react/` | The current app — React + TypeScript. This is what the live demo runs. |
| `web/` | The original vanilla JS version, kept for reference. Superseded. |

## Project status

The game runs out of `web-react/src/App.tsx`, which has grown into a ~770-line component holding the board, scoring, modal and pack editor together.

A refactor is in progress: the extracted layer lives in `src/components/`, `src/hooks/` and `src/utils/`, and is covered by the 51 unit tests, but is **not yet wired into the running app**. Those modules are the target structure, not the current one. See `web-react/README.md` for the detail.

---

MIT
