import { useEffect, useMemo, useState } from "react";
import "./index.css";
import questionsData from "./data/questions.json";
import defaultSettings from "./data/settings.json";

const SPOTIFY_CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID;
const SPOTIFY_REDIRECT_URI =
  import.meta.env.VITE_SPOTIFY_REDIRECT_URI ||
  `${window.location.protocol}//${
    window.location.hostname === "localhost" ? "127.0.0.1" : window.location.hostname
  }${window.location.port ? `:${window.location.port}` : ""}`;
const SPOTIFY_TOKEN_KEY = "jeoparty_spotify_token";
const SPOTIFY_VERIFIER_KEY = "jeoparty_spotify_verifier";
const SPOTIFY_SCOPES = ["user-modify-playback-state", "user-read-playback-state"];

function sanitizeName(input, fallback) {
  const trimmed = String(input || "").trim();
  return trimmed.length ? trimmed : fallback;
}

function mapPoints(categories) {
  return categories.map((category) => ({
    ...category,
    questions: category.questions.map((q) => ({
      ...q,
      points: q.level,
    })),
  }));
}

function randomString(length) {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let result = "";
  for (let i = 0; i < length; i += 1) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function generateCodeChallenge(verifier) {
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  const digest = await window.crypto.subtle.digest("SHA-256", data);
  const bytes = new Uint8Array(digest);
  let str = "";
  bytes.forEach((b) => {
    str += String.fromCharCode(b);
  });
  return btoa(str).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function App() {
  const [settings, setSettings] = useState(defaultSettings);
  const [scores, setScores] = useState({ A: 0, B: 0 });
  const [currentPicker, setCurrentPicker] = useState("A");
  const [usedQuestionIds, setUsedQuestionIds] = useState(() => new Set());
  const [activeQuestion, setActiveQuestion] = useState(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [answerRevealed, setAnswerRevealed] = useState(false);
  const [songFilter, setSongFilter] = useState("");
  const [spotifySession, setSpotifySession] = useState(null);
  const [spotifyBusy, setSpotifyBusy] = useState(false);
  const [settingsDraft, setSettingsDraft] = useState({
    teamAName: defaultSettings.teamAName,
    teamBName: defaultSettings.teamBName,
    allowSteals: defaultSettings.allowSteals,
    negativeScoring: defaultSettings.negativeScoring,
    showSongMeta: defaultSettings.showSongMeta,
  });

  const categories = useMemo(() => mapPoints(questionsData.categories), []);
  const filteredCategories = useMemo(() => {
    const term = songFilter.trim().toLowerCase();
    if (!term) {
      return categories;
    }
    return categories
      .map((category) => ({
        ...category,
        questions: category.questions.filter(
          (q) =>
            q.songTitle.toLowerCase().includes(term) ||
            q.artist.toLowerCase().includes(term) ||
            q.targetWord.toLowerCase().includes(term)
        ),
      }))
      .filter((category) => category.questions.length > 0);
  }, [categories, songFilter]);

  const teamALabel = settings.teamAName || "Lag A";
  const teamBLabel = settings.teamBName || "Lag B";

  useEffect(() => {
    if (window.location.hostname !== "localhost") {
      return;
    }
    const target = `${window.location.protocol}//127.0.0.1${
      window.location.port ? `:${window.location.port}` : ""
    }${window.location.pathname}${window.location.search}${window.location.hash}`;
    window.location.replace(target);
  }, []);

  useEffect(() => {
    const cached = localStorage.getItem(SPOTIFY_TOKEN_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (parsed?.accessToken && parsed?.expiresAt && Date.now() < parsed.expiresAt) {
          setSpotifySession(parsed);
        }
      } catch (error) {
        localStorage.removeItem(SPOTIFY_TOKEN_KEY);
      }
    }

    async function handleCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      const verifier = localStorage.getItem(SPOTIFY_VERIFIER_KEY);
      if (!code || !verifier || !SPOTIFY_CLIENT_ID) {
        return;
      }

      try {
        const payload = new URLSearchParams({
          client_id: SPOTIFY_CLIENT_ID,
          grant_type: "authorization_code",
          code,
          redirect_uri: SPOTIFY_REDIRECT_URI,
          code_verifier: verifier,
        });
        const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: payload,
        });
        if (!tokenResponse.ok) {
          return;
        }
        const tokenData = await tokenResponse.json();
        const nextSession = {
          accessToken: tokenData.access_token,
          refreshToken: tokenData.refresh_token,
          expiresAt: Date.now() + tokenData.expires_in * 1000,
        };
        localStorage.setItem(SPOTIFY_TOKEN_KEY, JSON.stringify(nextSession));
        setSpotifySession(nextSession);
      } finally {
        localStorage.removeItem(SPOTIFY_VERIFIER_KEY);
        const cleanUrl = `${window.location.origin}${window.location.pathname}`;
        window.history.replaceState({}, document.title, cleanUrl);
      }
    }

    void handleCallback();
  }, []);

  async function refreshAccessTokenIfNeeded() {
    if (!spotifySession?.accessToken) {
      return null;
    }
    if (Date.now() < spotifySession.expiresAt - 60000) {
      return spotifySession.accessToken;
    }
    if (!spotifySession.refreshToken || !SPOTIFY_CLIENT_ID) {
      return null;
    }

    const payload = new URLSearchParams({
      client_id: SPOTIFY_CLIENT_ID,
      grant_type: "refresh_token",
      refresh_token: spotifySession.refreshToken,
    });
    const tokenResponse = await fetch("https://accounts.spotify.com/api/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: payload,
    });
    if (!tokenResponse.ok) {
      return null;
    }
    const tokenData = await tokenResponse.json();
    const nextSession = {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || spotifySession.refreshToken,
      expiresAt: Date.now() + tokenData.expires_in * 1000,
    };
    localStorage.setItem(SPOTIFY_TOKEN_KEY, JSON.stringify(nextSession));
    setSpotifySession(nextSession);
    return nextSession.accessToken;
  }

  async function connectSpotify() {
    if (!SPOTIFY_CLIENT_ID) {
      window.alert("Mangler Spotify Client ID. Legg inn VITE_SPOTIFY_CLIENT_ID i .env.");
      return;
    }
    const verifier = randomString(64);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem(SPOTIFY_VERIFIER_KEY, verifier);

    const authUrl = new URL("https://accounts.spotify.com/authorize");
    authUrl.searchParams.set("client_id", SPOTIFY_CLIENT_ID);
    authUrl.searchParams.set("response_type", "code");
    authUrl.searchParams.set("redirect_uri", SPOTIFY_REDIRECT_URI);
    authUrl.searchParams.set("scope", SPOTIFY_SCOPES.join(" "));
    authUrl.searchParams.set("code_challenge_method", "S256");
    authUrl.searchParams.set("code_challenge", challenge);
    window.location.href = authUrl.toString();
  }

  function disconnectSpotify() {
    localStorage.removeItem(SPOTIFY_TOKEN_KEY);
    localStorage.removeItem(SPOTIFY_VERIFIER_KEY);
    setSpotifySession(null);
  }

  async function playSpotifyForQuestion(question) {
    if (!spotifySession) {
      return;
    }

    setSpotifyBusy(true);
    try {
      const accessToken = await refreshAccessTokenIfNeeded();
      if (!accessToken) {
        window.alert("Spotify-okten er utlopet. Koble til pa nytt.");
        setSpotifySession(null);
        return;
      }

      const query = encodeURIComponent(`track:${question.songTitle} artist:${question.artist}`);
      const searchResponse = await fetch(
        `https://api.spotify.com/v1/search?q=${query}&type=track&limit=1`,
        { headers: { Authorization: `Bearer ${accessToken}` } }
      );
      if (!searchResponse.ok) {
        return;
      }

      const searchData = await searchResponse.json();
      const trackUri = searchData?.tracks?.items?.[0]?.uri;
      if (!trackUri) {
        window.alert("Fant ikke sangen i Spotify-sok.");
        return;
      }

      const playResponse = await fetch("https://api.spotify.com/v1/me/player/play", {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ uris: [trackUri] }),
      });

      if (playResponse.status === 404) {
        window.alert("Ingen aktiv Spotify-enhet. Start Spotify pa mobilen eller PC-en forst.");
      } else if (playResponse.status === 403) {
        window.alert("Avspilling krever Spotify Premium-konto.");
      } else if (playResponse.status === 401) {
        window.alert("Spotify-tilkobling utlopte. Koble til pa nytt.");
        disconnectSpotify();
      }
    } finally {
      setSpotifyBusy(false);
    }
  }

  function openSettings() {
    setSettingsDraft({
      teamAName: settings.teamAName,
      teamBName: settings.teamBName,
      allowSteals: settings.allowSteals,
      negativeScoring: settings.negativeScoring,
      showSongMeta: settings.showSongMeta,
    });
    setSongFilter("");
    setSettingsOpen(true);
  }

  function closeSettings() {
    setSettingsOpen(false);
  }

  function onSaveSettings(event) {
    event.preventDefault();
    setSettings((prev) => ({
      ...prev,
      teamAName: sanitizeName(settingsDraft.teamAName, "Lag A"),
      teamBName: sanitizeName(settingsDraft.teamBName, "Lag B"),
      allowSteals: settingsDraft.allowSteals,
      negativeScoring: settingsDraft.negativeScoring,
      showSongMeta: settingsDraft.showSongMeta,
    }));
    closeSettings();
  }

  function onResetGame() {
    if (!window.confirm("Nullstille poeng og spillebrett?")) {
      return;
    }
    setScores({ A: 0, B: 0 });
    setUsedQuestionIds(new Set());
    setActiveQuestion(null);
    setAnswerRevealed(false);
  }

  function openQuestion(categoryName, question) {
    setActiveQuestion({ categoryName, question });
    setAnswerRevealed(false);
    void playSpotifyForQuestion(question);
  }

  function closeQuestion() {
    setActiveQuestion(null);
    setAnswerRevealed(false);
  }

  function markQuestionUsed(questionId) {
    setUsedQuestionIds((prev) => {
      const next = new Set(prev);
      next.add(questionId);
      return next;
    });
  }

  function awardWinner(team) {
    if (!activeQuestion) {
      return;
    }
    const { question } = activeQuestion;
    setScores((prev) => ({ ...prev, [team]: prev[team] + question.points }));
    markQuestionUsed(question.id);
    closeQuestion();
  }

  function markNoOne() {
    if (!activeQuestion) {
      return;
    }
    markQuestionUsed(activeQuestion.question.id);
    closeQuestion();
  }

  function onWrongPick() {
    if (!activeQuestion) {
      return;
    }

    const { question } = activeQuestion;
    if (settings.negativeScoring) {
      setScores((prev) => ({
        ...prev,
        [currentPicker]: prev[currentPicker] - question.points,
      }));
    }

    if (settings.allowSteals) {
      const stealWinner = window.prompt("Hvem tok stjelingen? Skriv A, B eller N for ingen.", "N");
      const normalized = String(stealWinner || "N").trim().toUpperCase();
      if (normalized === "A" || normalized === "B") {
        setScores((prev) => ({ ...prev, [normalized]: prev[normalized] + question.points }));
      }
    }

    markQuestionUsed(question.id);
    closeQuestion();
  }

  return (
    <>
      <div className="sparkle-overlay" aria-hidden="true" />
      <header className="top-bar">
        <div className="title-wrap">
          <h1>Jeoparty!</h1>
        </div>
        <div className="top-bar-actions">
          <button className="ghost-btn" onClick={openSettings}>
            Innstillinger
          </button>
          {spotifySession ? (
            <button className="primary-btn" onClick={disconnectSpotify} disabled={spotifyBusy}>
              {spotifyBusy ? "Spotify jobber..." : "Koble fra Spotify"}
            </button>
          ) : (
            <button className="primary-btn" onClick={connectSpotify}>
              Koble Spotify
            </button>
          )}
          <button className="danger-btn" onClick={onResetGame}>
            Nullstill spill
          </button>
        </div>
      </header>

      <main className="app-shell">
        <section className="scoreboard card">
          <article className="team-card">
            <h2>{teamALabel}</h2>
            <p className="score-value">{scores.A}</p>
          </article>

          <div className="picking-team card-soft">
            <div className="picker-actions">
              <button
                className={`pick-btn ${currentPicker === "A" ? "active" : ""}`}
                onClick={() => setCurrentPicker("A")}
              >
                {teamALabel}
              </button>
              <button
                className={`pick-btn ${currentPicker === "B" ? "active" : ""}`}
                onClick={() => setCurrentPicker("B")}
              >
                {teamBLabel}
              </button>
            </div>
          </div>

          <article className="team-card">
            <h2>{teamBLabel}</h2>
            <p className="score-value">{scores.B}</p>
          </article>
        </section>

        <section className="board card">
          <div className="board-head">
            <p>Velg kategori og vanskelighetsgrad. Første riktige lag får poengene.</p>
          </div>
          <div className="board-grid">
            {categories.map((category) => (
              <div key={category.name} className="category-column">
                <div className="category-header">{category.name}</div>
                {category.questions
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((question) => {
                    const used = usedQuestionIds.has(question.id);
                    return (
                      <button
                        key={question.id}
                        type="button"
                        disabled={used}
                        className={`tile-btn ${used ? "used" : ""}`}
                        onClick={() => openQuestion(category.name, question)}
                      >
                        {question.points}
                      </button>
                    );
                  })}
              </div>
            ))}
          </div>
        </section>
      </main>

      <aside className={`settings-drawer ${settingsOpen ? "open" : ""}`} aria-hidden={!settingsOpen}>
        <div className="drawer-header">
          <h2>Spillinnstillinger</h2>
          <button className="ghost-btn" onClick={closeSettings}>
            Lukk
          </button>
        </div>
        <form className="settings-form" onSubmit={onSaveSettings}>
          <label>
            Lagnavn A
            <input
              type="text"
              maxLength={24}
              value={settingsDraft.teamAName}
              onChange={(e) => setSettingsDraft((prev) => ({ ...prev, teamAName: e.target.value }))}
            />
          </label>
          <label>
            Lagnavn B
            <input
              type="text"
              maxLength={24}
              value={settingsDraft.teamBName}
              onChange={(e) => setSettingsDraft((prev) => ({ ...prev, teamBName: e.target.value }))}
            />
          </label>
          <label>
            Poeng per vanskelighetsgrad
            <input type="text" value="Niva 1-5 = 1-5 poeng" readOnly />
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settingsDraft.allowSteals}
              onChange={(e) => setSettingsDraft((prev) => ({ ...prev, allowSteals: e.target.checked }))}
            />
            Tillat stjeling
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settingsDraft.negativeScoring}
              onChange={(e) =>
                setSettingsDraft((prev) => ({ ...prev, negativeScoring: e.target.checked }))
              }
            />
            Trekk poeng ved feil svar
          </label>
          <label className="toggle-row">
            <input
              type="checkbox"
              checked={settingsDraft.showSongMeta}
              onChange={(e) => setSettingsDraft((prev) => ({ ...prev, showSongMeta: e.target.checked }))}
            />
            Vis sangtittel og artist
          </label>
          <div className="form-actions">
            <button type="submit" className="primary-btn">
              Lagre innstillinger
            </button>
          </div>
        </form>
        <section className="song-library">
          <h3>Sangbibliotek</h3>
          <label className="song-filter">
            Sok etter sang eller artist
            <input
              type="text"
              placeholder="Prove: tiger, Gaga, vin"
              value={songFilter}
              onChange={(e) => setSongFilter(e.target.value)}
            />
          </label>
          {filteredCategories.map((category) => (
            <details key={`lib-${category.name}`} className="song-library-group">
              <summary>{category.name}</summary>
              <ul>
                {category.questions
                  .slice()
                  .sort((a, b) => a.level - b.level)
                  .map((question) => (
                    <li key={`song-${question.id}`}>
                      <span>L{question.level}</span> {question.songTitle} - {question.artist}
                    </li>
                  ))}
              </ul>
            </details>
          ))}
          {filteredCategories.length === 0 && <p className="empty-library">Ingen treff for dette soket.</p>}
        </section>
      </aside>

      {activeQuestion && (
        <div className="modal" role="dialog" aria-modal="true">
          <div className="modal-card">
            <div className="modal-head">
              <h2>Rundekort</h2>
              <button className="ghost-btn" onClick={closeQuestion}>
                Lukk
              </button>
            </div>

            <div className="meta-grid">
              <div className="meta-item">
                <p className="meta-label">Kategori</p>
                <p className="meta-value">{activeQuestion.categoryName}</p>
              </div>
              <div className="meta-item">
                <p className="meta-label">Niva</p>
                <p className="meta-value">{activeQuestion.question.level}</p>
              </div>
              <div className="meta-item">
                <p className="meta-label">Poeng</p>
                <p className="meta-value">{activeQuestion.question.points}</p>
              </div>
              <div className="meta-item">
                <p className="meta-label">Velgende lag</p>
                <p className="meta-value">{currentPicker === "A" ? teamALabel : teamBLabel}</p>
              </div>
            </div>

            {settings.showSongMeta && (
              <div className="song-meta">
                <p className="song-title">{activeQuestion.question.songTitle}</p>
                <p className="song-artist">{activeQuestion.question.artist}</p>
              </div>
            )}

            <div className="host-note-wrap">
              <p className="meta-label">Vertsnotat</p>
              <p className="host-note">{activeQuestion.question.hostNote || "Ingen notat."}</p>
            </div>

            <div className="answer-reveal">
              <button className="ghost-btn" onClick={() => setAnswerRevealed((prev) => !prev)}>
                {answerRevealed ? "Skjul malord" : "Vis malord"}
              </button>
              {answerRevealed && <p className="target-word">{activeQuestion.question.targetWord}</p>}
            </div>

            <div className="modal-actions">
              <button className="primary-btn" onClick={() => awardWinner("A")}>
                {teamALabel} riktig
              </button>
              <button className="primary-btn" onClick={() => awardWinner("B")}>
                {teamBLabel} riktig
              </button>
              <button className="ghost-btn" onClick={onWrongPick}>
                Feil svar
              </button>
              <button className="ghost-btn" onClick={markNoOne}>
                Ingen
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default App;
