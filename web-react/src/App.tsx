import { useState, useEffect, useMemo, useCallback } from 'react';
import type { CSSProperties } from 'react';
import './index.css';
import { AVAILABLE_PACKS } from './data/packLoader';
import { useGameState } from './hooks/useGameState';
import { useSpotify } from './hooks/useSpotify';
import { useToast } from './hooks/useToast';
import { Toast } from './components/shared/Toast';
import type { QuestionPack } from './types';

// ── Themes ──────────────────────────────────────────────────────────────────

const THEMES = {
  ink: {
    label: 'Ink',
    bg: '#0f0f12', panel: '#16161b', tile: '#1d1d23', tileHover: '#26262e',
    ink: '#f3f2ee', soft: '#94938d', accent: '#d8a850', accentInk: '#1a1407',
    accentSoft: 'rgba(216,168,80,0.10)', line: 'rgba(255,255,255,0.09)',
  },
  burg: {
    label: 'Burgunder',
    bg: '#110810', panel: '#1c0e18', tile: '#271321', tileHover: '#33192d',
    ink: '#f5eaf2', soft: '#a87090', accent: '#e8629a', accentInk: '#2a0618',
    accentSoft: 'rgba(232,98,154,0.12)', line: 'rgba(255,255,255,0.09)',
  },
  warm: {
    label: 'Warm',
    bg: '#F7F4EF', panel: '#ffffff', tile: '#EDEAE3', tileHover: '#E2DDD5',
    ink: '#2C2820', soft: '#7A7268', accent: '#8C6040', accentInk: '#F7F4EF',
    accentSoft: 'rgba(140,96,64,0.10)', line: 'rgba(44,40,32,0.12)',
  },
} as const;

type ThemeKey = keyof typeof THEMES;

// ── Helpers ──────────────────────────────────────────────────────────────────

function defaultPack(): QuestionPack {
  return JSON.parse(JSON.stringify(AVAILABLE_PACKS[0] ?? {
    id: 'default', name: 'Jeoparty', topic: 'music', version: '1.0', categories: [],
  })) as QuestionPack;
}

// ── Sub-components ───────────────────────────────────────────────────────────

function EqualizerBars({ accent }: { accent: string }) {
  const delays = [0, 0.18, 0.36, 0.12, 0.42, 0.24, 0.06];
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 5, height: 40 }}>
      {delays.map((d, i) => (
        <span
          key={i}
          style={{
            width: 6, height: '100%', borderRadius: 3, background: accent,
            transformOrigin: 'bottom',
            animation: `eq 0.9s ease-in-out ${d}s infinite`,
          }}
        />
      ))}
    </div>
  );
}

function ConfettiLayer() {
  const cols = ['var(--accent)', 'var(--ink)', 'var(--soft)'];
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 42 }, (_, i) => {
        const size = 6 + (i * 5) % 6;
        return (
          <span
            key={i}
            style={{
              position: 'absolute', top: -30, left: `${(i * 53) % 100}%`,
              width: size, height: size * 1.7, borderRadius: 2,
              background: cols[i % cols.length], opacity: 0.9,
              animation: `confettiFall ${2.6 + ((i * 3) % 9) / 10}s linear ${((i * 7) % 22) / 10}s infinite`,
            }}
          />
        );
      })}
    </div>
  );
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  const [screen, setScreen] = useState<'board' | 'builder'>('board');
  const [themeKey, setThemeKey] = useState<ThemeKey>('ink');
  const [pack, setPack] = useState<QuestionPack>(defaultPack);
  const [revealed, setRevealed] = useState(false);
  const [hintRevealed, setHintRevealed] = useState(false);
  const [winnerDismissed, setWinnerDismissed] = useState(false);
  const [hoverKey, setHoverKey] = useState<string | null>(null);

  const { toast, showToast } = useToast();
  const spotify = useSpotify(showToast);
  const theme = THEMES[themeKey];

  // Scores, turn order, spent tiles and double-jeopardy tiles all live in the
  // hook, where they are covered by unit tests. What stays here is presentation:
  // which panel is showing, and whether the hint and answer are flipped up.
  const game = useGameState(pack);
  const {
    teams,
    pickingIndex: picking,
    usedIds: used,
    activeTile: active,
    activeQuestion: activeQ,
    activeIsDouble,
    activePoints,
    activeCategoryName: activeCatName,
    pickerName,
    closeTile,
  } = game;

  // Root CSS variables
  const rootStyle = useMemo(() => ({
    '--bg': theme.bg, '--panel': theme.panel, '--tile': theme.tile,
    '--tileHover': theme.tileHover, '--ink': theme.ink, '--soft': theme.soft,
    '--accent': theme.accent, '--accentInk': theme.accentInk,
    '--accentSoft': theme.accentSoft, '--line': theme.line,
    minHeight: '100vh', background: 'var(--bg)', color: 'var(--ink)',
    fontFamily: "'Hanken Grotesk', system-ui, sans-serif",
  } as CSSProperties), [theme]);

  // ── Game actions ──────────────────────────────────────────────────────────

  function clearReveals() {
    setRevealed(false);
    setHintRevealed(false);
  }

  function resetGame() {
    game.reset();
    clearReveals();
    setWinnerDismissed(false);
  }

  function openTile(ci: number, qi: number) {
    const q = game.openTile(ci, qi);
    if (!q) return;
    clearReveals();
    if (spotify.isConnected) void spotify.playForQuestion(q);
  }

  const closeModal = useCallback(() => {
    closeTile();
    setRevealed(false);
    setHintRevealed(false);
  }, [closeTile]);

  function scoreTile(teamIdx: number) {
    game.award(teamIdx);
    clearReveals();
  }

  function resolveNoOne() {
    game.markNoOne();
    clearReveals();
  }

  // Escape key closes the question modal
  useEffect(() => {
    if (!active) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeModal();
    }
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [active, closeModal]);

  // ── Builder actions ───────────────────────────────────────────────────────

  const editPack = useCallback((fn: (p: QuestionPack) => void) => {
    setPack((prev) => {
      const next = JSON.parse(JSON.stringify(prev)) as QuestionPack;
      fn(next);
      return next;
    });
  }, []);

  function exportJson() {
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${pack.name.toLowerCase().replace(/\s+/g, '-')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // ── Derived data ──────────────────────────────────────────────────────────

  const showWinner = screen === 'board' && game.isFinished && !winnerDismissed;

  const sorted = game.standings;
  const topScore = game.topScore;
  const champs = game.champions;
  const tie = game.isTie;
  const winnerTitle = tie ? 'Uavgjort!' : `${sorted[0]?.name ?? ''} vant!`;
  const winnerSubtitle = tie
    ? `${champs.map((c) => c.name).join(' og ')} deler seieren med ${topScore} poeng`
    : `Med ${topScore} poeng`;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div style={rootStyle}>

      {/* ── Board view ─────────────────────────────────────────────────────── */}
      {screen === 'board' && (
        <div style={{ maxWidth: 1180, margin: '0 auto', padding: '26px 30px 52px' }}>

          {/* Header */}
          <header style={{
            display: 'grid', gridTemplateColumns: '1fr auto 1fr',
            alignItems: 'center', gap: 18, marginBottom: 26,
          }}>
            {/* Left */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, justifySelf: 'start' }}>
              <button
                onClick={() => setScreen('builder')}
                style={{ padding: '9px 15px', borderRadius: 10, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Pakkebygger
              </button>
              <button
                onClick={resetGame}
                style={{ padding: '9px 15px', borderRadius: 10, background: 'transparent', color: 'var(--soft)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
              >
                Nullstill
              </button>
            </div>

            {/* Logo */}
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 9, justifySelf: 'center', padding: '0 36px' }}>
              <span style={{ position: 'absolute', left: 8, top: -6, width: 8, height: 8, borderRadius: 2, background: '#e8b84b', transform: 'rotate(18deg)', animation: 'speckIn .5s ease both .15s' }} />
              <span style={{ position: 'absolute', left: -6, top: 18, width: 7, height: 7, borderRadius: '50%', background: '#d9789a', animation: 'speckIn .5s ease both .3s' }} />
              <span style={{ position: 'absolute', left: 22, bottom: -8, width: 6, height: 10, borderRadius: 2, background: '#5b8cf0', transform: 'rotate(-24deg)', animation: 'speckIn .5s ease both .42s' }} />
              <span style={{ position: 'absolute', right: 10, top: -8, width: 6, height: 10, borderRadius: 2, background: '#5bbf8a', transform: 'rotate(28deg)', animation: 'speckIn .5s ease both .24s' }} />
              <span style={{ position: 'absolute', right: -4, top: 15, width: 8, height: 8, borderRadius: 2, background: '#e8b84b', transform: 'rotate(-14deg)', animation: 'speckIn .5s ease both .36s' }} />
              <span style={{ position: 'absolute', right: 20, bottom: -9, width: 7, height: 7, borderRadius: '50%', background: '#d9789a', animation: 'speckIn .5s ease both .48s' }} />
              <span style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 34, letterSpacing: '.2px', color: 'var(--ink)' }}>
                Jeoparty
              </span>
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: 'var(--accent)', display: 'inline-block', marginBottom: 7 }} />
            </div>

            {/* Right: + Lag, Spotify + theme swatches */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifySelf: 'end' }}>
              {teams.length < 4 && (
                <button
                  onClick={game.addTeam}
                  style={{ padding: '9px 14px', borderRadius: 10, background: 'transparent', color: 'var(--soft)', border: '1px dashed var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600, whiteSpace: 'nowrap' }}
                >
                  + Lag
                </button>
              )}
              {spotify.isConfigured && (spotify.isConnected ? (
                <button
                  onClick={spotify.disconnect}
                  title="Spotify tilkoblet · trykk for å koble fra"
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 13px', borderRadius: 10, background: 'var(--tile)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600, color: 'var(--ink)', whiteSpace: 'nowrap' }}
                >
                  <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#1db954', flexShrink: 0, animation: 'dotPulse 1.6s ease-in-out infinite' }} />
                  Spotify tilkoblet
                </button>
              ) : (
                <button
                  onClick={spotify.connect}
                  title="Koble verten til Spotify én gang — deretter spilles hver sang automatisk. Krever Spotify Premium og en konto som er gitt tilgang til appen."
                  style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 14px', borderRadius: 10, background: '#1db954', border: 'none', cursor: 'pointer', fontSize: 13, fontWeight: 700, color: '#06241a' }}
                >
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" style={{ flexShrink: 0 }}>
                    <circle cx="12" cy="12" r="11" fill="#06241a" />
                    <path d="M6 9.4c4-1 8.6-.6 12.2 1.5M6.9 12.9c3.1-.8 6.8-.4 9.7 1.3M7.6 16.1c2.3-.6 5-.3 7.2.9" stroke="#1db954" strokeWidth="1.7" strokeLinecap="round" />
                  </svg>
                  Koble til Spotify
                </button>
              ))}
              <span style={{ width: 1, height: 22, background: 'var(--line)' }} />
              {(Object.keys(THEMES) as ThemeKey[]).map((k) => (
                <button
                  key={k}
                  title={THEMES[k].label}
                  onClick={() => setThemeKey(k)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', cursor: 'pointer', padding: 0,
                    background: THEMES[k].accent,
                    border: themeKey === k ? '2px solid var(--ink)' : '2px solid var(--line)',
                    boxShadow: themeKey === k ? '0 0 0 2px var(--bg)' : 'none',
                  }}
                />
              ))}
            </div>
          </header>

          {/* Teams row */}
          <section style={{ display: 'flex', gap: 14, alignItems: 'stretch', flexWrap: 'wrap', marginBottom: 18 }}>
            {teams.map((tm, i) => {
              const isPicking = picking === i;
              return (
                <div
                  key={i}
                  onClick={() => game.setPickingIndex(i)}
                  style={{
                    flex: 1, minWidth: 170, padding: '15px 18px', borderRadius: 15,
                    background: 'var(--panel)',
                    border: `1px solid ${isPicking ? 'var(--accent)' : 'var(--line)'}`,
                    boxShadow: isPicking ? '0 0 0 1px var(--accent)' : 'none',
                    display: 'flex', flexDirection: 'column', gap: 6, cursor: 'pointer',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <input
                      type="text"
                      value={tm.name}
                      onChange={(e) => game.renameTeam(i, e.target.value)}
                      onClick={(e) => e.stopPropagation()}
                      title="Trykk for å endre navn"
                      style={{
                        flex: 1, minWidth: 0, background: 'transparent', border: 'none',
                        borderRadius: 5, fontFamily: "'Space Grotesk', sans-serif",
                        fontWeight: 600, fontSize: 15, color: 'var(--ink)', padding: '1px 3px',
                      }}
                    />
                    <span style={{ fontSize: 10, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accent)' }}>
                      {isPicking ? 'velger' : ''}
                    </span>
                    {teams.length > 2 && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          game.removeTeam(i);
                        }}
                        title="Fjern lag"
                        style={{
                          width: 22, height: 22, borderRadius: '50%', border: '1px solid var(--line)',
                          background: 'transparent', color: 'var(--soft)', cursor: 'pointer',
                          fontSize: 13, lineHeight: 1, flexShrink: 0, display: 'grid', placeItems: 'center',
                        }}
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 34, color: 'var(--accent)', lineHeight: 1.05 }}>
                    {tm.score}
                  </span>
                </div>
              );
            })}
          </section>

          {/* Instructions */}
          <div style={{ textAlign: 'center', margin: '2px 4px 18px' }}>
            <div style={{
              fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, fontWeight: 700,
              letterSpacing: '1.8px', textTransform: 'uppercase', color: 'var(--soft)',
              marginBottom: 5,
            }}>
              Slik spiller du
            </div>
            <div style={{ fontSize: 15, color: 'var(--ink)', fontWeight: 500, lineHeight: 1.45 }}>
              Velg kategori og vanskelighetsgrad.{' '}
              <strong style={{ fontWeight: 600 }}>Første lag som svarer riktig får poengene.</strong>
            </div>
          </div>

          {/* Board grid */}
          <section style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 18, padding: 16, boxShadow: '0 1px 0 var(--line)' }}>
            <div style={{ display: 'flex', gap: 10 }}>
              {pack.categories.map((cat, ci) => (
                <div key={ci} style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <div style={{
                    minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center',
                    textAlign: 'center', padding: '8px', marginBottom: 7,
                    borderRadius: '12px 12px 6px 6px', background: 'var(--accentSoft)',
                    border: '1px solid var(--line)', borderBottom: '2px solid var(--accent)',
                    fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 16,
                    letterSpacing: '.6px', textTransform: 'uppercase', color: 'var(--ink)', lineHeight: 1.12,
                  }}>
                    {cat.name}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {cat.questions.map((q, qi) => {
                      const isUsed = used.has(q.id);
                      const tileKey = `${ci}-${qi}`;
                      const isHovered = hoverKey === tileKey && !isUsed;
                      return (
                        <button
                          key={q.id}
                          onClick={() => openTile(ci, qi)}
                          onMouseEnter={() => !isUsed && setHoverKey(tileKey)}
                          onMouseLeave={() => setHoverKey((h) => (h === tileKey ? null : h))}
                          style={{
                            minHeight: 88, border: `1px solid ${isHovered ? 'var(--accent)' : 'var(--line)'}`,
                            borderRadius: 12, background: isUsed ? 'transparent' : (isHovered ? 'var(--tileHover)' : 'var(--tile)'),
                            color: 'var(--accent)', fontFamily: "'Space Grotesk', sans-serif",
                            fontWeight: 600, fontSize: 28, letterSpacing: '.5px',
                            cursor: isUsed ? 'default' : 'pointer',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            opacity: isUsed ? 0.3 : 1,
                            transform: isHovered ? 'translateY(-3px)' : 'none',
                            boxShadow: isHovered ? '0 0 0 2px var(--accent), 0 12px 26px -12px var(--accent)' : 'none',
                            transition: 'transform .14s ease, background .14s ease, border-color .14s ease, box-shadow .14s ease',
                          }}
                        >
                          {isUsed ? '' : q.points}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── Builder view ────────────────────────────────────────────────────── */}
      {screen === 'builder' && (
        <div style={{ maxWidth: 920, margin: '0 auto', padding: '26px 30px 60px' }}>
          <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 18, marginBottom: 24 }}>
            <div>
              <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, letterSpacing: '-.4px', color: 'var(--ink)' }}>
                Pakkebygger
              </span>
              <div style={{ fontSize: 13, color: 'var(--soft)', marginTop: 2 }}>
                {pack.categories.length} kategorier · {pack.categories.reduce((n, c) => n + c.questions.length, 0)} ledetråder
              </div>
            </div>
            <button
              onClick={() => setScreen('board')}
              style={{ padding: '9px 15px', borderRadius: 10, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600 }}
            >
              ← Tilbake til brettet
            </button>
          </header>

          <div style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: 20, marginBottom: 18, display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 14 }}>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--soft)', fontWeight: 600, letterSpacing: '.3px' }}>
              PAKKENAVN
              <input
                type="text"
                value={pack.name}
                onChange={(e) => editPack((p) => { p.name = e.target.value; })}
                style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 14 }}
              />
            </label>
            <label style={{ display: 'grid', gap: 6, fontSize: 12, color: 'var(--soft)', fontWeight: 600, letterSpacing: '.3px' }}>
              TEMA
              <select
                value={pack.topic}
                onChange={(e) => editPack((p) => { p.topic = e.target.value; })}
                style={{ padding: '10px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 14 }}
              >
                <option value="music">Musikk</option>
                <option value="default">Tekstledetråd</option>
              </select>
            </label>
          </div>

          {pack.categories.map((cat, ci) => (
            <div key={ci} style={{ background: 'var(--panel)', border: '1px solid var(--line)', borderRadius: 16, padding: '16px 18px', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <input
                  type="text"
                  value={cat.name}
                  onChange={(e) => editPack((p) => { p.categories[ci]!.name = e.target.value; })}
                  placeholder="Kategorinavn"
                  style={{ flex: 1, padding: '9px 12px', borderRadius: 9, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 14, letterSpacing: '.5px' }}
                />
                <button
                  onClick={() => editPack((p) => { p.categories.splice(ci, 1); })}
                  style={{ padding: '8px 12px', borderRadius: 9, background: 'transparent', color: 'var(--soft)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 12, fontWeight: 600 }}
                >
                  Slett
                </button>
              </div>
              {cat.questions.map((q, qi) => (
                <div key={q.id} style={{ display: 'grid', gridTemplateColumns: '54px 1fr 1fr 1fr 1fr', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid var(--line)' }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 13, color: 'var(--accent)' }}>
                    {q.points}
                  </span>
                  <input
                    type="text"
                    value={q.songTitle ?? ''}
                    onChange={(e) => editPack((p) => { p.categories[ci]!.questions[qi]!.songTitle = e.target.value; })}
                    placeholder="Sangtittel"
                    style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 12.5, minWidth: 0 }}
                  />
                  <input
                    type="text"
                    value={q.artist ?? ''}
                    onChange={(e) => editPack((p) => { p.categories[ci]!.questions[qi]!.artist = e.target.value; })}
                    placeholder="Artist"
                    style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 12.5, minWidth: 0 }}
                  />
                  <input
                    type="text"
                    value={q.targetWord}
                    onChange={(e) => editPack((p) => { p.categories[ci]!.questions[qi]!.targetWord = e.target.value; })}
                    placeholder="Svar"
                    style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 12.5, minWidth: 0 }}
                  />
                  <input
                    type="text"
                    value={q.hint ?? ''}
                    onChange={(e) => editPack((p) => { p.categories[ci]!.questions[qi]!.hint = e.target.value; })}
                    placeholder="Hint"
                    style={{ padding: '7px 9px', borderRadius: 8, border: '1px solid var(--line)', background: 'var(--tile)', color: 'var(--ink)', fontSize: 12.5, minWidth: 0 }}
                  />
                </div>
              ))}
            </div>
          ))}

          <button
            onClick={() =>
              editPack((p) => {
                p.categories.push({
                  name: 'Ny kategori',
                  questions: [1, 2, 3, 4, 5].map((l) => ({
                    id: crypto.randomUUID(),
                    level: l,
                    points: l * 100,
                    targetWord: '',
                    songTitle: '',
                    artist: '',
                    hint: '',
                  })),
                });
              })
            }
            style={{ width: '100%', padding: 13, borderRadius: 12, background: 'transparent', color: 'var(--ink)', border: '1px dashed var(--line)', cursor: 'pointer', fontSize: 13, fontWeight: 600, marginBottom: 20 }}
          >
            + Legg til kategori
          </button>

          <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
            <button
              onClick={() => { resetGame(); setScreen('board'); }}
              style={{ padding: '11px 20px', borderRadius: 11, background: 'var(--accent)', color: 'var(--accentInk)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
            >
              ▶ Spill nå
            </button>
            <button
              onClick={exportJson}
              style={{ padding: '11px 18px', borderRadius: 11, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
            >
              ↓ Eksporter JSON
            </button>
          </div>
        </div>
      )}

      {/* ── Winner overlay ───────────────────────────────────────────────────── */}
      {showWinner && (
        <div style={{
          position: 'fixed', inset: 0, background: 'var(--bg)', zIndex: 60,
          overflow: 'hidden', display: 'grid', placeItems: 'center', padding: 24,
          animation: 'overlayIn .3s ease',
        }}>
          <ConfettiLayer />
          <div style={{ position: 'relative', width: 'min(560px, 95vw)', textAlign: 'center', animation: 'popIn .4s cubic-bezier(.2,.8,.2,1)' }}>
            <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: 3, textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600, marginBottom: 12 }}>
              Spillet er ferdig
            </div>
            <div style={{ fontFamily: "'Fredoka', sans-serif", fontWeight: 600, fontSize: 48, color: 'var(--ink)', letterSpacing: '.2px', lineHeight: 1.05, marginBottom: 6 }}>
              {winnerTitle}
            </div>
            <div style={{ fontSize: 15, color: 'var(--soft)', marginBottom: 32 }}>
              {winnerSubtitle}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 30 }}>
              {sorted.map((t, idx) => {
                const isWin = t.score === topScore;
                return (
                  <div key={idx} style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12,
                    padding: '14px 18px', borderRadius: 13, background: 'var(--panel)',
                    border: `1px solid ${isWin ? 'var(--accent)' : 'var(--line)'}`,
                    boxShadow: isWin ? '0 0 0 1px var(--accent)' : 'none',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 13, minWidth: 0 }}>
                      <span style={{
                        width: 26, height: 26, borderRadius: '50%', display: 'grid', placeItems: 'center',
                        fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 13, flexShrink: 0,
                        background: isWin ? 'var(--accent)' : 'var(--tile)',
                        color: isWin ? 'var(--accentInk)' : 'var(--soft)',
                      }}>
                        {idx + 1}
                      </span>
                      <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--ink)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {t.name}
                      </span>
                    </div>
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 26, color: 'var(--accent)', flexShrink: 0 }}>
                      {t.score}
                    </span>
                  </div>
                );
              })}
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button
                onClick={resetGame}
                style={{ padding: '12px 24px', borderRadius: 11, background: 'var(--accent)', color: 'var(--accentInk)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
              >
                Spill igjen
              </button>
              <button
                onClick={() => setWinnerDismissed(true)}
                style={{ padding: '12px 20px', borderRadius: 11, background: 'transparent', color: 'var(--ink)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Se brettet
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Question modal ───────────────────────────────────────────────────── */}
      {active && activeQ && (
        <div
          onClick={closeModal}
          style={{
            position: 'fixed', inset: 0, background: 'rgba(8,8,12,.6)',
            backdropFilter: 'blur(3px)', display: 'grid', placeItems: 'center',
            zIndex: 50, padding: 24, animation: 'overlayIn .18s ease',
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(640px, 95vw)', background: 'var(--panel)',
              border: '1px solid var(--line)', borderRadius: 20, padding: 30,
              boxShadow: '0 30px 80px rgba(0,0,0,.5)',
              animation: 'modalIn .22s cubic-bezier(.2,.8,.2,1)',
            }}
          >
            {/* Modal head */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18 }}>
              <div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: 2, textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600 }}>
                  {activeCatName}
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 4 }}>
                  <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 700, fontSize: 44, color: 'var(--accent)', lineHeight: 1 }}>
                    {activePoints}
                  </span>
                  {activeIsDouble && (
                    <span style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', fontWeight: 700, color: 'var(--accentInk)', background: 'var(--accent)', padding: '4px 9px', borderRadius: 20 }}>
                      Dobbel · 2×
                    </span>
                  )}
                </div>
              </div>
              <button
                onClick={closeModal}
                style={{ width: 34, height: 34, borderRadius: '50%', background: 'transparent', border: '1px solid var(--line)', color: 'var(--soft)', cursor: 'pointer', fontSize: 16, lineHeight: 1, flexShrink: 0 }}
              >
                &times;
              </button>
            </div>

            {/* Equalizer animation */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '18px 0 24px', marginBottom: 18, borderBottom: '1px solid var(--line)' }}>
              <EqualizerBars accent={theme.accent} />
              <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontSize: 12, letterSpacing: '2.5px', textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600 }}>
                {spotify.isConnected ? 'Spotify spiller sangen automatisk' : 'Verten spiller sangen nå'}
              </div>
            </div>

            {/* Hint + Answer cards */}
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                onClick={() => setHintRevealed((p) => !p)}
                style={{ flex: 1, minWidth: 200, background: 'var(--tile)', border: '1px solid var(--line)', borderRadius: 13, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600, marginBottom: 5 }}>
                  Hint · trykk for å {hintRevealed ? 'skjule' : 'vise'}
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--accent)' }}>
                  {hintRevealed ? (activeQ.hint ?? activeQ.hostNote ?? '—') : '• • • •'}
                </div>
              </button>
              <button
                onClick={() => setRevealed((p) => !p)}
                style={{ flex: 1, minWidth: 200, background: 'var(--tile)', border: '1px solid var(--line)', borderRadius: 13, padding: '14px 16px', cursor: 'pointer', textAlign: 'left' }}
              >
                <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600, marginBottom: 5 }}>
                  Svar · trykk for å {revealed ? 'skjule' : 'vise'}
                </div>
                <div style={{ fontFamily: "'Space Grotesk', sans-serif", fontWeight: 600, fontSize: 18, color: 'var(--accent)' }}>
                  {revealed ? (activeQ.targetWord || '—') : '• • • •'}
                </div>
              </button>
            </div>

            <div style={{ height: 1, background: 'var(--line)', margin: '4px 0 16px' }} />

            {/* Team scoring */}
            <div style={{ fontSize: 11, letterSpacing: '1.5px', textTransform: 'uppercase', color: 'var(--soft)', fontWeight: 600, marginBottom: 10 }}>
              Hvem klarte den? · valgt av {pickerName}
            </div>
            <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap' }}>
              {teams.map((tm, i) => (
                <button
                  key={i}
                  onClick={() => scoreTile(i)}
                  style={{ flex: 1, minWidth: 140, padding: '12px 14px', borderRadius: 11, background: 'var(--accent)', color: 'var(--accentInk)', border: 'none', cursor: 'pointer', fontSize: 14, fontWeight: 700 }}
                >
                  {tm.name}
                </button>
              ))}
              <button
                onClick={resolveNoOne}
                style={{ padding: '12px 16px', borderRadius: 11, background: 'transparent', color: 'var(--soft)', border: '1px solid var(--line)', cursor: 'pointer', fontSize: 14, fontWeight: 600 }}
              >
                Ingen
              </button>
            </div>
          </div>
        </div>
      )}

      <Toast toast={toast} />
    </div>
  );
}
