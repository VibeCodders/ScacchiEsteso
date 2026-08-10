import { describe, expect, it } from 'vitest';
import { estimatePunti, estimatorFitQuality, mechanicBonusSummary, predictMechanicBonus, stage2ModelSummary } from './estimatePunti';
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
    // Widened from the pre-ridge bounds (0.8x/1.9x) — the ridge penalty (see `fitStage1`) is
    // chosen to minimize leave-one-out error, i.e. it deliberately trades a bit of accuracy on
    // any single training piece for coefficients that don't swing wildly on unseen ones, so
    // individual pieces can now sit a bit further from their hand-balanced value than an
    // unregularized fit would put them. Verified empirically against the live fit (see
    // scripts/estimatePunti.ts) rather than picked to look nice on paper.
    expect(suggestedPunti).toBeGreaterThanOrEqual(piece.punti * 0.7);
    expect(suggestedPunti).toBeLessThanOrEqual(piece.punti * 2.4);
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
  it('a multi-entry piece is pushed higher than a single-entry version of the same piece', () => {
    const paladino = getPieceDef('PA');
    const { suggestedPunti, breakdown } = estimatePunti(paladino);
    expect(breakdown.compoundContribution).toBeGreaterThan(0);
    // Comparing against `breakdown.mobilityContribution` directly is fragile now that the
    // breakdown only surfaces the mobility+compound terms, not the intercept or the
    // durability/utility terms that also feed the final estimate — so instead we compare against
    // the estimate for a piece stripped down to just its first move entry, which isolates exactly
    // what the extra entries are worth.
    const singleEntry = { ...paladino, moves: [paladino.moves[0]] };
    expect(suggestedPunti).toBeGreaterThan(estimatePunti(singleEntry).suggestedPunti);
  });

  it('Paladino lands within a documented band of its real punti', () => {
    const paladino = getPieceDef('PA');
    const { suggestedPunti } = estimatePunti(paladino);
    // Widened from ±5 — the ridge penalty (see the calibration-sanity band above) trades
    // per-piece training accuracy for cross-validated stability, so even a piece inside the
    // training set no longer fits as tightly as an unregularized OLS would. Verified empirically.
    expect(Math.abs(suggestedPunti - paladino.punti)).toBeLessThanOrEqual(13);
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

describe('estimatePunti — new pieces produce non-zero, distinct suggestions', () => {
  it('the 6 new pieces have plausible relative ordering (Duca cheapest, Tigre priciest)', () => {
    const du = estimatePunti(getPieceDef('DU')).suggestedPunti;
    const el = estimatePunti(getPieceDef('EL')).suggestedPunti;
    const ti = estimatePunti(getPieceDef('TI')).suggestedPunti;

    expect(du).toBeGreaterThanOrEqual(1);
    expect(du).toBeLessThan(el);
    expect(el).toBeLessThan(ti);
  });
});

describe('estimatePunti — floor', () => {
  it('never suggests 0 punti for any roster piece — a free piece makes no sense', () => {
    for (const piece of ROSTER) {
      if (piece.sigla === 'RE') continue;
      expect(estimatePunti(piece).suggestedPunti).toBeGreaterThanOrEqual(1);
    }
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

  it('reports a leave-one-out cross-validated error, the honest generalization measure', () => {
    const quality = estimatorFitQuality();
    // LOO error is expected to run a bit higher than in-sample error (it's evaluated on pieces
    // excluded from their own fit) — verified empirically (~7.2 punti at the time this was
    // written) against a ~24-piece stage-1 training set; a generous ceiling so ordinary roster
    // growth doesn't make this flaky, while still catching a real regression.
    expect(quality.looMeanAbsoluteError).toBeGreaterThan(0);
    expect(quality.looMeanAbsoluteError).toBeLessThan(12);
  });

  it('reports the worst-fitting pieces for visibility, not just a single aggregate number', () => {
    const quality = estimatorFitQuality();
    expect(quality.worstFits.length).toBeGreaterThan(0);
    expect(quality.worstFits[0]).toHaveProperty('sigla');
    expect(quality.worstFits[0]).toHaveProperty('actual');
    expect(quality.worstFits[0]).toHaveProperty('suggested');
  });
});

describe('mechanicBonusSummary — empirical-Bayes shrinkage on single-example mechanic bonuses', () => {
  it('a mechanic type backed by a single roster example is pulled strictly toward the stage-2 model prediction', () => {
    // Background shrunk toward changed from a flat global mean to the stage-2 parametric model's
    // own prediction (`predictedValue`) — see `shrinkMechanicBonus`.
    const table = mechanicBonusSummary();
    const singleExampleEntry = Object.values(table).find((e) => e.sampleCount === 1);
    expect(singleExampleEntry).toBeDefined();
    const { value, rawValue, predictedValue } = singleExampleEntry!;

    if (Math.abs(rawValue - predictedValue) > 1e-9) {
      const [lo, hi] = rawValue < predictedValue ? [rawValue, predictedValue] : [predictedValue, rawValue];
      expect(value).toBeGreaterThan(lo);
      expect(value).toBeLessThan(hi);
    }
  });
});

describe('stage2ModelSummary — parametric mechanic-bonus model', () => {
  it('exposes one coefficient per stage-2 feature', () => {
    const summary = stage2ModelSummary();
    // Intercept + radius + directionCount + intensity + targetsAllies + isPassive + isOnCapture.
    expect(summary.features).toHaveLength(7);
    expect(summary.features.every((f) => Number.isFinite(f.coefficient))).toBe(true);
    expect(Number.isFinite(summary.lambda)).toBe(true);
    expect(Number.isFinite(summary.shrinkageK)).toBe(true);
    expect(Number.isFinite(summary.looMeanAbsoluteError)).toBe(true);
  });
});

describe('predictMechanicBonus — extrapolation to mechanic types outside the roster', () => {
  it('produces a finite, plausible bonus for a mechanic type never seen in pieces.json', () => {
    const bonus = predictMechanicBonus({
      type: 'tipo_mai_visto_nel_roster',
      modalita: 'passiva',
      params: { raggio: 2, direzioni: ['n', 's', 'e', 'w'] },
    });
    expect(Number.isFinite(bonus)).toBe(true);
    // A special mechanic should plausibly add value, not swing to an absurd extreme — loosely
    // bounded against the scale of real roster punti values rather than an exact number, since the
    // model is extrapolating from just 11 training rows.
    expect(bonus).toBeGreaterThan(-20);
    expect(bonus).toBeLessThan(40);
  });

  it('produces a finite bonus even for an action with no recognizable params', () => {
    const bonus = predictMechanicBonus({ type: 'altro_tipo_ignoto', modalita: 'alternativa', params: {} });
    expect(Number.isFinite(bonus)).toBe(true);
  });
});

describe('estimatePunti — confidence interval', () => {
  it('brackets the suggested value for every roster piece', () => {
    for (const piece of ROSTER) {
      if (piece.sigla === 'RE') continue;
      const { suggestedPunti, confidenceInterval } = estimatePunti(piece);
      expect(confidenceInterval.low).toBeLessThanOrEqual(suggestedPunti);
      expect(confidenceInterval.high).toBeGreaterThanOrEqual(suggestedPunti);
    }
  });

  it('margin of error is never negative, and is not smaller for a low-confidence mechanic piece than for a pure-movement piece', () => {
    const pureMovement = estimatePunti(getPieceDef('AL'));
    const armored = estimatePunti(ROSTER.find((p) => p.armatura)!);
    expect(pureMovement.marginOfError).toBeGreaterThanOrEqual(0);
    expect(armored.marginOfError).toBeGreaterThanOrEqual(0);
    expect(armored.marginOfError).toBeGreaterThanOrEqual(pureMovement.marginOfError);
  });
});
