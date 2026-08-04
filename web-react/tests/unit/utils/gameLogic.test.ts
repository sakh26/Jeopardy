import { describe, it, expect } from 'vitest';
import {
  mapPoints,
  computeProgress,
  isPackFinished,
  allQuestionIds,
  pickDoubleIds,
  tileValue,
} from '../../../src/utils/gameLogic';
import { MOCK_PACK } from '../../fixtures';

describe('pickDoubleIds', () => {
  const ids = allQuestionIds(MOCK_PACK);

  it('picks exactly the requested number', () => {
    expect(pickDoubleIds(MOCK_PACK, 2, () => 0).size).toBe(2);
    expect(pickDoubleIds(MOCK_PACK, 5, () => 0).size).toBe(5);
  });

  it('only picks tiles that exist in the pack', () => {
    for (const id of pickDoubleIds(MOCK_PACK, 3, () => 0.5)) {
      expect(ids).toContain(id);
    }
  });

  it('never picks the same tile twice', () => {
    const picked = pickDoubleIds(MOCK_PACK, 4, () => 0.7);
    expect(picked.size).toBe(4);
  });

  it('is deterministic for a given rng', () => {
    const a = [...pickDoubleIds(MOCK_PACK, 3, () => 0.25)];
    const b = [...pickDoubleIds(MOCK_PACK, 3, () => 0.25)];
    expect(a).toEqual(b);
  });

  it('cannot ask for more tiles than the board holds', () => {
    expect(pickDoubleIds(MOCK_PACK, 999, () => 0).size).toBe(ids.length);
  });

  it('handles a request for none, and an empty pack', () => {
    expect(pickDoubleIds(MOCK_PACK, 0, () => 0).size).toBe(0);
    const empty = { ...MOCK_PACK, categories: [] };
    expect(pickDoubleIds(empty, 2, () => 0).size).toBe(0);
  });
});

describe('tileValue', () => {
  const question = MOCK_PACK.categories[0]!.questions[0]!;

  it('is the face value on an ordinary tile', () => {
    expect(tileValue(question, false)).toBe(question.points);
  });

  it('doubles on a double-jeopardy tile', () => {
    expect(tileValue(question, true)).toBe(question.points * 2);
  });
});

describe('mapPoints', () => {
  const points: [number, number, number, number, number] = [100, 200, 300, 400, 500];

  it('maps level to correct point value', () => {
    const result = mapPoints(MOCK_PACK.categories, points);
    expect(result[0]?.questions[0]?.points).toBe(100); // level 1 → 100
    expect(result[0]?.questions[1]?.points).toBe(200); // level 2 → 200
    expect(result[0]?.questions[4]?.points).toBe(500); // level 5 → 500
  });

  it('falls back to level * 100 when pointsByLevel is too short', () => {
    const shortPoints: [number, number, number, number, number] = [100, 200, 300, 400, 500];
    const category = [{ name: 'Test', questions: [{ id: 'x', level: 3, points: 0, targetWord: 'hi' }] }];
    const result = mapPoints(category, shortPoints);
    expect(result[0]?.questions[0]?.points).toBe(300);
  });

  it('does not mutate the input categories', () => {
    const original = structuredClone(MOCK_PACK.categories);
    mapPoints(MOCK_PACK.categories, points);
    expect(MOCK_PACK.categories[0]?.questions[0]?.points).toBe(original[0]?.questions[0]?.points);
  });

  it('preserves all other question fields', () => {
    const result = mapPoints(MOCK_PACK.categories, points);
    const q = result[0]?.questions[0];
    expect(q?.id).toBe('a-1');
    expect(q?.targetWord).toBe('cat');
    expect(q?.songTitle).toBe('Cat Song');
  });
});

describe('computeProgress', () => {
  it('returns 0 when no questions are used', () => {
    expect(computeProgress(MOCK_PACK, new Set())).toBe(0);
  });

  it('returns 100 when all questions are used', () => {
    const allIds = MOCK_PACK.categories.flatMap((c) => c.questions.map((q) => q.id));
    expect(computeProgress(MOCK_PACK, new Set(allIds))).toBe(100);
  });

  it('returns 50 when half the questions are used', () => {
    const halfIds = MOCK_PACK.categories[0]!.questions.map((q) => q.id);
    expect(computeProgress(MOCK_PACK, new Set(halfIds))).toBe(50);
  });
});

describe('isPackFinished', () => {
  it('returns false when questions remain', () => {
    expect(isPackFinished(MOCK_PACK, new Set())).toBe(false);
  });

  it('returns true when all questions are used', () => {
    const allIds = MOCK_PACK.categories.flatMap((c) => c.questions.map((q) => q.id));
    expect(isPackFinished(MOCK_PACK, new Set(allIds))).toBe(true);
  });
});
