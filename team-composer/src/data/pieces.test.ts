import { describe, expect, it } from 'vitest';
import { pieces, pickablePieces, rules, sortByPunti, sortSiglasByPunti, scaleRulesForBoardSize } from './pieces';

describe('sortByPunti', () => {
  it('sorts a shuffled list of pieces ascending by point cost', () => {
    const shuffled = [...pickablePieces].sort(() => Math.random() - 0.5);
    const sorted = sortByPunti(shuffled);

    for (let i = 1; i < sorted.length; i++) {
      expect(sorted[i].punti).toBeGreaterThanOrEqual(sorted[i - 1].punti);
    }
  });

  it('does not mutate the input array', () => {
    const input = [pieces[2], pieces[0], pieces[1]];
    const originalOrder = [...input];
    sortByPunti(input);
    expect(input).toEqual(originalOrder);
  });

  it('the full piece roster and the pickable-only roster both come out ascending', () => {
    for (const list of [pieces, pickablePieces]) {
      const sorted = sortByPunti(list);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].punti).toBeGreaterThanOrEqual(sorted[i - 1].punti);
      }
    }
  });

  it('breaks a point-cost tie by sigla, alphabetically', () => {
    // Colosso (CO) and Tigre (TI) are tied on punti — the sigla must decide, not incidental array
    // position. (Not hardcoded to a specific pair of siglas being tied at a specific value: that
    // relationship drifts every time punti values are rebalanced, e.g. after re-running the punti
    // estimator — this test just needs *some* tied pair, found dynamically below.)
    const puntiCounts = new Map<number, string[]>();
    for (const p of pieces) puntiCounts.set(p.punti, [...(puntiCounts.get(p.punti) ?? []), p.sigla]);
    const tiedSiglas = [...puntiCounts.values()].find((siglas) => siglas.length >= 2)!;
    expect(tiedSiglas).toBeDefined();
    const [siglaA, siglaB] = [...tiedSiglas].sort().slice(0, 2);
    const a = pieces.find((p) => p.sigla === siglaA)!;
    const b = pieces.find((p) => p.sigla === siglaB)!;
    expect(a.punti).toBe(b.punti);

    expect(sortByPunti([b, a])).toEqual([a, b]); // alphabetical tie-break
    expect(sortByPunti([a, b])).toEqual([a, b]); // stable regardless of input order
  });

  it('never leaves two equal-punti pieces in non-alphabetical order anywhere in a full sort', () => {
    const sorted = sortByPunti(pieces);
    for (let i = 1; i < sorted.length; i++) {
      if (sorted[i].punti === sorted[i - 1].punti) {
        expect(sorted[i].sigla >= sorted[i - 1].sigla).toBe(true);
      }
    }
  });
});

describe('sortSiglasByPunti', () => {
  it('sorts siglas ascending by the point cost of the piece they name', () => {
    // SP=17, PE=7, CA=15, AL=19 — deliberately shuffled, not already in cost order
    expect(sortSiglasByPunti(['SP', 'PE', 'CA', 'AL'])).toEqual(['PE', 'CA', 'SP', 'AL']);
  });

  it('does not mutate the input array', () => {
    const input = ['TO', 'RE', 'PE'];
    const originalOrder = [...input];
    sortSiglasByPunti(input);
    expect(input).toEqual(originalOrder);
  });

  it('is a no-op on an empty list', () => {
    expect(sortSiglasByPunti([])).toEqual([]);
  });

  it('breaks a point-cost tie by sigla, alphabetically (Torre and Orfano are both 26pt)', () => {
    expect(sortSiglasByPunti(['TO', 'OR'])).toEqual(['OR', 'TO']);
  });
});

describe('scaleRulesForBoardSize', () => {
  it('leaves budget and maxPiecesTotal unchanged for the classic 8×8 board', () => {
    const scaled = scaleRulesForBoardSize(rules, { width: 8, height: 8 });
    expect(scaled.budget).toBe(rules.budget);
    expect(scaled.maxPiecesTotal).toBe(rules.maxPiecesTotal);
  });

  it('doubles budget and maxPiecesTotal when the board area doubles', () => {
    const scaled = scaleRulesForBoardSize(rules, { width: 16, height: 8 }); // 128 squares vs 64
    expect(scaled.budget).toBe(rules.budget * 2);
    expect(scaled.maxPiecesTotal).toBe(rules.maxPiecesTotal * 2);
  });

  it('halves budget and maxPiecesTotal (rounded) for a smaller board', () => {
    const scaled = scaleRulesForBoardSize(rules, { width: 4, height: 8 }); // 32 squares — half the area
    expect(scaled.budget).toBe(Math.round(rules.budget / 2));
    expect(scaled.maxPiecesTotal).toBe(Math.round(rules.maxPiecesTotal / 2));
  });

  it('leaves every other rule (max identical, per-category caps) untouched', () => {
    const scaled = scaleRulesForBoardSize(rules, { width: 20, height: 20 });
    expect(scaled.maxIdenticalDefault).toBe(rules.maxIdenticalDefault);
    expect(scaled.maxIdenticalByCategory).toEqual(rules.maxIdenticalByCategory);
    expect(scaled.maxCountByCategory).toEqual(rules.maxCountByCategory);
    expect(scaled.kingSigla).toBe(rules.kingSigla);
  });

  it('does not mutate the input rules object', () => {
    const original = { ...rules };
    scaleRulesForBoardSize(rules, { width: 12, height: 12 });
    expect(rules).toEqual(original);
  });
});

describe('rules.budget — matches a full classic chess army', () => {
  it('equals the punti sum of one Re, 8 Pedone, 2 Torre, 2 Cavallo, 2 Alfiere and 1 Regina (classic config)', () => {
    // The default budget is defined to be exactly what it costs to field a complete classic
    // chess army (the pieces flagged `classico: true`, in their standard chess quantities) — not
    // an arbitrary round number. This test pins that relationship down so it can't silently drift
    // out of sync the next time punti values change (e.g. after re-running the punti estimator).
    const classicArmyComposition: Record<string, number> = { RE: 1, PE: 8, TO: 2, CA: 2, AL: 2, RA: 1 };
    const classicArmyCost = Object.entries(classicArmyComposition).reduce((sum, [sigla, count]) => {
      const piece = pieces.find((p) => p.sigla === sigla);
      expect(piece).toBeDefined();
      expect(piece!.classico).toBe(true);
      return sum + piece!.punti * count;
    }, 0);
    expect(rules.budget).toBe(classicArmyCost);
  });
});
