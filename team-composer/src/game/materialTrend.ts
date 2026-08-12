import { computeMaterialScore } from './antiStalemate';
import { getPieceDef } from './moveEngine';
import { GHOUL_SIGLA } from './vampire';
import type { GameState, HistoryEntry } from './turnManager';
import type { Owner } from './board';

/** Material score of each owner after `ply` plies (0 = the initial position, before any move). */
export interface MaterialPoint {
  ply: number;
  A: number;
  B: number;
}

function punti(sigla: string): number {
  return getPieceDef(sigla).punti;
}

/** The material delta each owner suffers from one history entry (README: punti of on-board pieces). */
function entryDelta(entry: HistoryEntry): { dA: number; dB: number } {
  let dA = 0;
  let dB = 0;
  const add = (owner: Owner, delta: number) => {
    if (owner === 'A') dA += delta;
    else dB += delta;
  };
  const opponent: Owner = entry.owner === 'A' ? 'B' : 'A';

  // A real capture (melee, scocca, Coniglio's final hop, en passant) removes the victim's punti —
  // a Miraggio clone is an illusion worth nothing, so it never changes material.
  if (entry.isCapture && entry.capturedSigla && !entry.isCloneCapture) {
    add(opponent, -punti(entry.capturedSigla));
  }
  // A Vampiro Lunare's conversion swaps the victim for an allied Ghoul: the enemy's
  // punti are already subtracted above, and the Ghoul now sits on the capturer's board side.
  if (entry.isConversion) add(entry.owner, punti(GHOUL_SIGLA));
  // A Bomba's blast destroys the capturer as well (the King is immune, so no King ever explodes).
  if (entry.isExplosion) add(entry.owner, -punti(entry.sigla));
  // A Colosso's area damage removes allies and enemies alike (clones have no value).
  for (const victim of entry.areaDamage ?? []) add(victim.owner, -punti(victim.sigla));
  // A promotion swaps the piece's punti (e.g. PE → AL).
  if (entry.promotedTo) add(entry.owner, punti(entry.promotedTo) - punti(entry.sigla));
  // A Necromante's rianimazione puts a fallen piece back on the board.
  if (entry.isRevival && entry.revivedSigla) add(entry.owner, punti(entry.revivedSigla));

  return { dA, dB };
}

/**
 * Material score of each owner after every ply of a finished game. The series is built by
 * accumulating the per-entry deltas backwards-anchored to the final position, so the last point
 * always equals `computeMaterialScore` of the final board exactly. Every board-changing action
 * (swap, teleport, repulse, attira, sdoppiamento, riunione, ...) moves pieces but never material,
 * so it contributes no delta.
 */
export function computeMaterialTrend(finalState: GameState): MaterialPoint[] {
  const deltas = finalState.history.map(entryDelta);
  const finalA = computeMaterialScore(finalState.board, 'A', finalState.dimensions);
  const finalB = computeMaterialScore(finalState.board, 'B', finalState.dimensions);
  const totalA = deltas.reduce((sum, d) => sum + d.dA, 0);
  const totalB = deltas.reduce((sum, d) => sum + d.dB, 0);
  const initialA = finalA - totalA;
  const initialB = finalB - totalB;

  const points: MaterialPoint[] = [{ ply: 0, A: initialA, B: initialB }];
  let a = initialA;
  let b = initialB;
  for (let i = 0; i < deltas.length; i++) {
    a += deltas[i].dA;
    b += deltas[i].dB;
    points.push({ ply: i + 1, A: a, B: b });
  }
  return points;
}
