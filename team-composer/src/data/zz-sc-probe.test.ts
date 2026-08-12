import { describe, expect, it } from 'vitest';
import { estimatePunti, estimatorFitQuality, mechanicBonusSummary } from './estimatePunti';
import { getPieceDef } from '../game/moveEngine';

describe('zz probe SC', () => {
  it('prints SC estimate', () => {
    const sc = estimatePunti(getPieceDef('SC'));
    console.log('SC estimate:', JSON.stringify({ suggested: sc.suggestedPunti, mobility: sc.breakdown.mobilityContribution, compound: sc.breakdown.compoundContribution, mechanic: sc.breakdown.specialMechanicBonus, confidence: sc.breakdown.mechanicConfidence, lowConf: sc.breakdown.lowConfidenceMechanics }, null, 2));
    const q = estimatorFitQuality();
    console.log('fit quality:', JSON.stringify({ mae: q.meanAbsoluteError, mape: q.meanAbsolutePercentError, loo: q.looMeanAbsoluteError, worst: q.worstFits.slice(0, 5) }, null, 2));
    const table = mechanicBonusSummary();
    console.log('mechanic summary SC row:', JSON.stringify(table['sciacallaggio'] ?? 'NOT FOUND', null, 2));
    expect(sc.suggestedPunti).toBeGreaterThan(0);
  });
});
