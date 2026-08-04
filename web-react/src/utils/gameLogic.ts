import type { Category, Question, QuestionPack } from '../types';

export function mapPoints(
  categories: Category[],
  pointsByLevel: [number, number, number, number, number],
): Category[] {
  return categories.map((category) => ({
    ...category,
    questions: category.questions.map((q) => ({
      ...q,
      points: pointsByLevel[q.level - 1] ?? q.level * 100,
    })),
  }));
}

export function computeProgress(pack: QuestionPack, usedIds: Set<string>): number {
  const total = pack.categories.reduce((acc, c) => acc + c.questions.length, 0);
  if (total === 0) return 0;
  return Math.round((usedIds.size / total) * 100);
}

export function isPackFinished(pack: QuestionPack, usedIds: Set<string>): boolean {
  return pack.categories.every((c) =>
    c.questions.every((q) => usedIds.has(q.id)),
  );
}

export function allQuestionIds(pack: QuestionPack): string[] {
  return pack.categories.flatMap((c) => c.questions.map((q) => q.id));
}

/**
 * Picks the tiles that score double. Fisher–Yates rather than
 * `sort(() => Math.random() - 0.5)`, which is not a uniform shuffle and leaves
 * some tiles considerably likelier than others. `rng` is injectable so tests
 * can pin the outcome.
 */
export function pickDoubleIds(
  pack: QuestionPack,
  count: number,
  rng: () => number = Math.random,
): Set<string> {
  const ids = allQuestionIds(pack);
  for (let i = ids.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [ids[i], ids[j]] = [ids[j]!, ids[i]!];
  }
  return new Set(ids.slice(0, Math.max(0, Math.min(count, ids.length))));
}

/** What a tile is worth once the double-jeopardy multiplier is applied. */
export function tileValue(question: Question, isDouble: boolean): number {
  return question.points * (isDouble ? 2 : 1);
}

export function getQuestionById(pack: QuestionPack, id: string): Question | undefined {
  for (const category of pack.categories) {
    const q = category.questions.find((q) => q.id === id);
    if (q) return q;
  }
  return undefined;
}
