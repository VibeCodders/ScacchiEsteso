import { KING_SIGLA } from '../data/pieces';
import {
  createEmptyBoard,
  createPieceInstance,
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
