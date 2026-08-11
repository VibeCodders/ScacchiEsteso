import { describe, expect, it } from 'vitest';
import { applyAttract, applyTurn, createInitialGameState, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { getAttractTargets } from './vortex';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// RE = 15 pt, VZ = 24 pt, PE = 7 pt (from pieces.json).
const RE_PUNTI = 15;
const VZ_PUNTI = 24;
const PE_PUNTI = 7;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/**
 * A: RE a1 + VZ d4, B: RE h8 + PE d6 (the pull target: 2 squares north of the VZ, landing d5).
 * The two Kings shuffle between their two squares as the quiet plies; the VZ's \"attira\" is A's
 * progress action that resets the anti-stalemate counter (README §8.1 — a board-changing special
 * action counts as progress, like swap/repulse/teleport).
 */
function gameWithVortex(): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'VZ', 'A');
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

describe('integration — the Vortice\'s attira resets the anti-stalemate counter in a complete game', () => {
  it('quiet plies build the counter, the pull resets it to 0, and the game ends by anti-stalemate on material', () => {
    const state = gameWithVortex();
    expect(state.status).toBe('ongoing');
    expect(state.turnsSinceProgress).toBe(0);

    // Four quiet plies (two full King shuffles) push the counter up.
    const quiet = playQuietPlies(state, 4);
    expect(quiet.turnsSinceProgress).toBe(4);
    expect(quiet.status).toBe('ongoing');

    // The pull is offered by the engine and lands the PE one square closer (d6 → d5).
    expect(getAttractTargets(quiet.board, 'd4', 'A')).toContain('d6');
    const pull = applyAttract(quiet, 'd4', 'd6');
    expect(pull.ok).toBe(true);
    if (!pull.ok) return;
    const afterPull = pull.state;

    // The pull resets the anti-stalemate counter — this is the core assertion.
    expect(afterPull.turnsSinceProgress).toBe(0);
    expect(afterPull.status).toBe('ongoing');
    expect(afterPull.history[afterPull.history.length - 1]).toMatchObject({
      sigla: 'VZ', from: 'd4', to: 'd6', isAttract: true, attractedTo: 'd5',
    });
    expect(afterPull.board.get('d5')?.sigla).toBe('PE'); // the enemy landed one square closer
    expect(afterPull.board.get('d5')?.owner).toBe('B');
    expect(afterPull.board.get('d6')).toBeUndefined();
    // The pull captures nothing, so material is untouched.
    expect(computeMaterialScore(afterPull.board, 'A', afterPull.dimensions)).toBe(RE_PUNTI + VZ_PUNTI);
    expect(computeMaterialScore(afterPull.board, 'B', afterPull.dimensions)).toBe(RE_PUNTI + PE_PUNTI);

    // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
    const ended = playQuietPlies(afterPull, ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.status).toBe('anti_stalemate');
    // Material decides it (README §8.2): A = 39 (RE+VZ) vs B = 22 (RE+PE).
    expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
    expect(ended.winner).toBe('A');
  });

  it('a pull at the brink (counter at 18) rescues the game from the imminent anti-stalemate ending', () => {
    let current = gameWithVortex();
    // 18 quiet plies — two shy of the limit. Without the pull, two more would end the game.
    current = playQuietPlies(current, 18);
    expect(current.turnsSinceProgress).toBe(18);
    expect(current.status).toBe('ongoing');
    expect(current.turn).toBe('A'); // even plies → A to move: the VZ can act now

    const pull = applyAttract(current, 'd4', 'd6');
    expect(pull.ok).toBe(true);
    if (!pull.ok) return;
    current = pull.state;

    // The pull resets the counter instead of letting it cross the threshold.
    expect(current.turnsSinceProgress).toBe(0);
    expect(current.status).toBe('ongoing');
    // The full anti-stalemate countdown restarts from zero and the game still ends properly.
    current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
    expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(current.status).toBe('anti_stalemate');
    expect(current.winner).toBe('A'); // material 39 vs 22, unchanged by the capture-free pull
  });
});
