# Birthday Music Jeopardy (React)

Modern React/Vite version of your classy TV-hosted Jeopardy board.

## Run with npm

```bash
npm install
npm run dev
```

## Run with yarn

```bash
yarn
yarn dev
```

Open the local URL shown in terminal (usually `http://localhost:5173`).

## Available scripts

- `npm run dev` / `yarn dev`: start development server
- `npm run build` / `yarn build`: production build
- `npm run preview` / `yarn preview`: preview production build

## Spotify integration

When a card is clicked, the app can start that song through Spotify API.

1. Create a Spotify app at `https://developer.spotify.com/dashboard`.
2. Add Redirect URI:
   - `http://127.0.0.1:5173` (dev)
3. In `web-react/`, create `.env`:

```bash
VITE_SPOTIFY_CLIENT_ID=your_spotify_client_id
VITE_SPOTIFY_REDIRECT_URI=http://127.0.0.1:5173
```

4. Start app, click `Koble Spotify`, and approve login.
5. Keep Spotify open on an active device (phone/desktop).

Dev server is configured to run on `127.0.0.1:5173` (strict port) for Spotify compliance.

Notes:
- Spotify Web API playback requires a Premium account.
- If no active device is found, start playback manually once in Spotify and try again.
- `localhost` is not accepted for new Spotify apps. Use loopback IP (`127.0.0.1` or `[::1]`).

## Game behavior

- Ingen sangtekst vises pa TV
- To lag med poeng og brukte ruter
- Valgfri stjeling og negativ poengtrekk
- Skjult malord-knapp for vert

## Content

- Edit `src/data/questions.json` for songs/answers/host notes
- Edit `src/data/settings.json` for default team names/rules
# React + Vite

This template provides a minimal setup to get React working in Vite with HMR and some ESLint rules.

Currently, two official plugins are available:

- [@vitejs/plugin-react](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react) uses [Babel](https://babeljs.io/) (or [oxc](https://oxc.rs) when used in [rolldown-vite](https://vite.dev/guide/rolldown)) for Fast Refresh
- [@vitejs/plugin-react-swc](https://github.com/vitejs/vite-plugin-react/blob/main/packages/plugin-react-swc) uses [SWC](https://swc.rs/) for Fast Refresh

## React Compiler

The React Compiler is not enabled on this template because of its impact on dev & build performances. To add it, see [this documentation](https://react.dev/learn/react-compiler/installation).

## Expanding the ESLint configuration

If you are developing a production application, we recommend using TypeScript with type-aware lint rules enabled. Check out the [TS template](https://github.com/vitejs/vite/tree/main/packages/create-vite/template-react-ts) for information on how to integrate TypeScript and [`typescript-eslint`](https://typescript-eslint.io) in your project.
