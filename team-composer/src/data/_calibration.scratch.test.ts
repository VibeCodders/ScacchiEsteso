import { describe, it } from 'vitest';
import { estimatePunti } from './estimatePunti';
import { pieces } from './pieces';

describe('calibration scratch', () => {
  it('prints estimate vs actual for every piece', () => {
    for (const p of pieces) {
      const e = estimatePunti(p);
      console.log(`${p.sigla}\tactual=${p.punti}\tsuggested=${e.suggestedPunti}\twm=${e.breakdown.weightedMobility.toFixed(2)}\tcompound=${e.breakdown.compoundBonus}\tmech=${e.breakdown.specialMechanicBonus}`);
    }
  });
});
