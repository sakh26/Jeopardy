import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGameState, MAX_TEAMS, MIN_TEAMS } from '../../../src/hooks/useGameState';
import { MOCK_PACK } from '../../fixtures';

// A fixed rng makes the double-jeopardy draw deterministic, so a test can say
// exactly which tile is worth double.
const fixedRng = () => 0;

type Hook = { current: ReturnType<typeof useGameState> };

function setup(options = {}) {
  return renderHook(() => useGameState(MOCK_PACK, { rng: fixedRng, ...options }));
}

function findTile(result: Hook, wantDouble: boolean) {
  for (let ci = 0; ci < MOCK_PACK.categories.length; ci++) {
    const questions = MOCK_PACK.categories[ci]!.questions;
    for (let qi = 0; qi < questions.length; qi++) {
      if (result.current.doubleIds.has(questions[qi]!.id) === wantDouble) {
        return { ci, qi, q: questions[qi]! };
      }
    }
  }
  throw new Error(`fant ingen ${wantDouble ? 'dobbeltrute' : 'vanlig rute'}`);
}

describe('useGameState — utgangspunkt', () => {
  it('starter med to lag på null poeng', () => {
    const { result } = setup();
    expect(result.current.teams).toHaveLength(2);
    expect(result.current.teams.every((t) => t.score === 0)).toBe(true);
  });

  it('starter uten brukte ruter og med lag 1 som velger', () => {
    const { result } = setup();
    expect(result.current.usedIds.size).toBe(0);
    expect(result.current.pickingIndex).toBe(0);
    expect(result.current.pickerName).toBe('Lag 1');
  });

  it('trekker det antallet dobbeltruter den blir bedt om', () => {
    const { result } = setup({ doubleCount: 3 });
    expect(result.current.doubleIds.size).toBe(3);
  });

  it('har ingen åpen rute før noen klikker', () => {
    const { result } = setup();
    expect(result.current.activeTile).toBeNull();
    expect(result.current.activeQuestion).toBeNull();
    expect(result.current.activePoints).toBe(0);
  });
});

describe('useGameState — å åpne en rute', () => {
  it('returnerer spørsmålet og gjør det aktivt', () => {
    const { result } = setup();
    let opened;
    act(() => { opened = result.current.openTile(0, 0); });
    expect(opened).toEqual(MOCK_PACK.categories[0]!.questions[0]);
    expect(result.current.activeQuestion?.id).toBe(MOCK_PACK.categories[0]!.questions[0]!.id);
    expect(result.current.activeCategoryName).toBe('Animals');
  });

  it('nekter å åpne en rute som allerede er brukt', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.award(0); });

    let second;
    act(() => { second = result.current.openTile(0, 0); });
    expect(second).toBeNull();
  });

  it('nekter å åpne en ny rute mens en er åpen', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });

    let second;
    act(() => { second = result.current.openTile(0, 1); });
    expect(second).toBeNull();
    expect(result.current.activeTile).toEqual({ ci: 0, qi: 0 });
  });

  it('returnerer null for en rute som ikke finnes', () => {
    const { result } = setup();
    let opened;
    act(() => { opened = result.current.openTile(99, 99); });
    expect(opened).toBeNull();
  });

  it('lukker uten å bruke opp ruta', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.closeTile(); });
    expect(result.current.activeTile).toBeNull();
    expect(result.current.usedIds.size).toBe(0);
  });
});

describe('useGameState — poeng', () => {
  it('gir ruta sin verdi til laget som klarte den', () => {
    const { result } = setup();
    const tile = findTile(result, false);
    act(() => { result.current.openTile(tile.ci, tile.qi); });
    act(() => { result.current.award(0); });

    expect(result.current.teams[0]!.score).toBe(tile.q.points);
    expect(result.current.teams[1]!.score).toBe(0);
  });

  it('gir dobbelt for en dobbeltrute', () => {
    const { result } = setup();
    const tile = findTile(result, true);
    act(() => { result.current.openTile(tile.ci, tile.qi); });
    expect(result.current.activeIsDouble).toBe(true);
    expect(result.current.activePoints).toBe(tile.q.points * 2);

    act(() => { result.current.award(1); });
    expect(result.current.teams[1]!.score).toBe(tile.q.points * 2);
  });

  it('bruker opp ruta og lukker den', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.award(0); });

    expect(result.current.usedIds.has(MOCK_PACK.categories[0]!.questions[0]!.id)).toBe(true);
    expect(result.current.activeTile).toBeNull();
  });

  it('gjør ingenting når ingen rute er åpen', () => {
    const { result } = setup();
    act(() => { result.current.award(0); });
    expect(result.current.teams[0]!.score).toBe(0);
    expect(result.current.usedIds.size).toBe(0);
  });

  it('lar «ingen klarte den» bruke opp ruta uten poeng', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.markNoOne(); });

    expect(result.current.teams.every((t) => t.score === 0)).toBe(true);
    expect(result.current.usedIds.size).toBe(1);
    expect(result.current.activeTile).toBeNull();
  });
});

describe('useGameState — hvem som velger', () => {
  it('går videre til neste lag etter poenggiving', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.award(0); });
    expect(result.current.pickingIndex).toBe(1);
  });

  it('går videre også når ingen klarte den', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.markNoOne(); });
    expect(result.current.pickingIndex).toBe(1);
  });

  it('går rundt til første lag igjen', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.award(0); });
    act(() => { result.current.openTile(0, 1); });
    act(() => { result.current.award(1); });
    expect(result.current.pickingIndex).toBe(0);
  });

  it('kan settes direkte av verten', () => {
    const { result } = setup();
    act(() => { result.current.setPickingIndex(1); });
    expect(result.current.pickerName).toBe('Lag 2');
  });
});

describe('useGameState — lag', () => {
  it('legger til lag opp til grensen', () => {
    const { result } = setup();
    for (let i = 0; i < 5; i++) act(() => { result.current.addTeam(); });
    expect(result.current.teams).toHaveLength(MAX_TEAMS);
  });

  it('fjerner lag, men aldri under minimum', () => {
    const { result } = setup();
    act(() => { result.current.addTeam(); });
    expect(result.current.teams).toHaveLength(3);

    act(() => { result.current.removeTeam(0); });
    expect(result.current.teams).toHaveLength(2);

    act(() => { result.current.removeTeam(0); });
    expect(result.current.teams).toHaveLength(MIN_TEAMS);
  });

  it('flytter velgeren innenfor når laget som velger fjernes', () => {
    const { result } = setup();
    act(() => { result.current.addTeam(); });
    act(() => { result.current.setPickingIndex(2); });
    act(() => { result.current.removeTeam(2); });
    expect(result.current.pickingIndex).toBe(1);
  });

  it('endrer navn', () => {
    const { result } = setup();
    act(() => { result.current.renameTeam(0, 'Lynet'); });
    expect(result.current.teams[0]!.name).toBe('Lynet');
    expect(result.current.pickerName).toBe('Lynet');
  });
});

describe('useGameState — stillingen og slutten', () => {
  it('sorterer laget med flest poeng øverst', () => {
    const { result } = setup();
    const tile = findTile(result, false);
    act(() => { result.current.openTile(tile.ci, tile.qi); });
    act(() => { result.current.award(1); });

    expect(result.current.standings[0]!.index).toBe(1);
    expect(result.current.topScore).toBe(tile.q.points);
    expect(result.current.isTie).toBe(false);
  });

  it('melder uavgjort når ingen har svart', () => {
    const { result } = setup();
    expect(result.current.isTie).toBe(true);
    expect(result.current.champions).toHaveLength(2);
  });

  it('er ikke ferdig før hver eneste rute er brukt', () => {
    const { result } = setup();
    expect(result.current.isFinished).toBe(false);

    for (let ci = 0; ci < MOCK_PACK.categories.length; ci++) {
      for (let qi = 0; qi < MOCK_PACK.categories[ci]!.questions.length; qi++) {
        act(() => { result.current.openTile(ci, qi); });
        act(() => { result.current.markNoOne(); });
      }
    }
    expect(result.current.isFinished).toBe(true);
  });
});

describe('useGameState — nullstilling', () => {
  it('nuller poeng, brukte ruter og turen', () => {
    const { result } = setup();
    act(() => { result.current.openTile(0, 0); });
    act(() => { result.current.award(0); });
    act(() => { result.current.reset(); });

    expect(result.current.teams.every((t) => t.score === 0)).toBe(true);
    expect(result.current.usedIds.size).toBe(0);
    expect(result.current.pickingIndex).toBe(0);
    expect(result.current.activeTile).toBeNull();
  });

  it('beholder lagnavnene', () => {
    const { result } = setup();
    act(() => { result.current.renameTeam(0, 'Lynet'); });
    act(() => { result.current.reset(); });
    expect(result.current.teams[0]!.name).toBe('Lynet');
  });
});
