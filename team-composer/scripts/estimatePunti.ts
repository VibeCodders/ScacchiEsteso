import { estimatePunti, estimatorFitQuality } from '../src/data/estimatePunti';
import { pieces } from '../src/data/pieces';

/** Prints the estimator's suggestion vs. the real roster punti for every piece, plus a fit-quality
 *  summary. Run with `npx tsx scripts/estimatePunti.ts`. Reads live from pieces.json — deliberately
 *  has no separate hardcoded piece list to keep in sync, since that's exactly the kind of staleness
 *  this script used to suffer from. */
function main() {
  for (const p of pieces) {
    if (p.sigla === 'RE') continue; // fixed 0 by design, excluded from the fit — not informative here
    const e = estimatePunti(p);
    const delta = e.suggestedPunti - p.punti;
    const sign = delta > 0 ? '+' : '';
    console.log(`${p.sigla}\tactual=${p.punti}\tsuggested=${e.suggestedPunti}\t(${sign}${delta})\tstepSlide=${e.breakdown.stepSlideMobility.toFixed(2)}\tleap=${e.breakdown.leapMobility.toFixed(2)}`);
  }

  const quality = estimatorFitQuality();
  console.log('\n--- fit quality ---');
  console.log(`mean absolute error: ${quality.meanAbsoluteError.toFixed(2)} punti`);
  console.log(`mean absolute percent error: ${(quality.meanAbsolutePercentError * 100).toFixed(1)}%`);
  console.log('worst fits:', quality.worstFits.map((f) => `${f.sigla} (actual ${f.actual}, suggested ${f.suggested})`).join(', '));
}

main();
