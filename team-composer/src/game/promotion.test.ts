import { describe, expect, it } from 'vitest';
import { absolutePromotionRank, getPromotionOptions, isPromotionMove } from './promotion';
import { getPieceDef } from './moveEngine';

describe('absolutePromotionRank', () => {
  it("is the board's own far rank (its height) for Player A", () => {
    expect(absolutePromotionRank('A', 8)).toBe(8);
  });

  it('is always rank 1 for Player B, whatever the height', () => {
    expect(absolutePromotionRank('B', 8)).toBe(1);
  });

  it('scales with a custom board height instead of assuming 8', () => {
    expect(absolutePromotionRank('A', 12)).toBe(12);
    expect(absolutePromotionRank('B', 12)).toBe(1);
    expect(absolutePromotionRank('A', 4)).toBe(4); // the minimum playable height
  });
});

describe('isPromotionMove', () => {
  it('is true when a promotable pawn reaches its promotion rank', () => {
    const pe = getPieceDef('PE');
    expect(isPromotionMove(pe, 'A', 'e8')).toBe(true);
    expect(isPromotionMove(pe, 'B', 'e1')).toBe(true);
  });

  it('is false when the destination is not the promotion rank', () => {
    const pe = getPieceDef('PE');
    expect(isPromotionMove(pe, 'A', 'e7')).toBe(false);
    expect(isPromotionMove(pe, 'B', 'e2')).toBe(false);
  });

  it('is false for a non-promotable piece even on the back rank', () => {
    const rook = getPieceDef('TO');
    expect(isPromotionMove(rook, 'A', 'e8')).toBe(false);
  });

  it('promotes at the true far rank of a custom board height, not the default 8', () => {
    const pe = getPieceDef('PE');
    const dims = { width: 8, height: 12 };
    expect(isPromotionMove(pe, 'A', 'e12', dims)).toBe(true);
    expect(isPromotionMove(pe, 'A', 'e8', dims)).toBe(false); // the old 8×8 far rank — no longer special here
    expect(isPromotionMove(pe, 'B', 'e1', dims)).toBe(true);
  });
});

describe('getPromotionOptions', () => {
  it('returns the classic Pawn\'s README-specified options (≤20pt base pieces), sorted by point cost', () => {
    expect(getPromotionOptions(getPieceDef('PE'))).toEqual(['PE', 'AL', 'CA', 'SP']); // 4, 10, 12, 15
  });

  it('returns only Damone for the Pedone di Dama (no player choice)', () => {
    expect(getPromotionOptions(getPieceDef('DA'))).toEqual(['DM']);
  });

  it('returns an empty list for a non-promotable piece', () => {
    expect(getPromotionOptions(getPieceDef('TO'))).toEqual([]);
  });

  it('sorts by point cost ascending even when promotionTypes is declared out of order', () => {
    const pieceDef = { ...getPieceDef('PE'), promotionTypes: ['SP', 'PE', 'CA', 'AL'] };
    expect(getPromotionOptions(pieceDef)).toEqual(['PE', 'AL', 'CA', 'SP']);
  });
});

describe('Damone (DM) — data sanity', () => {
  it('is flagged as obtainable only via promotion', () => {
    expect(getPieceDef('DM').obtainableOnlyViaPromotion).toBe(true);
  });

  it('has a positive point value even though it is never pickable during team-building', () => {
    expect(getPieceDef('DM').punti).toBeGreaterThan(0);
  });
});
