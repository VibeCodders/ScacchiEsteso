import { describe, expect, it } from 'vitest';
import { stage2ModelSummary, mechanicBonusSummary, estimatePunti, estimatorFitQuality, predictMechanicBonus } from './estimatePunti';
import { getPieceDef } from '../game/moveEngine';

describe('zz probe SC=27 basin', () => {
  it('dumps state', () => {
    const summary = stage2ModelSummary();
    console.log('lambda:', summary.lambda, 'loo:', summary.looMeanAbsoluteError.toFixed(4));
    const conv = summary.features.find((f) => f.name.includes('Conversione'))!;
    console.log('isConversion coef:', conv.coefficient.toFixed(4));
    const table = mechanicBonusSummary();
    for (const [type, e] of Object.entries(table)) {
      if (['sciacallaggio', 'conversione_ghoul', 'rianimazione_pedone'].includes(type)) {
        console.log(`bonus ${type}: value=${e.value.toFixed(2)} raw=${e.rawValue.toFixed(2)} pred=${e.predictedValue.toFixed(2)}`);
      }
    }
    console.log('conversion vs plain:', predictMechanicBonus({ type: 'conversione_ghoul', modalita: 'sul_cattura', params: { target: 'nemico_catturato', conversioneAlleato: true } }).toFixed(3), predictMechanicBonus({ type: 'cattura_semplice', modalita: 'sul_cattura', params: {} }).toFixed(3));
    const sc = estimatePunti(getPieceDef('SC'));
    console.log('SC estimate:', sc.suggestedPunti, 'mechanic:', sc.breakdown.specialMechanicBonus.toFixed(2));
    const rp = estimatePunti(getPieceDef('RP'));
    const br = estimatePunti(getPieceDef('BR'));
    console.log('RP estimate:', rp.suggestedPunti, 'BR estimate:', br.suggestedPunti);
    const q = estimatorFitQuality();
    console.log('fit mae:', q.meanAbsoluteError, 'mape:', q.meanAbsolutePercentError, 'loo:', q.looMeanAbsoluteError);
    expect(sc.suggestedPunti).toBe(getPieceDef('SC').punti);
  });
});
