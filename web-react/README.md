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

## Architecture — read this before the file tree

The running app is **`src/App.tsx`, a single ~770-line component**. Board rendering, scoring, the question modal, theming and the pack editor all live there. It imports only `packLoader`, `useSpotify`, `useToast`, `Toast` and the shared types.

Everything else under `src/components/`, plus `useGameState`, `useSettings`, `useLocalStorage`, `useCardFlipTransition`, `utils/gameLogic`, `utils/sanitize` and the `plugins/` registry, is an **in-progress extraction of that monolith**. Those modules compile, are type-checked and are covered by the unit tests, but nothing in the running app imports them yet.

Concretely: `main.tsx → App.tsx`, and the component tree imports only each other. Treat it as the target structure, not a description of what executes today.

```
src/
  App.tsx           ← the running game (~770 lines)
  main.tsx
  index.css
  data/
    packLoader.ts   ← in use: auto-loads packs/*.json via import.meta.glob
    packs/          ← in use
  hooks/
    useSpotify.ts   ← in use
    useToast.ts     ← in use
    useGameState.ts          ─┐
    useSettings.ts            │
    useLocalStorage.ts        ├─ extracted, not yet wired in
    useCardFlipTransition.ts  │
    useKeyboardShortcuts.ts  ─┘
  components/
    shared/Toast.tsx  ← in use
    board/ modal/ scoreboard/ settings/ admin/ screens/  ← not yet wired in
  plugins/          ← not yet wired in
  utils/
    spotify.ts      ← in use (PKCE helpers)
    gameLogic.ts    ← not yet wired in
    sanitize.ts     ← not yet wired in
  types/index.ts
```

### Remaining work to finish the refactor

1. Replace the state block in `App.tsx` with `useGameState`
2. Swap the inline board/modal/scoreboard JSX for the extracted components
3. Route pack selection through `plugins/index.ts` instead of the inline branch
4. Drop `canvas-confetti` or use it in place of the CSS `ConfettiLayer` — it is currently an unused dependency

Features that exist in the extracted layer but **not** in the running app: steal mechanic, question timer, game resume from `localStorage`, game log, and the five-theme selector.

---

## Tests

```bash
npm test
```

51 unit tests. Note that most of them cover the extracted layer described above rather than the code path the app currently executes:

| File | Tests | Covers code in use? |
|---|---|---|
| `useGameState` | 18 | No — extracted layer |
| `gameLogic` | 13 | No — extracted layer |
| `sanitize` | 10 | No — extracted layer |
| `useLocalStorage` | 6 | No — extracted layer |
| `useToast` | 5 | Yes |

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

Optional, and only relevant for music packs. **The Spotify button is hidden unless a client ID is configured**, so the public demo runs without it — the host just plays the song themselves.

1. Create an app at [developer.spotify.com/dashboard](https://developer.spotify.com/dashboard)
2. Add redirect URI `http://127.0.0.1:5173` for local use
3. Create `web-react/.env`:

```
VITE_SPOTIFY_CLIENT_ID=your_client_id
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173
```

Requires Spotify Premium and an active device. OAuth 2.0 PKCE — no client secret is stored.

---

## Deployment

Pushes to `main` that touch `web-react/**` trigger `.github/workflows/pages.yml`, which builds and publishes to GitHub Pages at `https://sakh26.github.io/Jeoparty/`. `vite.config.ts` sets `base: '/Jeoparty/'` to match.
