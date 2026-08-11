import { KING_SIGLA } from '../data/pieces';
import type { Piece } from '../types';
import {
  getPieceAt,
  removePieceAt,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
  type PieceInstance,
} from './board';
import { getPieceDef } from './moveEngine';
import { isKingInCheck } from './check';

/** Does capturing this piece trigger its explosion (the Bomba's `esplodeSeCatturato`)? */
export function isExplosive(pieceDef: Piece): boolean {
  return Boolean(pieceDef.esplodeSeCatturato);
}

export interface ExplosionOutcome {
  board: BoardState;
  /** The capturer's square, set only when the blast actually destroyed it. */
  explodedAt?: Coord;
  /** The destroyed capturer (if any) — the caller adds it to its owner's graveyard. */
  explodedCapturer?: PieceInstance;
}

/**
 * Resolves a Bomba's explosion after it is captured. The blast destroys the capturer too —
 * UNLESS the capturer is a King (always immune, README §3.3) or removing it would leave the
 * capturer's own King in check (the blast never exposes your King, README §3.2). Returns the
 * board with the capturer removed when the explosion fires, otherwise the board untouched.
 * Callers pass the captured piece they already fetched and the capturer's CURRENT square.
 */
export function resolveExplosion(
  board: BoardState,
  capturedPiece: PieceInstance,
  capturerCoord: Coord,
  capturerOwner: Owner,
  dimensions: BoardDimensions,
): ExplosionOutcome {
  if (!isExplosive(getPieceDef(capturedPiece.sigla))) return { board };
  const capturer = getPieceAt(board, capturerCoord);
  if (!capturer || capturer.sigla === KING_SIGLA) return { board };

  const afterBlast = removePieceAt(board, capturerCoord);
  if (isKingInCheck(afterBlast, capturerOwner, dimensions)) return { board };

  return { board: afterBlast, explodedAt: capturerCoord, explodedCapturer: capturer };
}
