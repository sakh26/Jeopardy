import { useCallback, useMemo, useState } from 'react';
import type { Question, QuestionPack } from '../types';
import { isPackFinished, pickDoubleIds, tileValue } from '../utils/gameLogic';

export interface PlayTeam {
  name: string;
  score: number;
}

/** Which tile is open, by category index and question index. */
export interface TileRef {
  ci: number;
  qi: number;
}

export interface UseGameStateOptions {
  /** How many tiles score double. Two out of twenty-five by default. */
  doubleCount?: number;
  /** Injectable so tests get a fixed board instead of a random one. */
  rng?: () => number;
}

const DEFAULT_TEAMS: PlayTeam[] = [
  { name: 'Lag 1', score: 0 },
  { name: 'Lag 2', score: 0 },
];

export const MIN_TEAMS = 2;
export const MAX_TEAMS = 4;

/**
 * The rules of a round: who picks, which tiles are spent, what a tile is worth
 * and who gets the points. State and arithmetic only — the UI decides how it
 * looks, and Spotify lives outside entirely.
 */
export function useGameState(pack: QuestionPack, options: UseGameStateOptions = {}) {
  const { doubleCount = 2, rng } = options;

  const [teams, setTeams] = useState<PlayTeam[]>(() => DEFAULT_TEAMS.map((t) => ({ ...t })));
  const [pickingIndex, setPickingIndex] = useState(0);
  const [usedIds, setUsedIds] = useState<Set<string>>(() => new Set());
  const [doubleIds, setDoubleIds] = useState<Set<string>>(() =>
    pickDoubleIds(pack, doubleCount, rng),
  );
  const [activeTile, setActiveTile] = useState<TileRef | null>(null);

  const questionAt = useCallback(
    (tile: TileRef | null): Question | null =>
      tile ? (pack.categories[tile.ci]?.questions[tile.qi] ?? null) : null,
    [pack],
  );

  const activeQuestion = useMemo(() => questionAt(activeTile), [questionAt, activeTile]);
  const activeIsDouble = activeQuestion ? doubleIds.has(activeQuestion.id) : false;
  const activePoints = activeQuestion ? tileValue(activeQuestion, activeIsDouble) : 0;
  const activeCategoryName = activeTile ? (pack.categories[activeTile.ci]?.name ?? '') : '';

  const pickerName = teams[pickingIndex]?.name ?? '';
  const isFinished = useMemo(() => isPackFinished(pack, usedIds), [pack, usedIds]);

  const standings = useMemo(
    () => teams.map((t, i) => ({ ...t, index: i })).sort((a, b) => b.score - a.score),
    [teams],
  );
  const topScore = standings[0]?.score ?? 0;
  const champions = useMemo(
    () => standings.filter((t) => t.score === topScore),
    [standings, topScore],
  );
  const isTie = champions.length > 1;

  /** Opens a tile and returns its question, so the caller can react to it. */
  const openTile = useCallback(
    (ci: number, qi: number): Question | null => {
      if (activeTile) return null;
      const q = pack.categories[ci]?.questions[qi];
      if (!q || usedIds.has(q.id)) return null;
      setActiveTile({ ci, qi });
      return q;
    },
    [activeTile, pack, usedIds],
  );

  const closeTile = useCallback(() => setActiveTile(null), []);

  /** Spends the tile and hands the pick to the next team. */
  const settleAndAdvance = useCallback(
    (questionId: string) => {
      setUsedIds((prev) => new Set(prev).add(questionId));
      setPickingIndex((prev) => (teams.length === 0 ? 0 : (prev + 1) % teams.length));
      setActiveTile(null);
    },
    [teams.length],
  );

  const award = useCallback(
    (teamIndex: number) => {
      const q = questionAt(activeTile);
      if (!q) return;
      const points = tileValue(q, doubleIds.has(q.id));
      setTeams((prev) =>
        prev.map((t, i) => (i === teamIndex ? { ...t, score: t.score + points } : t)),
      );
      settleAndAdvance(q.id);
    },
    [questionAt, activeTile, doubleIds, settleAndAdvance],
  );

  /** Nobody got it: the tile is spent, no score changes. */
  const markNoOne = useCallback(() => {
    const q = questionAt(activeTile);
    if (!q) return;
    settleAndAdvance(q.id);
  }, [questionAt, activeTile, settleAndAdvance]);

  const reset = useCallback(() => {
    setTeams((prev) => prev.map((t) => ({ ...t, score: 0 })));
    setUsedIds(new Set());
    setPickingIndex(0);
    setActiveTile(null);
    setDoubleIds(pickDoubleIds(pack, doubleCount, rng));
  }, [pack, doubleCount, rng]);

  const addTeam = useCallback(() => {
    setTeams((prev) =>
      prev.length >= MAX_TEAMS ? prev : [...prev, { name: `Lag ${prev.length + 1}`, score: 0 }],
    );
  }, []);

  const removeTeam = useCallback((index: number) => {
    setTeams((prev) => {
      if (prev.length <= MIN_TEAMS) return prev;
      const next = prev.filter((_, i) => i !== index);
      setPickingIndex((p) => (p >= next.length ? next.length - 1 : p));
      return next;
    });
  }, []);

  const renameTeam = useCallback((index: number, name: string) => {
    setTeams((prev) => prev.map((t, i) => (i === index ? { ...t, name } : t)));
  }, []);

  return {
    teams,
    pickingIndex,
    pickerName,
    usedIds,
    doubleIds,
    activeTile,
    activeQuestion,
    activeIsDouble,
    activePoints,
    activeCategoryName,
    isFinished,
    standings,
    topScore,
    champions,
    isTie,
    openTile,
    closeTile,
    award,
    markNoOne,
    reset,
    addTeam,
    removeTeam,
    renameTeam,
    setPickingIndex,
  };
}
