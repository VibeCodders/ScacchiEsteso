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
 * enemy could be captured from `from`. For jump-over patterns whose real range depends on where a
 * hurdle happens to sit (the Cavalletta's grasshopper leap, the Coniglio's jump-chain) the
 * illustration shows every square the piece could conceivably reach depending on hurdle placement,
 * rather than assuming a single fixed hurdle distance — the Pedone di Dama's checkers-style jump is
 * the one case where the hurdle position genuinely is fixed (immediately adjacent, by that piece's
 * own rules), so it alone keeps the fixed-distance illustration.
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

    if (moveEntry.movementType === 'speciale' && (pieceDef.gryphon || pieceDef.manticora)) {
      // Illustrative only (no board/occupancy here): the first leg (diagonal for the Grifone,
      // orthogonal for the Manticora) is a pure pivot and is never itself a destination; every
      // square along the two outward second-leg continuations is shown as a plain move or capture
      // landing. Mirrors moveEngine.ts's generateBentSlideMoves geometry.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        const pivot = offsetCoord(from, v.df, v.dr);
        if (!pivot) continue;

        const secondLegs: Vector[] = pieceDef.gryphon
          ? [{ df: v.df, dr: 0 }, { df: 0, dr: v.dr }]
          : v.df !== 0
            ? [{ df: v.df, dr: 1 }, { df: v.df, dr: -1 }]
            : [{ df: 1, dr: v.dr }, { df: -1, dr: v.dr }];

        for (const v2 of secondLegs) {
          for (let dist = 1; ; dist++) {
            const to = offsetCoord(pivot, v2.df * dist, v2.dr * dist);
            if (!to) break;
            visit(to, to, moveEntry.capture, true);
          }
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
      // Per the real Grasshopper rules (see moveEngine.ts's generateGrasshopperMoves, and
      // https://en.wikipedia.org/wiki/Grasshopper_(chess)): it needs a hurdle — any piece, of
      // either side — somewhere along a queen-line, and lands on the square immediately beyond it.
      // Without a real board there's no way to know where that hurdle will be, so every square from
      // distance 2 out to the board edge is a *possible* landing (distance 1 never is: a hurdle
      // can't sit on the piece's own square). This used to assume the hurdle always sits exactly 1
      // square away, which made the Cavalletta indistinguishable in aggregate mobility from a
      // fixed-offset leaper like the Cavallo — the whole point of a grasshopper is the long,
      // hurdle-contingent reach this now shows.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        for (let dist = 2; ; dist++) {
          const to = offsetCoord(from, v.df * dist, v.dr * dist);
          if (!to) break;
          visit(to, to, moveEntry.capture, true);
        }
      }
      continue;
    }

    if (pieceDef.catenaSaltiConCatturaFinale && moveEntry.jump) {
      // Coniglio's jump-chain: each hop clears an adjacent enemy (the hurdle) and lands on the next
      // empty square, and may repeat from the new square — so along a single straight/diagonal line
      // it can reach any *even* distance away, capturing whichever enemy it jumped last if it stops
      // there (see the piece's own rules text in pieces.json). Illustrative only, and deliberately
      // doesn't model direction changes mid-chain (unbounded and occupancy-dependent, not a useful
      // structural signal) — this replaces the generic fixed single-hop fallback below, which
      // modeled this piece as capable of only one hop, indistinguishable in aggregate mobility from
      // a knight-leap piece like Generale despite the two having nothing in common mechanically.
      for (const relDir of moveEntry.directions) {
        const v = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
        for (let hops = 1; ; hops++) {
          const hurdle = offsetCoord(from, v.df * (2 * hops - 1), v.dr * (2 * hops - 1));
          const landing = offsetCoord(from, v.df * (2 * hops), v.dr * (2 * hops));
          if (!hurdle || !landing) break;
          visit(landing, hurdle, moveEntry.capture, true);
        }
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
