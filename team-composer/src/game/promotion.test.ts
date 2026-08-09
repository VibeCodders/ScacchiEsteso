import { describe, expect, it } from 'vitest';
import { absolutePromotionRank, getPromotionOptions, isPromotionMove } from './promotion';
import { getPieceDef } from './moveEngine';

describe('absolutePromotionRank', () => {
  it('is the piece\'s own promotionRank for Player A', () => {
    expect(absolutePromotionRank('A', 8)).toBe(8);
  });

  it('is mirrored (9 - rank) for Player B', () => {
    expect(absolutePromotionRank('B', 8)).toBe(1);
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
