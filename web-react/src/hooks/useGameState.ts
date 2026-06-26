import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { ActiveQuestion, GameLogEntry, GameSettings, QuestionPack, TeamId } from '../types';
import { useLocalStorage } from './useLocalStorage';
import { isPackFinished, computeProgress } from '../utils/gameLogic';

interface PersistedState {
  packId: string;
  packVersion: string;
  scores: Record<string, number>;
  usedQuestionIds: string[];
  currentPickerIndex: number;
}

function makeInitialScores(teams: GameSettings['teams']): Record<TeamId, number> {
  return Object.fromEntries(teams.map((t) => [t.id, 0])) as Record<TeamId, number>;
}

interface UseGameStateResult {
  scores: Record<TeamId, number>;
  usedQuestionIds: Set<string>;
  currentPickerIndex: number;
  activeQuestion: ActiveQuestion | null;
  gameLog: GameLogEntry[];
  isFinished: boolean;
  progressPercent: number;
  hasSavedGame: boolean;
  setCurrentPickerIndex: (i: number) => void;
  openQuestion: (active: ActiveQuestion) => void;
  closeQuestion: () => void;
  awardWinner: (teamId: TeamId) => void;
  handleWrongPick: (stealTeamId?: TeamId | null) => void;
  markNoOne: () => void;
  resetGame: () => void;
  resumeGame: () => void;
}

export function useGameState(
  pack: QuestionPack,
  settings: GameSettings,
): UseGameStateResult {
  const [saved, setSaved] = useLocalStorage<PersistedState | null>(
    'jeoparty_game_state',
    null,
  );

  const hasSavedGame =
    saved !== null &&
    saved.packId === pack.id &&
    saved.packVersion === pack.version;

  const [scores, setScores] = useState<Record<TeamId, number>>(() =>
    makeInitialScores(settings.teams),
  );
  const [usedQuestionIds, setUsedIds] = useState<Set<string>>(() => new Set());
  const [currentPickerIndex, setCurrentPickerIndex] = useState(0);
  const [activeQuestion, setActiveQuestion] = useState<ActiveQuestion | null>(null);
  const [gameLog, setGameLog] = useState<GameLogEntry[]>([]);

  const isFinished = useMemo(
    () => isPackFinished(pack, usedQuestionIds),
    [pack, usedQuestionIds],
  );

  const progressPercent = useMemo(
    () => computeProgress(pack, usedQuestionIds),
    [pack, usedQuestionIds],
  );

  const packRef = useRef(pack);
  const scoresRef = useRef(scores);
  useLayoutEffect(() => {
    packRef.current = pack;
    scoresRef.current = scores;
  });

  const persist = useRef<(s: Record<TeamId, number>, ids: Set<string>, pickerIdx: number) => void>(
    (s, ids, pickerIdx) => {
      setSaved({
        packId: packRef.current.id,
        packVersion: packRef.current.version,
        scores: s as Record<string, number>,
        usedQuestionIds: Array.from(ids),
        currentPickerIndex: pickerIdx,
      });
    },
  );

  const openQuestion = useCallback((active: ActiveQuestion) => {
    setActiveQuestion(active);
  }, []);

  const closeQuestion = useCallback(() => {
    setActiveQuestion(null);
  }, []);

  const advancePicker = useCallback(
    (currentIdx: number) => {
      const next = (currentIdx + 1) % settings.teams.length;
      setCurrentPickerIndex(next);
      return next;
    },
    [settings.teams.length],
  );

  const awardWinner = useCallback(
    (teamId: TeamId) => {
      if (!activeQuestion) return;
      const { question, categoryName } = activeQuestion;

      setScores((prev) => {
        const next = { ...prev, [teamId]: (prev[teamId] ?? 0) + question.points };
        setUsedIds((prevIds) => {
          const nextIds = new Set(prevIds);
          nextIds.add(question.id);
          const nextPickerIdx = advancePicker(currentPickerIndex);
          persist.current(next, nextIds, nextPickerIdx);
          return nextIds;
        });
        return next;
      });

      setGameLog((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          questionId: question.id,
          categoryName,
          points: question.points,
          outcome: 'correct',
          teamId,
        },
      ]);
      setActiveQuestion(null);
    },
    [activeQuestion, currentPickerIndex, advancePicker],
  );

  const handleWrongPick = useCallback(
    (stealTeamId?: TeamId | null) => {
      if (!activeQuestion) return;
      const { question, categoryName } = activeQuestion;

      setScores((prev) => {
        let next = { ...prev };
        const picker = settings.teams[currentPickerIndex]?.id as TeamId | undefined;
        if (settings.negativeScoring && picker) {
          next = { ...next, [picker]: (next[picker] ?? 0) - question.points };
        }
        if (stealTeamId) {
          next = { ...next, [stealTeamId]: (next[stealTeamId] ?? 0) + question.points };
        }
        setUsedIds((prevIds) => {
          const nextIds = new Set(prevIds);
          nextIds.add(question.id);
          const nextPickerIdx = advancePicker(currentPickerIndex);
          persist.current(next, nextIds, nextPickerIdx);
          return nextIds;
        });
        return next;
      });

      setGameLog((prev) => [
        ...prev,
        {
          timestamp: Date.now(),
          questionId: question.id,
          categoryName,
          points: question.points,
          outcome: stealTeamId ? 'steal' : 'wrong',
          teamId: settings.teams[currentPickerIndex]?.id as TeamId ?? null,
          stealTeamId: stealTeamId ?? undefined,
        },
      ]);
      setActiveQuestion(null);
    },
    [activeQuestion, settings, currentPickerIndex, advancePicker],
  );

  const markNoOne = useCallback(() => {
    if (!activeQuestion) return;
    const { question, categoryName } = activeQuestion;

    setUsedIds((prevIds) => {
      const nextIds = new Set(prevIds);
      nextIds.add(question.id);
      const nextPickerIdx = advancePicker(currentPickerIndex);
      persist.current(scoresRef.current, nextIds, nextPickerIdx);
      return nextIds;
    });

    setGameLog((prev) => [
      ...prev,
      {
        timestamp: Date.now(),
        questionId: question.id,
        categoryName,
        points: question.points,
        outcome: 'no-one',
        teamId: null,
      },
    ]);
    setActiveQuestion(null);
  }, [activeQuestion, currentPickerIndex, advancePicker]);

  const resetGame = useCallback(() => {
    const fresh = makeInitialScores(settings.teams);
    setScores(fresh);
    setUsedIds(new Set());
    setCurrentPickerIndex(0);
    setActiveQuestion(null);
    setGameLog([]);
    setSaved(null);
  }, [settings.teams, setSaved]);

  const resumeGame = useCallback(() => {
    if (!hasSavedGame || !saved) return;
    setScores(saved.scores as Record<TeamId, number>);
    setUsedIds(new Set(saved.usedQuestionIds));
    setCurrentPickerIndex(saved.currentPickerIndex);
    setGameLog([]);
  }, [hasSavedGame, saved]);

  return {
    scores,
    usedQuestionIds,
    currentPickerIndex,
    activeQuestion,
    gameLog,
    isFinished,
    progressPercent,
    hasSavedGame,
    setCurrentPickerIndex,
    openQuestion,
    closeQuestion,
    awardWinner,
    handleWrongPick,
    markNoOne,
    resetGame,
    resumeGame,
  };
}
