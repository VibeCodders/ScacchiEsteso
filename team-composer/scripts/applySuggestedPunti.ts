import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { estimatePunti } from '../src/data/estimatePunti';
import { pieces } from '../src/data/pieces';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PIECES_JSON_PATH = path.join(__dirname, '../src/data/pieces.json');

/**
 * Snapshots `estimatePunti`'s current suggestions into pieces.json's `punti` field for every piece
 * except the King (RE, a fixed nominal budget-sizing cost, not part of the stage-1 training set —
 * see `stage1TrainingSet` in estimatePunti.ts). Does a targeted regex replace on the raw JSON text
 * rather than `JSON.stringify`-ing the whole file back out, so the diff only touches the `punti`
 * numbers and doesn't reformat the file's existing compact per-move-entry style. Run with
 * `npx tsx scripts/applySuggestedPunti.ts` — this is the one-off "apply a balance pass" step the
 * estimator itself deliberately never does on its own (see its docstring).
 */
function main() {
  let raw = fs.readFileSync(PIECES_JSON_PATH, 'utf-8');
  let changed = 0;

  for (const piece of pieces) {
    // RE: a fixed nominal budget-sizing cost, not part of the stage-1 training set — a fixed 15 by
    // design, never estimator-driven. The Ghoul (GH) IS included: it carries a real material score
    // on the board, so its punti is estimator-priced like every other piece (see `stage1TrainingSet`
    // in estimatePunti.ts).
    if (piece.sigla === 'RE') continue;
    const { suggestedPunti } = estimatePunti(piece);
    if (suggestedPunti === piece.punti) continue;

    const pattern = new RegExp(`("sigla":\\s*"${piece.sigla}"[\\s\\S]*?"punti":\\s*)\\d+`);
    if (!pattern.test(raw)) {
      console.warn(`WARNING: could not locate "punti" field for ${piece.sigla} in pieces.json — skipped`);
      continue;
    }
    raw = raw.replace(pattern, `$1${suggestedPunti}`);
    console.log(`${piece.sigla}: ${piece.punti} -> ${suggestedPunti}`);
    changed++;
  }

  fs.writeFileSync(PIECES_JSON_PATH, raw, 'utf-8');
  console.log(`\n${changed} pieces updated.`);
}

main();
