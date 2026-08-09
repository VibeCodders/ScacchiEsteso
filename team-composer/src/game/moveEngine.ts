import { pieces as PIECE_DEFS } from '../data/pieces';
import type { CaptureMode, Direction, Move, Piece } from '../types';
import { FILES, getPieceAt, movePiece, removePieceAt, type BoardState, type Coord, type Owner, type PieceInstance } from './board';

const PIECE_BY_SIGLA = new Map(PIECE_DEFS.map((p) => [p.sigla, p]));

export function getPieceDef(sigla: string): Piece {
  const def = PIECE_BY_SIGLA.get(sigla);
  if (!def) throw new Error(`Unknown piece sigla: ${sigla}`);
  return def;
}

export interface GeneratedMove {
  from: Coord;
  to: Coord;
  isCapture: boolean;
  /** The square whose piece is removed by this move — usually `to`, but differs for jump-captures (e.g. the checkers-style DA capture). */
  capturedCoord?: Coord;
  captureMode: CaptureMode;
  movementType: Move['movementType'];
}

interface Vector {
  df: number; // file delta
  dr: number; // rank delta
}

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

/**
 * Directions in piece data are relative to the owner ("n" = forward, toward the opponent).
 * Player B sits on rank 8 and faces the opposite way, so their forward direction is a vertical
 * mirror of Player A's: only the rank component flips, the file component (left/right) does not —
 * the same reason Black's pawns capture diagonally "downward" in standard chess.
 */
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

export function coordToFileRank(coord: Coord): { file: number; rank: number } {
  return { file: FILES.indexOf(coord[0] as (typeof FILES)[number]), rank: Number(coord[1]) };
}

export function fileRankToCoord(file: number, rank: number): Coord | null {
  if (file < 0 || file > 7 || rank < 1 || rank > 8) return null;
  return `${FILES[file]}${rank}`;
}

/** Matches Board.tsx's square coloring: a1 is dark, h1 is light, as in standard chess. */
function squareColorOf(coord: Coord): 'chiara' | 'scura' {
  const { file, rank } = coordToFileRank(coord);
  return (file + rank) % 2 === 0 ? 'chiara' : 'scura';
}

function passesColorRestriction(moveEntry: Move, from: Coord): boolean {
  if (moveEntry.colorRestriction === 'chiare') return squareColorOf(from) === 'chiara';
  if (moveEntry.colorRestriction === 'scure') return squareColorOf(from) === 'scura';
  // 'nessuna', 'forward', 'backward', and undefined are not square-color restrictions here —
  // "forward"/"backward" are already expressed through the (owner-relative) direction itself.
  return true;
}

function generateStepOrSlideMoves(
  board: BoardState,
  from: Coord,
  owner: Owner,
  moveEntry: Move,
  effectiveMaxSteps: number,
  captureOnly: boolean,
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);

  for (const relDir of moveEntry.directions) {
    const vector = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];

    for (let dist = 1; dist <= effectiveMaxSteps; dist++) {
      const to = fileRankToCoord(fromFile + vector.df * dist, fromRank + vector.dr * dist);
      if (!to) break; // off board — further distances in this direction are too

      const occupant = getPieceAt(board, to);
      if (!occupant) {
        if (dist >= moveEntry.minSteps && !captureOnly) {
          results.push({ from, to, isCapture: false, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
        }
        continue;
      }

      if (occupant.owner !== owner && moveEntry.capture && dist >= moveEntry.minSteps) {
        results.push({ from, to, isCapture: true, capturedCoord: to, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
      }
      break; // any piece (friend or foe) blocks further travel along this direction
    }
  }

  return results;
}

function generateJumpMoves(
  board: BoardState,
  from: Coord,
  owner: Owner,
  moveEntry: Move,
  effectiveMaxSteps: number,
): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);

  for (const relDir of moveEntry.directions) {
    const vector = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];

    for (let dist = moveEntry.minSteps; dist <= effectiveMaxSteps; dist++) {
      const to = fileRankToCoord(fromFile + vector.df * dist, fromRank + vector.dr * dist);
      if (!to) continue; // this distance is off-board, but a shorter/longer one might not be

      const occupant = getPieceAt(board, to);
      if (!occupant) {
        results.push({ from, to, isCapture: false, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
      } else if (occupant.owner !== owner && moveEntry.capture) {
        results.push({ from, to, isCapture: true, capturedCoord: to, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
      }
    }
  }

  return results;
}

function generateKnightPatternMoves(board: BoardState, from: Coord, owner: Owner, moveEntry: Move): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);

  for (const { df, dr } of KNIGHT_OFFSETS) {
    const to = fileRankToCoord(fromFile + df, fromRank + dr);
    if (!to) continue;

    const occupant = getPieceAt(board, to);
    if (!occupant) {
      results.push({ from, to, isCapture: false, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
    } else if (occupant.owner !== owner && moveEntry.capture) {
      results.push({ from, to, isCapture: true, capturedCoord: to, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
    }
  }

  return results;
}

/** Grasshopper: slides until the first occupied square in the line, then lands immediately beyond it. */
function generateGrasshopperMoves(board: BoardState, from: Coord, owner: Owner, moveEntry: Move): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);

  for (const relDir of moveEntry.directions) {
    const vector = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];

    let dist = 1;
    let hurdleCoord: Coord | null = null;
    while (true) {
      const probe = fileRankToCoord(fromFile + vector.df * dist, fromRank + vector.dr * dist);
      if (!probe) break; // ran off the board without finding a hurdle
      if (getPieceAt(board, probe)) {
        hurdleCoord = probe;
        break;
      }
      dist++;
    }

    if (!hurdleCoord) continue;

    const landing = fileRankToCoord(fromFile + vector.df * (dist + 1), fromRank + vector.dr * (dist + 1));
    if (!landing) continue;

    const occupant = getPieceAt(board, landing);
    if (!occupant) {
      results.push({ from, to: landing, isCapture: false, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
    } else if (occupant.owner !== owner && moveEntry.capture) {
      results.push({ from, to: landing, isCapture: true, capturedCoord: landing, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
    }
  }

  return results;
}

/** Checkers-style jump: requires an adjacent enemy at distance 1, lands on the empty square at distance 2, capturing the hurdle. Single jump only — chained multi-capture is a later step. */
function generateCheckersJumpMoves(board: BoardState, from: Coord, owner: Owner, moveEntry: Move): GeneratedMove[] {
  const results: GeneratedMove[] = [];
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);

  for (const relDir of moveEntry.directions) {
    const vector = ABSOLUTE_DIRECTION_VECTORS[toAbsoluteDirection(relDir, owner)];
    const hurdle = fileRankToCoord(fromFile + vector.df, fromRank + vector.dr);
    const landing = fileRankToCoord(fromFile + vector.df * 2, fromRank + vector.dr * 2);
    if (!hurdle || !landing) continue;

    const hurdleOccupant = getPieceAt(board, hurdle);
    const landingOccupant = getPieceAt(board, landing);
    if (hurdleOccupant && hurdleOccupant.owner !== owner && moveEntry.capture && !landingOccupant) {
      results.push({ from, to: landing, isCapture: true, capturedCoord: hurdle, captureMode: moveEntry.captureMode, movementType: moveEntry.movementType });
    }
  }

  return results;
}

const DIAGONAL_DIRECTIONS: readonly Direction[] = ['ne', 'nw', 'se', 'sw'];

/**
 * Standard chess convention (not an explicit field in pieces.json): a pawn-category piece's
 * diagonal move entry is capture-only — it cannot step onto an empty diagonal square. Every
 * other capturing entry in the data (King, Rook, ...) can land on an empty square as a normal
 * move, so this only applies where the piece is a pawn (categoria "pedone") and the entry's
 * directions are purely diagonal.
 */
function isPawnDiagonalCaptureOnly(pieceDef: Piece, moveEntry: Move): boolean {
  return (
    pieceDef.categoria === 'pedone' &&
    moveEntry.capture &&
    moveEntry.directions.length > 0 &&
    moveEntry.directions.every((d) => DIAGONAL_DIRECTIONS.includes(d))
  );
}

function generateMovesForEntry(board: BoardState, from: Coord, piece: PieceInstance, pieceDef: Piece, moveEntry: Move): GeneratedMove[] {
  if (!passesColorRestriction(moveEntry, from)) return [];

  const effectiveMaxSteps = moveEntry.primaMossaDoppia && piece.hasMoved ? 1 : moveEntry.maxSteps;

  if (moveEntry.leapPattern === 'L') {
    return generateKnightPatternMoves(board, from, piece.owner, moveEntry);
  }
  if (moveEntry.leapPattern === 'grasshopper') {
    return generateGrasshopperMoves(board, from, piece.owner, moveEntry);
  }
  if (moveEntry.jump && moveEntry.maxSteps === 0) {
    // jump:true with no distance range and no leap pattern encodes the checkers-style
    // jump-over-adjacent-enemy capture (currently only the Pedone di Dama, "DA").
    return generateCheckersJumpMoves(board, from, piece.owner, moveEntry);
  }
  if (moveEntry.jump) {
    return generateJumpMoves(board, from, piece.owner, moveEntry, effectiveMaxSteps);
  }
  return generateStepOrSlideMoves(board, from, piece.owner, moveEntry, effectiveMaxSteps, isPawnDiagonalCaptureOnly(pieceDef, moveEntry));
}

/**
 * Applies a generated move to the board, returning a new board. Removes the captured piece
 * first (which may sit on a different square than `to`, e.g. the DA checkers-style jump) and
 * then relocates the moving piece.
 */
export function applyMove(board: BoardState, move: GeneratedMove): BoardState {
  const withCaptureResolved = move.capturedCoord ? removePieceAt(board, move.capturedCoord) : board;
  return movePiece(withCaptureResolved, move.from, move.to);
}

/** All pseudo-legal moves for the piece at `from` — no notion of check yet (see check.ts). */
export function generatePseudoLegalMoves(board: BoardState, from: Coord): GeneratedMove[] {
  const piece = getPieceAt(board, from);
  if (!piece) return [];
  const pieceDef = getPieceDef(piece.sigla);

  const seen = new Set<string>();
  const moves: GeneratedMove[] = [];
  for (const moveEntry of pieceDef.moves) {
    for (const move of generateMovesForEntry(board, from, piece, pieceDef, moveEntry)) {
      const key = `${move.to}|${move.capturedCoord ?? ''}|${move.isCapture}`;
      if (seen.has(key)) continue;
      seen.add(key);
      moves.push(move);
    }
  }
  return moves;
}
