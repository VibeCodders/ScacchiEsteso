import { allCoords, getPieceAt, type BoardState, type Owner } from './board';
import { getPieceDef } from './moveEngine';

/** README §8.1 — 20 consecutive turns (plies) with no capture and no pawn-category move end the game. */
export const ANTI_STALEMATE_TURN_LIMIT = 20;

export function computeMaterialScore(board: BoardState, owner: Owner): number {
  let total = 0;
  for (const coord of allCoords()) {
    const piece = getPieceAt(board, coord);
    if (piece && piece.owner === owner) total += getPieceDef(piece.sigla).punti;
  }
  return total;
}

/** README §8.2/§8.3 — the higher remaining material score wins; equal scores are a draw (undefined). */
export function resolveAntiStalemateWinner(board: BoardState): Owner | undefined {
  const scoreA = computeMaterialScore(board, 'A');
  const scoreB = computeMaterialScore(board, 'B');
  if (scoreA === scoreB) return undefined;
  return scoreA > scoreB ? 'A' : 'B';
}
