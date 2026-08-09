import type { Piece } from '../types';
import {
  allCoords,
  createPieceInstance,
  getPieceAt,
  setPieceAt,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
} from './board';
import { generatePseudoLegalMoves, type GeneratedMove } from './moveEngine';

export function canMimic(pieceDef: Piece): boolean {
  return pieceDef.alternativeActions.some((a) => a.type === 'copia_poteri');
}

/**
 * README (Orfano): "ha tutti i poteri di chi lo tiene in scacco". Unlike the King, the Orfano has
 * no immunity, so — per the user's clarification — any capturing threat counts (melee, leap, and
 * eventually ranged/area), not just the melee-equivalent modes used for King-check.
 */
export function getOrphanThreats(board: BoardState, coord: Coord, owner: Owner, dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): Coord[] {
  const threats: Coord[] = [];
  for (const enemyCoord of allCoords(dimensions)) {
    const enemy = getPieceAt(board, enemyCoord);
    if (!enemy || enemy.owner === owner) continue;
    const moves = generatePseudoLegalMoves(board, enemyCoord, dimensions);
    if (moves.some((m) => m.isCapture && m.capturedCoord === coord)) {
      threats.push(enemyCoord);
    }
  }
  return threats;
}

/**
 * Pseudo-legal moves the Orfano at `orphanCoord` gets by mimicking the movement (`moves[]` only,
 * per the user's scope decision — special abilities are a later step) of the piece currently
 * threatening it at `mimicSourceCoord`, still moving as the Orfano's own owner.
 */
export function getMimicMoves(
  board: BoardState,
  orphanCoord: Coord,
  mimicSourceCoord: Coord,
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): GeneratedMove[] {
  const orphan = getPieceAt(board, orphanCoord);
  const mimicSource = getPieceAt(board, mimicSourceCoord);
  if (!orphan || !mimicSource) return [];

  const tempBoard = setPieceAt(board, orphanCoord, createPieceInstance(mimicSource.sigla, orphan.owner));
  return generatePseudoLegalMoves(tempBoard, orphanCoord, dimensions);
}
