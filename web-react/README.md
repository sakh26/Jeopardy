# Jeoparty — web-react

The React + TypeScript version of the game. This is what [the live demo](https://sakh26.github.io/Jeoparty/) runs.

**Stack:** React 19 · TypeScript (strict) · Vite 7 · Vitest · CSS custom properties

---

## Getting started

```bash
npm install
npm run dev
```

Opens on `http://127.0.0.1:5173/Jeoparty/` — the `base` path is set for GitHub Pages, so it applies in dev too.

### Scripts

```bash
npm run dev          # development server
npm run build        # production build
npm run typecheck    # tsc --noEmit
npm test             # unit tests (Vitest)
npm run test:watch   # watch mode
npm run lint         # ESLint
```

---

## Features in the running app

| Feature | Notes |
|---|---|
| 5×N board | Built from the selected pack; point value per tile row |
| 2–4 teams | Added during play, inline rename, running score |
| Double Jeopardy | Two tiles picked at random per game, 2× points |
| Two-stage reveal | Hint first, then answer — the host controls pacing |
| Pack editor | Create and edit categories/questions in-browser |
| 3 themes | Ink · Burgunder · Warm, applied via CSS custom properties |
| Confetti | Hand-rolled CSS animation layer |
| Toasts | Auto-dismissing queue via `useToast` |
| Spotify playback | Optional — see below |

---

## Architecture

`App.tsx` renders the game — board, question modal, scoreboard, pack editor and theming. It is a large component, and deliberately so: it is all presentation, and none of it is what a test would want to reach.

The rules live outside it, and that is what the unit tests exercise:

```
src/
  App.tsx           the screen: board, modal, editor, themes
  main.tsx
  index.css
  hooks/
    useGameState.ts scores, turn order, spent tiles, the double-jeopardy draw
    useSpotify.ts   OAuth 2.0 PKCE and playback
    useToast.ts     auto-dismissing message queue
  utils/
    gameLogic.ts    pickDoubleIds, tileValue, progress, finish detection
    spotify.ts      PKCE verifier and challenge helpers
  data/
    packLoader.ts   auto-loads packs/*.json via import.meta.glob
    packs/          question packs, one JSON file each
  components/
    shared/Toast.tsx
  types/index.ts
```

`useGameState` holds one round: which team picks, which tiles are spent, what a tile is worth once the double multiplier applies, and where the points go. It takes an injectable `rng`, so a test can pin exactly which tiles are doubles rather than hope.

---

## Tests

```bash
npm test
```

49 unit tests, every one against code the running game executes:

| File | Tests | Covers |
|---|---|---|
| `useGameState` | 27 | Scoring, doubles, turn order, teams, standings, reset |
| `gameLogic` | 17 | Double draw, tile value, progress, finish detection |
| `useToast` | 5 | Auto-dismiss, fake timers |

---

## Adding a question pack

Drop a JSON file in `src/data/packs/`. It is auto-discovered at build time via `import.meta.glob` — no code changes needed.

```json
{
  "id": "my-pack-2025",
  "name": "Office Trivia",
  "topic": "default",
  "version": "1.0",
  "categories": [
    {
      "name": "Geography",
      "questions": [
        { "id": "geo-1", "level": 1, "points": 100, "targetWord": "Oslo", "hint": "Capital of Norway" },
        { "id": "geo-2", "level": 2, "points": 200, "targetWord": "Bergen", "hint": "City of 7 mountains" }
      ]
    }
  ]
}
```

For a music pack set `"topic": "music"` and add `"songTitle"` and `"artist"`.

You can also build packs in the browser with the built-in editor and export the JSON.

---

## Spotify setup

Optional, and only relevant for music packs. **The Spotify button is hidden unless a client ID is configured**, so a build without one runs as a plain quiz — the host plays the song themselves.

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Register both redirect URIs, character for character:
   - `http://127.0.0.1:5173/Jeoparty/` for local development
   - `https://sakh26.github.io/Jeoparty/` for the deployed site
3. For local use, create `web-react/.env`:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id
```

`VITE_SPOTIFY_REDIRECT_URI` is optional — when unset the app derives the URI from the current location, base path included, which is correct in both environments.

For the deployed site the client ID comes from the repository variable `VITE_SPOTIFY_CLIENT_ID`, injected at build time by `pages.yml`. It is a variable rather than a secret because a PKCE client ID is public by design: it ships inside the JavaScript bundle regardless.

### Who can actually connect

Spotify apps begin in **development mode**, where only accounts listed under *User Management* in the dashboard may authorise — a maximum of 25, each added by the email on their Spotify account. Anyone else is refused by Spotify before reaching the app. Removing that cap means applying for extended quota, which Spotify grants to commercial products rather than personal projects.

Playback itself additionally requires **Spotify Premium** and an already-active device; the free tier cannot be told what to play, and returns `403`.

---

## Deployment

Pushes to `main` that touch `web-react/**` trigger `.github/workflows/pages.yml`, which builds and publishes to GitHub Pages at `https://sakh26.github.io/Jeoparty/`. `vite.config.ts` sets `base: '/Jeoparty/'` to match.
