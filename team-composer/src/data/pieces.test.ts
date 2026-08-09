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
    // Torre (TO) and Spettro (SP) are both 15pt — the sigla must decide, not incidental array position.
    const to = pieces.find((p) => p.sigla === 'TO')!;
    const sp = pieces.find((p) => p.sigla === 'SP')!;
    expect(to.punti).toBe(sp.punti);

    expect(sortByPunti([to, sp])).toEqual([sp, to]); // 'SP' < 'TO'
    expect(sortByPunti([sp, to])).toEqual([sp, to]); // stable regardless of input order
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
    // SP=15, PE=4, CA=12, AL=10 — deliberately shuffled, not already in cost order
    expect(sortSiglasByPunti(['SP', 'PE', 'CA', 'AL'])).toEqual(['PE', 'AL', 'CA', 'SP']);
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

  it('breaks a point-cost tie by sigla, alphabetically (Torre and Spettro are both 15pt)', () => {
    expect(sortSiglasByPunti(['TO', 'SP'])).toEqual(['SP', 'TO']);
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
