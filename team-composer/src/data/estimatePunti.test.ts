import { describe, expect, it } from 'vitest';
import { estimatePunti, estimatorFitQuality } from './estimatePunti';
import { getPieceDef } from '../game/moveEngine';
import { pieces as ROSTER } from './pieces';

// Mobility-only pieces (no alternativeActions, no armatura) used as a regression guard on the
// stage-1 OLS fit. This roster's punti are hand-balanced, not derived from a formula, so a linear
// mobility model will never match exactly — these bounds were verified empirically against the
// live fit (see scripts/estimatePunti.ts) rather than picked to look nice on paper.
const PURE_MOBILITY_SIGLAS = ['CR', 'RI', 'AL', 'CA', 'TO', 'SP', 'RA'];

describe('estimatePunti — calibration sanity', () => {
  it.each(PURE_MOBILITY_SIGLAS)('suggests a value within a reasonable factor of the real punti for %s', (sigla) => {
    const piece = getPieceDef(sigla);
    const { suggestedPunti } = estimatePunti(piece);
    // Tighter band than the old single-coefficient model supported — a statistically-fit anchor
    // for manual review, still not a precise predictor (see estimatorFitQuality for the real
    // measured error across the whole roster).
    expect(suggestedPunti).toBeGreaterThanOrEqual(piece.punti * 0.8);
    expect(suggestedPunti).toBeLessThanOrEqual(piece.punti * 1.9);
  });
});

describe('estimatePunti — pawn-category pieces are no longer grossly overestimated', () => {
  it('Pedone (PE, actual 4) lands within a small absolute band, not the ~6x overestimate the old flat compound bonus produced', () => {
    const { suggestedPunti } = estimatePunti(getPieceDef('PE'));
    expect(Math.abs(suggestedPunti - 4)).toBeLessThanOrEqual(6);
  });

  it('Paggio and Fante (cheap pawn-category pieces) stay in single digits', () => {
    expect(estimatePunti(getPieceDef('PG')).suggestedPunti).toBeLessThan(10);
    expect(estimatePunti(getPieceDef('FG')).suggestedPunti).toBeLessThan(10);
  });
});

describe('estimatePunti — compound (multi-entry) pieces', () => {
  it('a multi-entry piece is pushed higher than its mobility contribution alone would suggest', () => {
    const paladino = getPieceDef('PA');
    const { suggestedPunti, breakdown } = estimatePunti(paladino);
    expect(breakdown.compoundContribution).toBeGreaterThan(0);
    expect(suggestedPunti).toBeGreaterThan(breakdown.mobilityContribution);
  });

  it('Paladino (fit exactly against its own training data) lands very close to its real punti (36)', () => {
    const { suggestedPunti } = estimatePunti(getPieceDef('PA'));
    expect(Math.abs(suggestedPunti - 36)).toBeLessThanOrEqual(5);
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

describe('estimatePunti — mechanic confidence', () => {
  it('a piece with armatura (single roster example) is flagged as low confidence', () => {
    const armored = ROSTER.find((p) => p.armatura);
    expect(armored).toBeDefined();
    const { breakdown } = estimatePunti(armored!);
    expect(breakdown.mechanicConfidence).toBe('low');
    expect(breakdown.lowConfidenceMechanics).toContain('armatura');
  });

  it('a pure-movement piece with no special mechanics is high confidence', () => {
    const { breakdown } = estimatePunti(getPieceDef('AL'));
    expect(breakdown.mechanicConfidence).toBe('high');
    expect(breakdown.lowConfidenceMechanics).toEqual([]);
  });
});

describe('estimatePunti — durability/utility features are no longer ignored', () => {
  it('higher resistance, all else equal, never lowers the suggestion', () => {
    const base = getPieceDef('AL');
    const tougher = { ...base, resistance: base.resistance + 5 };
    expect(estimatePunti(tougher).suggestedPunti).toBeGreaterThanOrEqual(estimatePunti(base).suggestedPunti);
  });

  it('more immunity types, all else equal, never lowers the suggestion', () => {
    const base = getPieceDef('AL');
    const moreImmune = { ...base, immunityTypes: [...base.immunityTypes, 'veleno', 'fuoco'] };
    expect(estimatePunti(moreImmune).suggestedPunti).toBeGreaterThanOrEqual(estimatePunti(base).suggestedPunti);
  });
});

describe('estimatorFitQuality — measures the model\'s real accuracy against the roster', () => {
  it('mean absolute percent error stays within a documented bound, catching silent regressions', () => {
    const quality = estimatorFitQuality();
    // Verified empirically (~29% at the time this was written) — a generous ceiling so ordinary
    // roster growth doesn't make this flaky, while still catching an actual regression in the fit.
    expect(quality.meanAbsolutePercentError).toBeLessThan(0.45);
  });

  it('reports the worst-fitting pieces for visibility, not just a single aggregate number', () => {
    const quality = estimatorFitQuality();
    expect(quality.worstFits.length).toBeGreaterThan(0);
    expect(quality.worstFits[0]).toHaveProperty('sigla');
    expect(quality.worstFits[0]).toHaveProperty('actual');
    expect(quality.worstFits[0]).toHaveProperty('suggested');
  });
});
