import { useCallback, useEffect, useRef, useState } from 'react';
import type { SpotifySession } from '../types';
import { randomString, generateCodeChallenge } from '../utils/spotify';

const CLIENT_ID = import.meta.env.VITE_SPOTIFY_CLIENT_ID as string | undefined;

// Spotify matches the redirect URI character for character against the one
// registered in the dashboard, so it has to carry the base path too — on Pages
// the app lives at /Jeoparty/, not at the domain root. Spotify also rejects
// "localhost" while allowing the loopback IP, hence the swap.
const REDIRECT_URI =
  (import.meta.env.VITE_SPOTIFY_REDIRECT_URI as string | undefined) ??
  `${window.location.protocol}//${
    window.location.hostname === 'localhost' ? '127.0.0.1' : window.location.hostname
  }${window.location.port ? `:${window.location.port}` : ''}${window.location.pathname}`;
const TOKEN_KEY = 'jeoparty_spotify_token';
const VERIFIER_KEY = 'jeoparty_spotify_verifier';
const SCOPES = ['user-modify-playback-state', 'user-read-playback-state'];

interface SpotifyTokenResponse {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
}

export function useSpotify(showToast: (msg: string, tone?: 'info' | 'success' | 'error') => void) {
  const [session, setSession] = useState<SpotifySession | null>(null);
  const [isBusy, setIsBusy] = useState(false);
  const sessionRef = useRef<SpotifySession | null>(null);
  sessionRef.current = session;

  useEffect(() => {
    const cached = localStorage.getItem(TOKEN_KEY);
    if (cached) {
      try {
        const parsed = JSON.parse(cached) as SpotifySession;
        if (parsed.accessToken && parsed.expiresAt && Date.now() < parsed.expiresAt) {
          setSession(parsed);
        }
      } catch {
        localStorage.removeItem(TOKEN_KEY);
      }
    }

    async function handleOAuthCallback() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get('code');
      const verifier = localStorage.getItem(VERIFIER_KEY);
      if (!code || !verifier || !CLIENT_ID) return;

      try {
        const body = new URLSearchParams({
          client_id: CLIENT_ID,
          grant_type: 'authorization_code',
          code,
          redirect_uri: REDIRECT_URI,
          code_verifier: verifier,
        });
        const res = await fetch('https://accounts.spotify.com/api/token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body,
        });
        if (!res.ok) return;
        const data = await res.json() as SpotifyTokenResponse;
        const next: SpotifySession = {
          accessToken: data.access_token,
          refreshToken: data.refresh_token ?? '',
          expiresAt: Date.now() + data.expires_in * 1000,
        };
        localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
        setSession(next);
      } finally {
        localStorage.removeItem(VERIFIER_KEY);
        window.history.replaceState(
          {},
          document.title,
          `${window.location.origin}${window.location.pathname}`,
        );
      }
    }

    void handleOAuthCallback();
  }, []);

  const refreshIfNeeded = useCallback(async (): Promise<string | null> => {
    const s = sessionRef.current;
    if (!s?.accessToken) return null;
    if (Date.now() < s.expiresAt - 60000) return s.accessToken;
    if (!s.refreshToken || !CLIENT_ID) return null;

    const body = new URLSearchParams({
      client_id: CLIENT_ID,
      grant_type: 'refresh_token',
      refresh_token: s.refreshToken,
    });
    const res = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    if (!res.ok) return null;
    const data = await res.json() as SpotifyTokenResponse;
    const next: SpotifySession = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? s.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };
    localStorage.setItem(TOKEN_KEY, JSON.stringify(next));
    setSession(next);
    return next.accessToken;
  }, []);

  const connect = useCallback(async () => {
    if (!CLIENT_ID) {
      showToast('Missing Spotify Client ID. Add VITE_SPOTIFY_CLIENT_ID to .env.', 'error');
      return;
    }
    const verifier = randomString(64);
    const challenge = await generateCodeChallenge(verifier);
    localStorage.setItem(VERIFIER_KEY, verifier);

    const url = new URL('https://accounts.spotify.com/authorize');
    url.searchParams.set('client_id', CLIENT_ID);
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('redirect_uri', REDIRECT_URI);
    url.searchParams.set('scope', SCOPES.join(' '));
    url.searchParams.set('code_challenge_method', 'S256');
    url.searchParams.set('code_challenge', challenge);
    window.location.href = url.toString();
  }, [showToast]);

  const disconnect = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(VERIFIER_KEY);
    setSession(null);
  }, []);

  const playForQuestion = useCallback(
    async (question: { songTitle?: string; artist?: string }) => {
      if (!sessionRef.current || !question.songTitle || !question.artist) return;

      setIsBusy(true);
      try {
        const token = await refreshIfNeeded();
        if (!token) {
          showToast('Spotify session expired. Please reconnect.', 'error');
          setSession(null);
          return;
        }

        const q = encodeURIComponent(`track:${question.songTitle} artist:${question.artist}`);
        const searchRes = await fetch(
          `https://api.spotify.com/v1/search?q=${q}&type=track&limit=1`,
          { headers: { Authorization: `Bearer ${token}` } },
        );
        if (!searchRes.ok) return;

        const searchData = await searchRes.json() as { tracks?: { items?: { uri: string }[] } };
        const uri = searchData.tracks?.items?.[0]?.uri;
        if (!uri) {
          showToast('Song not found on Spotify.', 'error');
          return;
        }

        const playRes = await fetch('https://api.spotify.com/v1/me/player/play', {
          method: 'PUT',
          headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ uris: [uri] }),
        });

        if (playRes.status === 404) {
          showToast('No active Spotify device. Open Spotify on your phone or computer first.', 'error');
        } else if (playRes.status === 403) {
          showToast('Playback requires Spotify Premium.', 'error');
        } else if (playRes.status === 401) {
          showToast('Spotify connection expired. Please reconnect.', 'error');
          disconnect();
        } else if (playRes.ok) {
          showToast('Playing on Spotify.', 'success');
        }
      } finally {
        setIsBusy(false);
      }
    },
    [refreshIfNeeded, showToast, disconnect],
  );

  return {
    session,
    isBusy,
    isConfigured: Boolean(CLIENT_ID),
    isConnected: session !== null,
    connect,
    disconnect,
    playForQuestion,
  };
}
