import { describe, expect, it } from 'vitest';
import { applySwapperSwap, applyTurn, createInitialGameState, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { getSwapperCandidatePairs } from './swapper';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// From pieces.json: RE = 15, PE = 7, SW = 28.
const RE_PUNTI = 15;
const PE_PUNTI = 7;
const SW_PUNTI = 28;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/**
 * A: RE a1 + SW d4 + allied PE e4, B: RE h8 + PE d6. The two Kings shuffle between their two
 * squares as the quiet plies; the Swapper's two-ally swap (d4 ↔ e4, exchanging the Swapper with
 * its adjacent ally) is A's progress action that resets the anti-stalemate counter (README §8.1 —
 * a board-changing special action counts as progress, like attira/teleport/repulse).
 */
function gameWithSwapper(): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'SW', 'A');
  board = place(board, 'e4', 'PE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'd6', 'PE', 'B');
  return createInitialGameState(board, 'A');
}

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

describe('integration — the Swapper resets the anti-stalemate counter in a complete game', () => {
  it('quiet plies build the counter, the swap resets it to 0, and the game ends by anti-stalemate on material', () => {
    const state = gameWithSwapper();
    expect(state.status).toBe('ongoing');
    expect(state.turnsSinceProgress).toBe(0);

    // Four quiet plies (two full King shuffles) push the counter up.
    const quiet = playQuietPlies(state, 4);
    expect(quiet.turnsSinceProgress).toBe(4);
    expect(quiet.status).toBe('ongoing');

    // The swap is offered by the engine: the only candidate pair swaps the SW with its ally PE.
    expect(getSwapperCandidatePairs(quiet.board, 'd4', 'A', quiet.dimensions)).toEqual([['d4', 'e4']]);
    const swap = applySwapperSwap(quiet, 'd4', 'd4', 'e4');
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    const afterSwap = swap.state;

    // The swap resets the anti-stalemate counter — this is the core assertion.
    expect(afterSwap.turnsSinceProgress).toBe(0);
    expect(afterSwap.status).toBe('ongoing');
    expect(afterSwap.history[afterSwap.history.length - 1]).toMatchObject({
      sigla: 'SW', from: 'd4', to: 'e4', isSwapperSwap: true, swapSquares: ['d4', 'e4'],
    });
    expect(afterSwap.board.get('e4')?.sigla).toBe('SW'); // the two allies exchanged squares
    expect(afterSwap.board.get('d4')?.sigla).toBe('PE');
    // The swap captures nothing, so material is untouched.
    expect(computeMaterialScore(afterSwap.board, 'A', afterSwap.dimensions)).toBe(RE_PUNTI + SW_PUNTI + PE_PUNTI);
    expect(computeMaterialScore(afterSwap.board, 'B', afterSwap.dimensions)).toBe(RE_PUNTI + PE_PUNTI);

    // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
    const ended = playQuietPlies(afterSwap, ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.status).toBe('anti_stalemate');
    // Material decides it (README §8.2): A = 50 (RE+SW+PE) vs B = 22 (RE+PE).
    expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
    expect(ended.winner).toBe('A');
  });

  it('a swap at the brink (counter at 18) rescues the game from the imminent anti-stalemate ending', () => {
    let current = gameWithSwapper();
    // 18 quiet plies — two shy of the limit. Without the swap, two more would end the game.
    current = playQuietPlies(current, 18);
    expect(current.turnsSinceProgress).toBe(18);
    expect(current.status).toBe('ongoing');
    expect(current.turn).toBe('A'); // even plies → A to move: the SW can act now

    const swap = applySwapperSwap(current, 'd4', 'd4', 'e4');
    expect(swap.ok).toBe(true);
    if (!swap.ok) return;
    current = swap.state;

    // The swap resets the counter instead of letting it cross the threshold.
    expect(current.turnsSinceProgress).toBe(0);
    expect(current.status).toBe('ongoing');
    // The full anti-stalemate countdown restarts from zero and the game still ends properly.
    current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
    expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(current.status).toBe('anti_stalemate');
    expect(current.winner).toBe('A'); // material 50 vs 22, unchanged by the capture-free swap
  });
});
