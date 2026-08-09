import { coordToFileRank, fileRankToCoord, getPieceAt, type BoardState, type Coord } from './board';

export interface Vector {
  df: number; // file delta
  dr: number; // rank delta
}

/**
 * The unit step (df, dr each in {-1, 0, 1}) from `from` toward `to`, or null if the two
 * coordinates aren't aligned on a straight horizontal, vertical, or diagonal line.
 */
export function directionBetween(from: Coord, to: Coord): Vector | null {
  const { file: f1, rank: r1 } = coordToFileRank(from);
  const { file: f2, rank: r2 } = coordToFileRank(to);
  const df = f2 - f1;
  const dr = r2 - r1;
  if (df === 0 && dr === 0) return null;
  if (df !== 0 && dr !== 0 && Math.abs(df) !== Math.abs(dr)) return null; // not a straight line
  return { df: Math.sign(df), dr: Math.sign(dr) };
}

export interface RayResult {
  /** Empty squares passed through, nearest first, before any obstruction (or the board edge). */
  emptySquares: Coord[];
  /** The first occupied square hit along the ray, within `maxSteps`, if any. */
  blockedBy: Coord | null;
}

/**
 * Walks from `from` in a straight-line direction, stopping at the first occupied square or the
 * board edge (whichever comes first), up to `maxSteps` squares. This is the shared "ray casting"
 * primitive behind slide/step movement (README §7.1) and, later, ranged abilities that need to
 * check for a clear trajectory (e.g. the Arciere's "scocca").
 */
export function castRay(board: BoardState, from: Coord, vector: Vector, maxSteps = 8): RayResult {
  const { file, rank } = coordToFileRank(from);
  const emptySquares: Coord[] = [];

  for (let dist = 1; dist <= maxSteps; dist++) {
    const coord = fileRankToCoord(file + vector.df * dist, rank + vector.dr * dist);
    if (!coord) break; // off the board
    if (getPieceAt(board, coord)) {
      return { emptySquares, blockedBy: coord };
    }
    emptySquares.push(coord);
  }

  return { emptySquares, blockedBy: null };
}

/**
 * True if every square strictly between `from` and `to` (exclusive of both endpoints) is empty —
 * i.e. a piece without the ability to ignore interposition (README §7.1) could draw a clear line
 * between the two. Returns false if `from`/`to` aren't aligned on a straight line at all.
 */
export function isPathClear(board: BoardState, from: Coord, to: Coord): boolean {
  const vector = directionBetween(from, to);
  if (!vector) return false;

  const { file: f1, rank: r1 } = coordToFileRank(from);
  const { file: f2, rank: r2 } = coordToFileRank(to);
  let file = f1 + vector.df;
  let rank = r1 + vector.dr;

  while (file !== f2 || rank !== r2) {
    const coord = fileRankToCoord(file, rank);
    if (!coord) return false; // shouldn't happen for two valid, aligned board coordinates
    if (getPieceAt(board, coord)) return false;
    file += vector.df;
    rank += vector.dr;
  }

  return true;
}
