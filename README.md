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

## The Spotify integration

The part of this project with the most moving pieces, so worth spelling out.

Authorisation is **OAuth 2.0 with PKCE** — the flow meant for apps that run entirely in the browser and therefore cannot keep a client secret. `utils/spotify.ts` generates a random verifier, hashes it with SHA-256 via the Web Crypto API, and sends the challenge to Spotify. The verifier stays in `localStorage` until the redirect comes back, and is exchanged for a token. No secret is stored anywhere, because there isn't one.

`hooks/useSpotify.ts` then talks to four endpoints:

| Call | Endpoint |
|---|---|
| Authorise | `GET accounts.spotify.com/authorize` |
| Exchange code for token | `POST accounts.spotify.com/api/token` |
| Find the track | `GET api.spotify.com/v1/search?q=track:…artist:…` |
| Start playback | `PUT api.spotify.com/v1/me/player/play` |

Tokens are refreshed a minute before expiry rather than after a failure, and the playback response codes are handled individually, since each means something different to the host mid-party: `404` is no active Spotify device, `403` is a free account that cannot be told what to play, `401` is an expired connection that drops the session and asks for a reconnect.

**Why you probably cannot try this part.** Spotify apps start in development mode, which admits only accounts the developer has added by email in the dashboard — 25 at most. Lifting that requires Spotify to approve an extended quota, which they reserve for commercial apps. So playback works for allow-listed accounts with Premium; everyone else gets the game with the host playing the songs, which is how it ran at the party it was built for.

## Run it locally

```bash
cd web-react
npm install
npm run dev
```

Opens on `http://127.0.0.1:5173/Jeoparty/`.

```bash
npm test         # 49 unit tests (Vitest)
npm run typecheck
npm run lint
npm run build
```

## Repository layout

| Path | What it is |
|---|---|
| `web-react/` | The current app — React + TypeScript. This is what the live demo runs. |
| `web/` | The original vanilla JS version, kept for reference. Superseded. |

## Where the rules live

The board, the modal and the pack editor are rendered by `web-react/src/App.tsx`. The rules of a round are not: scoring, turn order, spent tiles and the double-jeopardy draw all sit in `hooks/useGameState.ts` and `utils/gameLogic.ts`, which is what the unit tests exercise.

---

MIT
