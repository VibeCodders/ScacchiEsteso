import { estimatePunti } from '../src/data/estimatePunti';
import { pieces } from '../src/data/pieces';
import type { Piece } from '../src/types';

/** Drafts for the 6 newly-designed pieces (punti left at 0 — this is exactly what the estimator
 *  is for). Run with `npx tsx scripts/estimatePunti.ts` to print suggestions, or
 *  `npx tsx scripts/estimatePunti.ts --roster` to sanity-check the calibration against every
 *  existing piece's real punti. */
const NEW_PIECE_DRAFTS: Piece[] = [
  {
    sigla: 'DU', descrizione: 'Duca', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [],
    moves: [{ directions: ['ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 1, capture: true, captureMode: 'melee', movementType: 'step' }],
  },
  {
    sigla: 'EL', descrizione: 'Elefante', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [],
    moves: [{ directions: ['ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 2, capture: true, captureMode: 'leap', movementType: 'leap', jump: true }],
  },
  {
    sigla: 'GE', descrizione: 'Generale', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [],
    moves: [
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 1, capture: true, captureMode: 'melee', movementType: 'step' },
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 0, capture: true, captureMode: 'leap', movementType: 'leap', jump: true, leapPattern: 'L' },
    ],
  },
  {
    sigla: 'TI', descrizione: 'Tigre', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [],
    moves: [
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 1, capture: true, captureMode: 'melee', movementType: 'step' },
      { directions: ['n', 's', 'e', 'w'], minSteps: 1, maxSteps: 99, capture: true, captureMode: 'melee', movementType: 'slide' },
    ],
  },
  {
    sigla: 'RN', descrizione: 'Rinoceronte', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [],
    moves: [
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 1, capture: true, captureMode: 'melee', movementType: 'step' },
      { directions: ['ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 99, capture: true, captureMode: 'melee', movementType: 'slide' },
    ],
  },
  {
    sigla: 'CN', descrizione: 'Coniglio', punti: 0, categoria: 'base', classico: false,
    regole: '', resistance: 0, immunityTypes: [], alternativeActions: [], catenaSaltiConCatturaFinale: true,
    moves: [
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 1, capture: true, captureMode: 'melee', movementType: 'step' },
      { directions: ['n', 's', 'e', 'w', 'ne', 'nw', 'se', 'sw'], minSteps: 1, maxSteps: 0, capture: true, captureMode: 'leap', movementType: 'leap', jump: true },
    ],
  },
];

function printTable(rows: { sigla: string; actual?: number; suggested: number; wm: number }[]) {
  for (const row of rows) {
    const actualCol = row.actual === undefined ? '' : `\tactual=${row.actual}`;
    console.log(`${row.sigla}\tsuggested=${row.suggested}${actualCol}\tweightedMobility=${row.wm.toFixed(2)}`);
  }
}

function main() {
  const mode = process.argv.includes('--roster') ? 'roster' : 'new';
  if (mode === 'roster') {
    printTable(pieces.map((p) => {
      const e = estimatePunti(p);
      return { sigla: p.sigla, actual: p.punti, suggested: e.suggestedPunti, wm: e.breakdown.weightedMobility };
    }));
  } else {
    printTable(NEW_PIECE_DRAFTS.map((p) => {
      const e = estimatePunti(p);
      return { sigla: p.sigla, suggested: e.suggestedPunti, wm: e.breakdown.weightedMobility };
    }));
  }
}

main();
