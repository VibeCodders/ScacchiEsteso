import type { Direction, Move, Piece } from '../types';
import { coordToFileRank, fileRankToCoord, DEFAULT_BOARD_DIMENSIONS, type Coord, type Owner } from './board';

interface Vector { df: number; dr: number }

const ABSOLUTE_DIRECTION_VECTORS: Record<Direction, Vector> = {
  n: { df: 0, dr: 1 },
  s: { df: 0, dr: -1 },
  e: { df: 1, dr: 0 },
  w: { df: -1, dr: 0 },
  ne: { df: 1, dr: 1 },
  nw: { df: -1, dr: 1 },
  se: { df: 1, dr: -1 },
  sw: { df: -1, dr: -1 },
};

// Same owner-relative mirroring as moveEngine.ts — kept in sync deliberately rather than shared,
// since this module intentionally ignores board occupancy (moveEngine's version doesn't).
const OWNER_B_DIRECTION_MIRROR: Record<Direction, Direction> = {
  n: 's', s: 'n',
  ne: 'se', se: 'ne',
  nw: 'sw', sw: 'nw',
  e: 'e', w: 'w',
};

function toAbsoluteDirection(direction: Direction, owner: Owner): Direction {
  return owner === 'A' ? direction : OWNER_B_DIRECTION_MIRROR[direction];
}

const KNIGHT_OFFSETS: Vector[] = [
  { df: 1, dr: 2 }, { df: 2, dr: 1 }, { df: 2, dr: -1 }, { df: 1, dr: -2 },
  { df: -1, dr: -2 }, { df: -2, dr: -1 }, { df: -2, dr: 1 }, { df: -1, dr: 2 },
];

const DIAGONAL_DIRECTIONS: readonly Direction[] = ['ne', 'nw', 'se', 'sw'];

function squareColorOf(coord: Coord): 'chiara' | 'scura' {
  const { file, rank } = coordToFileRank(coord);
  return (file + rank) % 2 === 0 ? 'chiara' : 'scura';
}

function passesColorRestriction(moveEntry: Move, from: Coord): boolean {
  if (moveEntry.colorRestriction === 'chiare') return squareColorOf(from) === 'chiara';
  if (moveEntry.colorRestriction === 'scure') return squareColorOf(from) === 'scura';
  return true;
}

/** Same heuristic as moveEngine.ts's isPawnDiagonalCaptureOnly, duplicated for the same reason as the direction mirror above. */
function isPawnDiagonalCaptureOnly(pieceDef: Piece, moveEntry: Move): boolean {
  return (
    pieceDef.categoria === 'pedone' &&
    moveEntry.capture &&
    moveEntry.directions.length > 0 &&
    moveEntry.directions.every((d) => DIAGONAL_DIRECTIONS.includes(d))
  );
}

function offsetCoord(from: Coord, df: number, dr: number): Coord | null {
  const { file, rank } = coordToFileRank(from);
  return fileRankToCoord(file + df, rank + dr);
}

export interface PieceRangeSquares {
  /** Squares the piece could step/slide/jump onto when empty. */
  moveSquares: Coord[];
  /** Squares where an enemy piece sitting there could be captured. */
  captureSquares: Coord[];
  /** One illustrative capture to render an example enemy piece for, if the piece can capture at all. */
  exampleCapture?: { enemyAt: Coord };
}

/**
 * Computes, purely from the piece's data (no board, no occupancy — this is for the "piece
 * encyclopedia", not gameplay), every square reachable as a plain move and every square where an
 * enemy could be captured from `from`. For jump-over patterns that need something to hop over
 * (the Cavalletta's grasshopper leap, the Pedone di Dama's checkers-style jump) the illustrative
 * hurdle is assumed to sit immediately adjacent, since there's no real board to consult.
 */
export function computePieceRangeSquares(pieceDef: Piece, owner: Owner, from: Coord): PieceRangeSquares {
  const moveSquares = new Set<Coord>();
  const captureSquares = new Set<Coord>();
  let exampleCapture: { enemyAt: Coord } | undefined;

  const visit = (to: Coord, capturedCoord: Coord, capture: boolean, includeAsMove: boolean) => {
    if (includeAsMove) moveSquares.add(to);
    if (capture) {
      captureSquares.add(capturedCoord);
      if (!exampleCapture) exampleCapture = { enemyAt: capturedCoord };
    }
  };

  for (const moveEntry of pieceDef.moves) {
    if (!passesColorRestriction(moveEntry, from)) continue;

    if (moveEntry.movementType === 'speciale' && pieceDef.rimbalzoUnico) {
      // Illustrative only: shows the deterministic edge-bounce (mirrors moveEngine.ts's
      // walkDiagonalSegment edge logic against the default board size); the obstacle-bounce case
      // can't be shown here since this module has no board/occupancy to bounce off of.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        const { file: fromFile, rank: fromRank } = coordToFileRank(from);

        let lastGood: Coord | null = null;
        let edgeAxis: 'file' | 'rank' | 'both' | null = null;
        for (let dist = 1; ; dist++) {
          const file = fromFile + v.df * dist;
          const rank = fromRank + v.dr * dist;
          const fileOut = file < 0 || file >= DEFAULT_BOARD_DIMENSIONS.width;
          const rankOut = rank < 1 || rank > DEFAULT_BOARD_DIMENSIONS.height;
          if (fileOut || rankOut) {
            edgeAxis = fileOut && rankOut ? 'both' : fileOut ? 'file' : 'rank';
            break;
          }
          const to = offsetCoord(from, v.df * dist, v.dr * dist)!;
          visit(to, to, moveEntry.capture, true);
          lastGood = to;
        }
        if (!lastGood || !edgeAxis) continue;

        const reflected: Vector = {
          df: edgeAxis === 'file' || edgeAxis === 'both' ? -v.df : v.df,
          dr: edgeAxis === 'rank' || edgeAxis === 'both' ? -v.dr : v.dr,
        };
        const { file: pivotFile, rank: pivotRank } = coordToFileRank(lastGood);
        for (let dist = 1; ; dist++) {
          const file = pivotFile + reflected.df * dist;
          const rank = pivotRank + reflected.dr * dist;
          if (file < 0 || file >= DEFAULT_BOARD_DIMENSIONS.width || rank < 1 || rank > DEFAULT_BOARD_DIMENSIONS.height) break;
          const to = offsetCoord(lastGood, reflected.df * dist, reflected.dr * dist)!;
          visit(to, to, moveEntry.capture, true);
        }
      }
      continue;
    }

    if (moveEntry.leapPattern === 'L') {
      for (const { df, dr } of KNIGHT_OFFSETS) {
        const to = offsetCoord(from, df, dr);
        if (to) visit(to, to, moveEntry.capture, true);
      }
      continue;
    }

    if (moveEntry.leapPattern === 'grasshopper') {
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        const landing = offsetCoord(from, v.df * 2, v.dr * 2); // illustrative: hurdle assumed 1 square away
        if (landing) visit(landing, landing, moveEntry.capture, true);
      }
      continue;
    }

    if (moveEntry.jump && moveEntry.maxSteps === 0) {
      // Checkers-style jump (the Pedone di Dama): lands 2 squares away, capturing the hurdle 1 square away.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        const hurdle = offsetCoord(from, v.df, v.dr);
        const landing = offsetCoord(from, v.df * 2, v.dr * 2);
        if (hurdle && landing) visit(landing, hurdle, moveEntry.capture, true);
      }
      continue;
    }

    const captureOnly = isPawnDiagonalCaptureOnly(pieceDef, moveEntry);

    if (moveEntry.jump) {
      // Plain jump: ignores intervening squares, e.g. a fixed-distance leap.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        for (let dist = moveEntry.minSteps; dist <= moveEntry.maxSteps; dist++) {
          const to = offsetCoord(from, v.df * dist, v.dr * dist);
          if (to) visit(to, to, moveEntry.capture, !captureOnly);
        }
      }
      continue;
    }

    // Step or slide.
    for (const relDir of moveEntry.directions) {
      const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
      for (let dist = moveEntry.minSteps; dist <= moveEntry.maxSteps; dist++) {
        const to = offsetCoord(from, v.df * dist, v.dr * dist);
        if (!to) break; // off board — further distances in this direction are too
        visit(to, to, moveEntry.capture, !captureOnly);
      }
    }
  }

  return { moveSquares: [...moveSquares], captureSquares: [...captureSquares], exampleCapture };
}
