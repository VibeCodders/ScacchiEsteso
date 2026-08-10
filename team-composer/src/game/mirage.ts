import type { Piece } from '../types';
import {
  coordToFileRank,
  fileRankToCoord,
  getPieceAt,
  removePieceAt,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
  type PieceInstance,
} from './board';
import { isAdjacentToEnemyStunner } from './stun';

const ADJACENT_OFFSETS: Array<{ df: number; dr: number }> = [
  { df: 0, dr: 1 }, { df: 0, dr: -1 }, { df: 1, dr: 0 }, { df: -1, dr: 0 },
  { df: 1, dr: 1 }, { df: -1, dr: 1 }, { df: 1, dr: -1 }, { df: -1, dr: -1 },
];

export function canSdoppiare(pieceDef: Piece): boolean {
  return Boolean(pieceDef.sdoppiamento);
}

export function canRiunire(pieceDef: Piece): boolean {
  return Boolean(pieceDef.riunione);
}

/** True for the illusion copy of a split Miraggio (`mirage.isClone`), never for the real one. */
export function isMirageClone(piece: PieceInstance): boolean {
  return Boolean(piece.mirage?.isClone);
}

/** True for the real half of a split Miraggio (or a Miraggio whose clone was already dispelled). */
export function isRealMirage(piece: PieceInstance): boolean {
  return Boolean(piece.mirage && !piece.mirage.isClone);
}

/** The clone square of a split Miraggio, when that clone is still on the board. */
export function findCloneOf(board: BoardState, mirageId: string): { coord: Coord; piece: PieceInstance } | null {
  for (const [coord, piece] of board) {
    if (piece.mirage?.id === mirageId && piece.mirage.isClone) return { coord, piece };
  }
  return null;
}

/** The real half of a split Miraggio, when still on the board. */
export function findRealOf(board: BoardState, mirageId: string): { coord: Coord; piece: PieceInstance } | null {
  for (const [coord, piece] of board) {
    if (piece.mirage?.id === mirageId && !piece.mirage.isClone) return { coord, piece };
  }
  return null;
}

/** True if the real Miraggio at `from` (or, when `piece` has no marker yet, the unsplit one) has a
 *  clone currently on the board — a split Miraggio cannot split again while its clone is alive
 *  (the player may never field more than 2 of them, real + clone). */
function hasLivingClone(board: BoardState, piece: PieceInstance): boolean {
  if (!piece.mirage) return false; // hasn't split yet — nothing to look for
  return findCloneOf(board, piece.mirage.id) !== null;
}

/**
 * Squares where the Miraggio at `from` could materialize its illusion clone — the 8 adjacent
 * squares that are empty. Returns [] for a clone (illusions don't spawn more illusions), for a
 * real Miraggio whose clone is still alive (max 2 on the board — real + clone), and for a Miraggio
 * frozen by an enemy Stunner's aura (stun blocks every action, mirroring scocca.ts/swap.ts).
 * `getDef` is injected rather than imported from moveEngine.ts — moveEngine.ts needs
 * `removeWithMirageFallout` from this module, so importing back would be circular (same trap
 * stun.ts documents for its own caller).
 */
export function getSdoppiamentoSquares(
  board: BoardState,
  from: Coord,
  owner: Owner,
  getDef: (sigla: string) => { stunAura?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Coord[] {
  const piece = getPieceAt(board, from);
  if (!piece) return [];
  if (isMirageClone(piece)) return []; // a clone is only ever a decoy, never a source
  if (hasLivingClone(board, piece)) return [];
  if (isAdjacentToEnemyStunner(board, from, owner, getDef, dimensions)) return [];

  const { file, rank } = coordToFileRank(from);
  const results: Coord[] = [];
  for (const { df, dr } of ADJACENT_OFFSETS) {
    const coord = fileRankToCoord(file + df, rank + dr, dimensions);
    if (!coord) continue;
    if (!getPieceAt(board, coord)) results.push(coord);
  }
  return results;
}

/**
 * Squares where a split Miraggio (real OR clone — they're indistinguishable, so the player may
 * select either half) could reconstitute into a single piece: the two squares the pair currently
 * occupies, letting the player choose where the merged Miraggio reappears. Returns [] for an
 * unsplit Miraggio, when the pair is incomplete (e.g. the clone was already killed), and when the
 * piece is frozen by an enemy Stunner's aura (stun blocks every action). `getDef` is injected
 * rather than imported from moveEngine.ts for the same circular-import reason as
 * `getSdoppiamentoSquares`.
 */
export function getRiunioneSquares(
  board: BoardState,
  from: Coord,
  owner: Owner,
  getDef: (sigla: string) => { stunAura?: boolean },
  dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS,
): Coord[] {
  const piece = getPieceAt(board, from);
  if (!piece || !piece.mirage) return []; // only a split Miraggio can merge
  if (isAdjacentToEnemyStunner(board, from, owner, getDef, dimensions)) return [];

  const partner = piece.mirage.isClone ? findRealOf(board, piece.mirage.id) : findCloneOf(board, piece.mirage.id);
  if (!partner) return []; // the other half is gone — nothing to merge
  return [from, partner.coord];
}

/**
 * Removes the piece at `coord` and resolves any mirage fallout: if the removed piece is the REAL
 * Miraggio, its clone dissolves too (an illusion cannot outlive its source) and is returned as
 * `fallout`. Removing a clone has no fallout. The caller decides what goes into the graveyard —
 * only the real piece has material value; a clone (or a dissolved clone) is worth no punti.
 */
export function removeWithMirageFallout(board: BoardState, coord: Coord): { board: BoardState; fallout: PieceInstance | null } {
  const piece = getPieceAt(board, coord);
  let next = removePieceAt(board, coord);
  if (!piece || !isRealMirage(piece)) return { board: next, fallout: null };

  const clone = findCloneOf(next, piece.mirage!.id);
  if (!clone) return { board: next, fallout: null };

  return { board: removePieceAt(next, clone.coord), fallout: clone.piece };
}
