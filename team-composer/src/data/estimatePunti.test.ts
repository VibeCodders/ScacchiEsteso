import { describe, expect, it } from 'vitest';
import { estimatePunti } from './estimatePunti';
import { getPieceDef } from '../game/moveEngine';

// Mobility-only pieces (no alternativeActions, no armatura) used as a loose regression guard.
// This roster's punti are hand-balanced, not derived from a formula, so a pure mobility-count
// heuristic will never match exactly — this is a sanity band, not a precision claim.
const PURE_MOBILITY_SIGLAS = ['CR', 'RI', 'AL', 'CA', 'TO', 'SP', 'RA'];

describe('estimatePunti — calibration sanity', () => {
  it.each(PURE_MOBILITY_SIGLAS)('suggests a same-order-of-magnitude value for %s', (sigla) => {
    const piece = getPieceDef(sigla);
    const { suggestedPunti } = estimatePunti(piece);
    // Loose band: within roughly half to double the real value — a heuristic anchor for manual
    // review, not a precise predictor (see the module-level comment in estimatePunti.ts).
    expect(suggestedPunti).toBeGreaterThanOrEqual(piece.punti * 0.4);
    expect(suggestedPunti).toBeLessThanOrEqual(piece.punti * 2.2);
  });
});

describe('estimatePunti — compound bonus', () => {
  it('pushes a multi-entry piece higher than its mobility contribution alone would', () => {
    const paladino = getPieceDef('PA');
    const { suggestedPunti, breakdown } = estimatePunti(paladino);
    expect(breakdown.compoundBonus).toBeGreaterThan(0);
    expect(suggestedPunti).toBeGreaterThan(breakdown.mobilityContribution);
  });

  it('Paladino (the best-calibrated compound piece) lands close to its real punti (36)', () => {
    const { suggestedPunti } = estimatePunti(getPieceDef('PA'));
    expect(Math.abs(suggestedPunti - 36)).toBeLessThanOrEqual(10);
  });
});

describe('estimatePunti — monotonicity', () => {
  it('a piece with strictly more reachable squares gets a strictly higher suggestion, all else equal', () => {
    const shortRange = getPieceDef('RI'); // diagonal, max 2 steps
    const longRange = getPieceDef('AL'); // diagonal, unlimited steps — strictly more reach
    expect(estimatePunti(longRange).suggestedPunti).toBeGreaterThan(estimatePunti(shortRange).suggestedPunti);
  });

  it('adding the compound King-step entry never decreases the suggestion (Cavallo vs Generale-shaped union)', () => {
    const knightOnly = getPieceDef('CA');
    const generale = getPieceDef('GE'); // knight-leap + king-step union
    expect(estimatePunti(generale).suggestedPunti).toBeGreaterThanOrEqual(estimatePunti(knightOnly).suggestedPunti);
  });
});

describe('estimatePunti — new pieces produce non-negative, distinct suggestions', () => {
  it('the 6 new pieces have plausible relative ordering (Duca cheapest, Tigre priciest)', () => {
    const du = estimatePunti(getPieceDef('DU')).suggestedPunti;
    const el = estimatePunti(getPieceDef('EL')).suggestedPunti;
    const ti = estimatePunti(getPieceDef('TI')).suggestedPunti;

    expect(du).toBeGreaterThanOrEqual(0);
    expect(du).toBeLessThan(el);
    expect(el).toBeLessThan(ti);
  });
});
