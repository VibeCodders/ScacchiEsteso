import { findSimilarPiecePairs, DEFAULT_SIMILARITY_THRESHOLD } from '../src/data/similarPieces';
import type { Piece } from '../src/types';

function describePiece(p: Piece): string {
  return `${p.sigla} (${p.descrizione}, ${p.punti}pt)`;
}

/** Prints near-duplicate roster pieces (see `src/data/similarPieces.ts` for the metric). Run with
 *  `npx tsx scripts/findSimilarPieces.ts [soglia]`. Same analysis backs the "Pezzi simili" screen
 *  in the app — this is the CLI entry point for the same shared module. */
function main() {
  const threshold = process.argv[2] ? Number(process.argv[2]) : DEFAULT_SIMILARITY_THRESHOLD;
  const { pairs, comparedPieceCount } = findSimilarPiecePairs();
  const flagged = pairs.filter((p) => p.distance <= threshold);
  const toShow = flagged.length > 0 ? flagged : pairs.slice(0, 10);

  console.log(`Soglia: distanza <= ${threshold.toFixed(2)} (passa un numero come argomento per cambiarla).`);
  if (flagged.length === 0) {
    console.log('Nessuna coppia sotto la soglia — mostro comunque le 10 coppie più simili in assoluto.\n');
  } else {
    console.log(`${flagged.length} coppie di pezzi molto simili trovate su ${pairs.length} coppie confrontate (${comparedPieceCount} pezzi, Re escluso).\n`);
  }

  for (const { a, b, distance, featureDiffs, differingMechanicTypes } of toShow) {
    console.log(`${describePiece(a)}  ~  ${describePiece(b)}   distanza=${distance.toFixed(2)}`);
    if (featureDiffs.length === 0) {
      console.log('    identici su tutte le feature di mobilità/struttura considerate');
    } else {
      for (const d of featureDiffs) {
        console.log(`    ${d.name}: differenza ${d.diff > 0 ? '+' : ''}${d.diff.toFixed(2)} (${a.sigla} rispetto a ${b.sigla})`);
      }
    }
    if (differingMechanicTypes.length > 0) console.log(`    meccaniche non condivise: ${differingMechanicTypes.join(', ')}`);
    console.log('');
  }
}

main();
