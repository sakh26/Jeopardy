# Birthday Music Jeopardy - Host Guide

This app runs the board and scoring on TV while you control Spotify manually from your phone.

## How to Run

1. Open `web/index.html` in a browser.
2. Optional: use a tiny local server for consistent `fetch()` behavior:
   - `python -m http.server 5500` from project root
   - then open `http://localhost:5500/web/`

## Host Flow

1. Set picking team (`Team A` or `Team B`).
2. Team chooses a tile (category + points).
3. TV shows round card (no lyrics).
4. Play chosen song from your phone Spotify and stop whenever you want.
5. Pick outcome:
   - `Team A Correct`
   - `Team B Correct`
   - `Wrong Pick` (optional negative scoring and steal prompt)
   - `No One`

## Settings

- Team names
- Points by level (5 comma-separated values)
- Allow steals
- Negative scoring
- Show song title/artist on round card

## Content Files

- `data/questions.json`: all categories and question metadata
- `data/settings.json`: default names/toggles/points

## Dry-Run Checklist

- Stand where players will sit and verify all text is readable on TV.
- Test one tile from each category before guests arrive.
- Confirm score updates correctly for all four outcomes.
- Verify used tiles cannot be selected again.
- Keep two tie-break songs ready in Spotify queue.
- Keep Spotify volume around 70-80% and TV volume lower to avoid clipping.
