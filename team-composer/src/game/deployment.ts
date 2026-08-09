import { KING_SIGLA } from '../data/pieces';
import { getPieceDef } from './moveEngine';
import {
  createEmptyBoard,
  createPieceInstance,
  fileRankToCoord,
  getPieceAt,
  isValidCoord,
  setPieceAt,
  type BoardState,
  type Coord,
  type Owner,
} from './board';

export type Roster = Map<string, number>; // sigla -> count still to place

export interface DeploymentState {
  board: BoardState;
  remaining: Record<Owner, Roster>;
  /** Whose turn it is to place a piece next. */
  currentPlacer: Owner;
  /** Who won the coin toss and placed first (README §2.2). */
  firstPlacer: Owner;
}

/** README §2: each player's deployment zone is their own 2 back ranks. */
export function ownDeploymentRanks(owner: Owner): [number, number] {
  return owner === 'A' ? [1, 2] : [7, 8];
}

function totalRemaining(roster: Roster): number {
  let total = 0;
  roster.forEach((count) => { total += count; });
  return total;
}

/** Starts deployment with each King already placed centrally (e1 / e8), everything else still to place. */
export function createDeploymentState(teamA: Map<string, number>, teamB: Map<string, number>, firstPlacer: Owner): DeploymentState {
  let board = createEmptyBoard();
  board = setPieceAt(board, 'e1', createPieceInstance(KING_SIGLA, 'A'));
  board = setPieceAt(board, 'e8', createPieceInstance(KING_SIGLA, 'B'));

  const remainingA = new Map(teamA);
  remainingA.delete(KING_SIGLA);
  const remainingB = new Map(teamB);
  remainingB.delete(KING_SIGLA);

  return {
    board,
    remaining: { A: remainingA, B: remainingB },
    currentPlacer: firstPlacer,
    firstPlacer,
  };
}

export function isDeploymentComplete(state: DeploymentState): boolean {
  return totalRemaining(state.remaining.A) === 0 && totalRemaining(state.remaining.B) === 0;
}

export type PlacePieceResult =
  | { ok: true; state: DeploymentState }
  | { ok: false; reason: string };

/**
 * Places one piece for the current placer (README §2.3 — one piece at a time, alternating).
 * Once one player's roster is exhausted, the other keeps placing consecutively until done.
 */
export function placePiece(state: DeploymentState, sigla: string, coord: Coord): PlacePieceResult {
  const owner = state.currentPlacer;
  const roster = state.remaining[owner];
  const available = roster.get(sigla) ?? 0;

  if (available <= 0) {
    return { ok: false, reason: `Nessun pezzo "${sigla}" ancora da schierare per questo giocatore.` };
  }
  if (!isValidCoord(coord)) {
    return { ok: false, reason: `Casella non valida: ${coord}.` };
  }
  const rank = Number(coord[1]);
  if (!ownDeploymentRanks(owner).includes(rank)) {
    return { ok: false, reason: 'Fuori dalla propria zona di schieramento (le 2 traverse più vicine).' };
  }
  if (getPieceAt(state.board, coord)) {
    return { ok: false, reason: `Casella ${coord} già occupata.` };
  }

  const nextBoard = setPieceAt(state.board, coord, createPieceInstance(sigla, owner));
  const nextRoster = new Map(roster);
  if (available === 1) nextRoster.delete(sigla);
  else nextRoster.set(sigla, available - 1);
  const nextRemaining: Record<Owner, Roster> = { ...state.remaining, [owner]: nextRoster };

  return {
    ok: true,
    state: {
      ...state,
      board: nextBoard,
      remaining: nextRemaining,
      currentPlacer: computeNextPlacer(nextRemaining, owner),
    },
  };
}

function computeNextPlacer(remaining: Record<Owner, Roster>, justPlaced: Owner): Owner {
  const other: Owner = justPlaced === 'A' ? 'B' : 'A';
  if (totalRemaining(remaining[other]) > 0) return other;
  return justPlaced; // the other side is exhausted (or was already) — this player continues alone
}

// Front rank = the one closer to the opponent (e.g. A's rank 2, facing rank 8); back rank = the
// player's own edge (A's rank 1, where the King starts).
function frontRank(owner: Owner): number { return owner === 'A' ? 2 : 7; }
function backRank(owner: Owner): number { return owner === 'A' ? 1 : 8; }

// Center files first: pieces placed earlier in a rank land more centrally, which — all else being
// equal — gives them more reach/board control than an edge square.
const CENTER_OUT_FILES = [3, 4, 2, 5, 1, 6, 0, 7]; // d, e, c, f, b, g, a, h

function rankSquaresCenterOut(rank: number): Coord[] {
  return CENTER_OUT_FILES.map((file) => fileRankToCoord(file, rank)).filter((c): c is Coord => c !== null);
}

interface RosterItem { sigla: string; punti: number; categoria: string }

function expandRoster(roster: Roster): RosterItem[] {
  const items: RosterItem[] = [];
  roster.forEach((count, sigla) => {
    const def = getPieceDef(sigla);
    for (let i = 0; i < count; i++) items.push({ sigla, punti: def.punti, categoria: def.categoria });
  });
  return items;
}

/**
 * Auto-deploys every remaining piece for `owner` in one shot, using a simple opening-theory-style
 * heuristic (no real "best" square exists for arbitrary custom pieces, so this aims for a
 * reasonable default rather than a search): "pedone"-category pieces go on the front rank to
 * screen the rest, everything else stays on the back rank behind them, and within each rank
 * higher-value pieces land on the more central files (more central squares generally reach more
 * of the board). Overflow (e.g. more than 8 pedoni) spills onto the other rank's empty squares.
 */
export function autoPlaceRemaining(state: DeploymentState, owner: Owner): DeploymentState {
  const roster = state.remaining[owner];
  if (totalRemaining(roster) === 0) return state;

  const items = expandRoster(roster);
  const pedoneItems = items.filter((i) => i.categoria === 'pedone').sort((a, b) => b.punti - a.punti);
  const otherItems = items.filter((i) => i.categoria !== 'pedone').sort((a, b) => b.punti - a.punti);

  const frontQueue = rankSquaresCenterOut(frontRank(owner)).filter((c) => !getPieceAt(state.board, c));
  const backQueue = rankSquaresCenterOut(backRank(owner)).filter((c) => !getPieceAt(state.board, c));

  const placements: Array<{ sigla: string; coord: Coord }> = [];
  for (const item of pedoneItems) {
    const coord = frontQueue.shift() ?? backQueue.shift();
    if (coord) placements.push({ sigla: item.sigla, coord });
  }
  for (const item of otherItems) {
    const coord = backQueue.shift() ?? frontQueue.shift();
    if (coord) placements.push({ sigla: item.sigla, coord });
  }

  let board = state.board;
  for (const { sigla, coord } of placements) {
    board = setPieceAt(board, coord, createPieceInstance(sigla, owner));
  }

  const nextRemaining: Record<Owner, Roster> = { ...state.remaining, [owner]: new Map() };
  const other: Owner = owner === 'A' ? 'B' : 'A';
  const nextPlacer = totalRemaining(nextRemaining[other]) > 0 ? other : owner;

  return { ...state, board, remaining: nextRemaining, currentPlacer: nextPlacer };
}

/** Auto-deploys every remaining piece for both players in one shot. */
export function autoPlaceBoth(state: DeploymentState): DeploymentState {
  return autoPlaceRemaining(autoPlaceRemaining(state, 'A'), 'B');
}
