import { describe, expect, it } from 'vitest';
import {
  applyAttract, applyRepulse, applyRevive, applyRiunione, applySdoppiamento, applySostituzione,
  applySwap, applySwapperSwap, applyTeleport, applyTurn, createInitialGameState,
  type ApplyTurnResult, type GameState, type HistoryEntry,
} from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { getAttractTargets } from './vortex';
import { getTeleportTargets } from './teleport';
import { getRepulseTargets } from './repulse';
import { getSwapperCandidatePairs } from './swapper';
import { getRevivalSquares } from './necromancy';
import { getSwapTargets } from './swap';
import { getSostituzioneTargets } from './sostituzione';
import { getSdoppiamentoSquares, getRiunioneSquares } from './mirage';
import { getPieceDef } from './moveEngine';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// From pieces.json: RE 15, PE 7, VZ 24, TT 22, RP 10, SW 28, NE 28, MI 37, MG 27.
const RE = 15;
const PE = 7;
const VZ = 24;
const TT = 22;
const RP = 10;
const SW = 28;
const NE = 28;
const MI = 37;
const MG = 27;
const BR = 24;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** A: RE a1 + the special piece at d4 (plus its subject pieces), B: RE h8 + PE at `peSquare`. */
function baseBoard(peSquare: Coord = 'd6'): BoardState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, peSquare, 'PE', 'B');
  return board;
}

interface ProgressCase {
  /** Human-readable case name (interpolated into the test title). */
  name: string;
  /** Builds a fresh position for the case; must stay legal for quiet King shuffles. */
  setup: () => GameState;
  /** Asserts the engine offers the action's target (discoverable, not just directly callable). */
  offered: (state: GameState) => boolean;
  /** Applies the special action as the turn's action. */
  act: (state: GameState) => ApplyTurnResult;
  /** Asserts the resulting history entry. */
  assertHistory: (entry: HistoryEntry) => void;
  /** Asserts the board/graveyard effect of the action. */
  assertAfter: (state: GameState) => void;
  /** Material (A, B) right after the action. */
  materialAfter: [number, number];
}

const CASES: ProgressCase[] = [
  {
    name: "the Vortice's attira",
    setup: () => {
      const board = place(baseBoard(), 'd4', 'VZ', 'A');
      return createInitialGameState(board, 'A');
    },
    offered: (s) => getAttractTargets(s.board, 'd4', 'A', s.dimensions).includes('d6'),
    act: (s) => applyAttract(s, 'd4', 'd6'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'VZ', from: 'd4', to: 'd6', isAttract: true, attractedTo: 'd5' }),
    assertAfter: (s) => {
      expect(s.board.get('d5')?.sigla).toBe('PE');
      expect(s.board.get('d5')?.owner).toBe('B');
      expect(s.board.get('d6')).toBeUndefined();
    },
    materialAfter: [RE + VZ, RE + PE],
  },
  {
    name: "the Teletrasporto's teletrasporto",
    setup: () => {
      const board = place(baseBoard(), 'd4', 'TT', 'A');
      return createInitialGameState(board, 'A');
    },
    offered: (s) => getTeleportTargets(s.board, 'd4', 'A', s.dimensions).includes('d7'),
    act: (s) => applyTeleport(s, 'd4', 'd7'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'TT', from: 'd4', to: 'd7', isTeleport: true }),
    assertAfter: (s) => {
      expect(s.board.get('d7')?.sigla).toBe('TT');
      expect(s.board.get('d4')).toBeUndefined();
    },
    materialAfter: [RE + TT, RE + PE],
  },
  {
    name: "the Repulsore's respingi",
    setup: () => {
      // The RP's subject PE must sit ADJACENT at d5 (pushed one square further, to d6).
      const board = place(baseBoard('d5'), 'd4', 'RP', 'A');
      return createInitialGameState(board, 'A');
    },
    offered: (s) => getRepulseTargets(s.board, 'd4', 'A', s.dimensions).includes('d5'),
    act: (s) => applyRepulse(s, 'd4', 'd5'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'RP', from: 'd4', to: 'd5', isRepulse: true, repulsedTo: 'd6' }),
    assertAfter: (s) => {
      expect(s.board.get('d6')?.sigla).toBe('PE');
      expect(s.board.get('d6')?.owner).toBe('B');
      expect(s.board.get('d5')).toBeUndefined();
    },
    materialAfter: [RE + RP, RE + PE],
  },
  {
    name: "the Swapper's two-ally swap",
    setup: () => {
      const board = place(baseBoard(), 'd4', 'SW', 'A');
      return createInitialGameState(place(board, 'e4', 'PE', 'A'), 'A');
    },
    offered: (s) => getSwapperCandidatePairs(s.board, 'd4', 'A', s.dimensions).some(
      ([a, b]) => (a === 'd4' && b === 'e4') || (a === 'e4' && b === 'd4'),
    ),
    act: (s) => applySwapperSwap(s, 'd4', 'd4', 'e4'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'SW', from: 'd4', to: 'e4', isSwapperSwap: true, swapSquares: ['d4', 'e4'] }),
    assertAfter: (s) => {
      expect(s.board.get('e4')?.sigla).toBe('SW');
      expect(s.board.get('d4')?.sigla).toBe('PE');
    },
    materialAfter: [RE + SW + PE, RE + PE],
  },
  {
    name: "the Necromante's rianimazione",
    setup: () => {
      const board = place(baseBoard(), 'd4', 'NE', 'A');
      const state = createInitialGameState(board, 'A');
      // Simulate an earlier capture: a fallen PE of A's sits in the graveyard, ready to revive.
      return { ...state, captured: { A: [createPieceInstance('PE', 'A')], B: [] } };
    },
    offered: (s) => getRevivalSquares(s.board, 'd4', 'A', s.dimensions).includes('d5'),
    act: (s) => applyRevive(s, 'd4', 'd5', 'PE'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'NE', from: 'd4', to: 'd5', isRevival: true, revivedSigla: 'PE' }),
    assertAfter: (s) => {
      expect(s.board.get('d5')?.sigla).toBe('PE');
      expect(s.board.get('d5')?.owner).toBe('A');
      expect(s.captured.A).toHaveLength(0); // the revived PE left the graveyard
    },
    materialAfter: [RE + NE + PE, RE + PE],
  },
  {
    name: "the Mistico's scambio",
    setup: () => {
      const board = place(baseBoard(), 'd4', 'MI', 'A');
      return createInitialGameState(place(board, 'e4', 'PE', 'A'), 'A');
    },
    offered: (s) => getSwapTargets(s.board, 'd4', 'A', s.dimensions).includes('e4'),
    act: (s) => applySwap(s, 'd4', 'e4'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'MI', from: 'd4', to: 'e4', isSwap: true }),
    assertAfter: (s) => {
      expect(s.board.get('e4')?.sigla).toBe('MI');
      expect(s.board.get('d4')?.sigla).toBe('PE');
    },
    materialAfter: [RE + MI + PE, RE + PE],
  },
  {
    name: "the Brigante's sostituzione",
    setup: () => {
      // The BR's subject PE must sit ADJACENT at d5 (the swap exchanges them).
      const board = place(baseBoard('d5'), 'd4', 'BR', 'A');
      return createInitialGameState(board, 'A');
    },
    offered: (s) => getSostituzioneTargets(s.board, 'd4', 'A', s.dimensions).includes('d5'),
    act: (s) => applySostituzione(s, 'd4', 'd5'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'BR', from: 'd4', to: 'd5', isSostituzione: true, sostituitoCon: 'd5' }),
    assertAfter: (s) => {
      expect(s.board.get('d5')?.sigla).toBe('BR');
      expect(s.board.get('d4')?.sigla).toBe('PE');
      expect(s.board.get('d4')?.owner).toBe('B');
    },
    materialAfter: [RE + BR, RE + PE],
  },
  {
    name: "the Miraggio's sdoppiamento",
    setup: () => {
      const board = baseBoard();
      return createInitialGameState(
        setPieceAt(board, 'd4', { ...createPieceInstance('MG', 'A'), mirage: { id: 'm1', isClone: false } }),
        'A',
      );
    },
    offered: (s) => getSdoppiamentoSquares(s.board, 'd4', 'A', getPieceDef, s.dimensions).includes('d5'),
    act: (s) => applySdoppiamento(s, 'd4', 'd5', 'd4'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'MG', from: 'd4', to: 'd5', isSdoppiamento: true, cloneSquare: 'd5', realSquare: 'd4' }),
    assertAfter: (s) => {
      // The clone is an illusion (0 punti); the real half stays put.
      expect(s.board.get('d5')?.mirage?.isClone).toBe(true);
      expect(s.board.get('d4')?.mirage?.isClone).toBe(false);
    },
    materialAfter: [RE + MG, RE + PE],
  },
  {
    name: "the Miraggio's riunione",
    setup: () => {
      let board = baseBoard();
      board = setPieceAt(board, 'd4', { ...createPieceInstance('MG', 'A'), mirage: { id: 'm2', isClone: false } });
      board = setPieceAt(board, 'd5', { ...createPieceInstance('MG', 'A'), mirage: { id: 'm2', isClone: true } });
      return createInitialGameState(board, 'A');
    },
    offered: (s) => getRiunioneSquares(s.board, 'd4', 'A', getPieceDef, s.dimensions).includes('d5'),
    act: (s) => applyRiunione(s, 'd4', 'd5'),
    assertHistory: (e) => expect(e).toMatchObject({ sigla: 'MG', from: 'd4', to: 'd5', isMerge: true }),
    assertAfter: (s) => {
      expect(s.board.get('d5')?.sigla).toBe('MG'); // the halves reconstitute on d5
      expect(s.board.get('d4')).toBeUndefined();
    },
    materialAfter: [RE + MG, RE + PE],
  },
];

/** One quiet King shuffle for the side to move (A: a1↔a2, B: h8↔h7). */
function quietKingShuffle(state: GameState): GameState {
  const isA = state.turn === 'A';
  const [here, there] = isA ? ['a1', 'a2'] : ['h8', 'h7'];
  const from = state.board.get(here) ? here : there;
  const to = state.board.get(here) ? there : here;
  const result = applyTurn(state, from, to);
  expect(result.ok, `quiet ${from}->${to} must be legal`).toBe(true);
  if (!result.ok) throw new Error(`illegal quiet move ${from}->${to}`);
  return result.state;
}

/** Plays `count` consecutive quiet King shuffles, asserting the counter tracks them. */
function playQuietPlies(state: GameState, count: number): GameState {
  let current = state;
  for (let i = 0; i < count; i++) current = quietKingShuffle(current);
  return current;
}

describe('integration — every board-changing action resets the anti-stalemate counter in a complete game', () => {
  it.each(CASES)(
    '$name resets the counter to 0, and the game ends by anti-stalemate on material',
    ({ setup, offered, act, assertHistory, assertAfter, materialAfter }) => {
      const state = setup();
      expect(state.status).toBe('ongoing');
      expect(state.turnsSinceProgress).toBe(0);

      // Four quiet plies (two full King shuffles) push the counter up.
      const quiet = playQuietPlies(state, 4);
      expect(quiet.turnsSinceProgress).toBe(4);
      expect(quiet.status).toBe('ongoing');

      // The action is offered by the engine, not just directly callable.
      expect(offered(quiet)).toBe(true);

      const result = act(quiet);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      const after = result.state;

      // The action resets the anti-stalemate counter — the core assertion.
      expect(after.turnsSinceProgress).toBe(0);
      expect(after.status).toBe('ongoing');
      assertHistory(after.history[after.history.length - 1]);
      assertAfter(after);
      expect(computeMaterialScore(after.board, 'A', after.dimensions)).toBe(materialAfter[0]);
      expect(computeMaterialScore(after.board, 'B', after.dimensions)).toBe(materialAfter[1]);

      // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
      const ended = playQuietPlies(after, ANTI_STALEMATE_TURN_LIMIT);
      expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
      expect(ended.status).toBe('anti_stalemate');
      // Material decides it (README §8.2): A is always ahead.
      expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
      expect(ended.winner).toBe('A');
    },
  );

  it.each(CASES)(
    '$name at the brink (counter 18) rescues the game from the imminent anti-stalemate ending',
    ({ setup, act }) => {
      let current = setup();
      // 18 quiet plies — two shy of the limit. Without the action, two more would end the game.
      current = playQuietPlies(current, 18);
      expect(current.turnsSinceProgress).toBe(18);
      expect(current.status).toBe('ongoing');
      expect(current.turn).toBe('A'); // even plies → A to move: the special piece can act now

      const result = act(current);
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      current = result.state;

      // The action resets the counter instead of letting it cross the threshold.
      expect(current.turnsSinceProgress).toBe(0);
      expect(current.status).toBe('ongoing');
      // The full anti-stalemate countdown restarts from zero and the game still ends properly.
      current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
      expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
      expect(current.status).toBe('anti_stalemate');
      expect(current.winner).toBe('A');
    },
  );
});
