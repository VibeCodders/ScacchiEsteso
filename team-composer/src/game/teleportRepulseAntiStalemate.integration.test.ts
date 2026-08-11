import { describe, expect, it } from 'vitest';
import { applyRepulse, applyTeleport, applyTurn, createInitialGameState, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { getTeleportTargets } from './teleport';
import { getRepulseTargets } from './repulse';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// From pieces.json: RE = 15, PE = 7, RP = 10, TT = 22.
const RE_PUNTI = 15;
const PE_PUNTI = 7;
const RP_PUNTI = 10;
const TT_PUNTI = 22;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/**
 * A: RE a1 + the special piece at d4, B: RE h8 + PE (the action's subject).
 * The two Kings shuffle between their two squares as the quiet plies; the special action is A's
 * progress move that resets the anti-stalemate counter (README §8.1 — a board-changing special
 * action counts as progress, like swap/revival/attira).
 * - Teletrasporto: PE at d6, teleport d4 → d7 (empty, exactly 3 squares north — no capture).
 * - Repulsore: PE at d5, push d4 → d5 lands it on d6 (mirrored past the RP — no capture).
 */
function gameWithSpecial(sigla: 'TT' | 'RP'): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', sigla, 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, sigla === 'TT' ? 'd6' : 'd5', 'PE', 'B');
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

describe('integration — the Teletrasporto resets the anti-stalemate counter in a complete game', () => {
  it('quiet plies build the counter, the teleport resets it to 0, and the game ends by anti-stalemate on material', () => {
    const state = gameWithSpecial('TT');
    expect(state.status).toBe('ongoing');
    expect(state.turnsSinceProgress).toBe(0);

    // Four quiet plies (two full King shuffles) push the counter up.
    const quiet = playQuietPlies(state, 4);
    expect(quiet.turnsSinceProgress).toBe(4);
    expect(quiet.status).toBe('ongoing');

    // The teleport is offered by the engine and lands on the empty square at exactly 3 north (d7).
    expect(getTeleportTargets(quiet.board, 'd4', 'A', quiet.dimensions)).toContain('d7');
    const teleport = applyTeleport(quiet, 'd4', 'd7');
    expect(teleport.ok).toBe(true);
    if (!teleport.ok) return;
    const afterTeleport = teleport.state;

    // The teleport resets the anti-stalemate counter — this is the core assertion.
    expect(afterTeleport.turnsSinceProgress).toBe(0);
    expect(afterTeleport.status).toBe('ongoing');
    expect(afterTeleport.history[afterTeleport.history.length - 1]).toMatchObject({
      sigla: 'TT', from: 'd4', to: 'd7', isTeleport: true,
    });
    expect(afterTeleport.board.get('d7')?.sigla).toBe('TT'); // the TT actually relocated
    expect(afterTeleport.board.get('d4')).toBeUndefined();
    // The teleport captures nothing, so material is untouched.
    expect(computeMaterialScore(afterTeleport.board, 'A', afterTeleport.dimensions)).toBe(RE_PUNTI + TT_PUNTI);
    expect(computeMaterialScore(afterTeleport.board, 'B', afterTeleport.dimensions)).toBe(RE_PUNTI + PE_PUNTI);

    // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
    const ended = playQuietPlies(afterTeleport, ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.status).toBe('anti_stalemate');
    // Material decides it (README §8.2): A = 37 (RE+TT) vs B = 22 (RE+PE).
    expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
    expect(ended.winner).toBe('A');
  });

  it('a teleport at the brink (counter at 18) rescues the game from the imminent anti-stalemate ending', () => {
    let current = gameWithSpecial('TT');
    // 18 quiet plies — two shy of the limit. Without the teleport, two more would end the game.
    current = playQuietPlies(current, 18);
    expect(current.turnsSinceProgress).toBe(18);
    expect(current.status).toBe('ongoing');
    expect(current.turn).toBe('A'); // even plies → A to move: the TT can act now

    const teleport = applyTeleport(current, 'd4', 'd7');
    expect(teleport.ok).toBe(true);
    if (!teleport.ok) return;
    current = teleport.state;

    // The teleport resets the counter instead of letting it cross the threshold.
    expect(current.turnsSinceProgress).toBe(0);
    expect(current.status).toBe('ongoing');
    // The full anti-stalemate countdown restarts from zero and the game still ends properly.
    current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
    expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(current.status).toBe('anti_stalemate');
    expect(current.winner).toBe('A'); // material 37 vs 22, unchanged by the capture-free teleport
  });
});

describe('integration — the Repulsore resets the anti-stalemate counter in a complete game', () => {
  it('quiet plies build the counter, the push resets it to 0, and the game ends by anti-stalemate on material', () => {
    const state = gameWithSpecial('RP');
    expect(state.status).toBe('ongoing');
    expect(state.turnsSinceProgress).toBe(0);

    // Four quiet plies (two full King shuffles) push the counter up.
    const quiet = playQuietPlies(state, 4);
    expect(quiet.turnsSinceProgress).toBe(4);
    expect(quiet.status).toBe('ongoing');

    // The push is offered by the engine: the adjacent PE d5 lands one square away (d6).
    expect(getRepulseTargets(quiet.board, 'd4', 'A', quiet.dimensions)).toContain('d5');
    const push = applyRepulse(quiet, 'd4', 'd5');
    expect(push.ok).toBe(true);
    if (!push.ok) return;
    const afterPush = push.state;

    // The push resets the anti-stalemate counter — this is the core assertion.
    expect(afterPush.turnsSinceProgress).toBe(0);
    expect(afterPush.status).toBe('ongoing');
    expect(afterPush.history[afterPush.history.length - 1]).toMatchObject({
      sigla: 'RP', from: 'd4', to: 'd5', isRepulse: true, repulsedTo: 'd6',
    });
    expect(afterPush.board.get('d6')?.sigla).toBe('PE'); // the enemy landed one square further
    expect(afterPush.board.get('d6')?.owner).toBe('B');
    expect(afterPush.board.get('d5')).toBeUndefined();
    // The push captures nothing, so material is untouched.
    expect(computeMaterialScore(afterPush.board, 'A', afterPush.dimensions)).toBe(RE_PUNTI + RP_PUNTI);
    expect(computeMaterialScore(afterPush.board, 'B', afterPush.dimensions)).toBe(RE_PUNTI + PE_PUNTI);

    // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
    const ended = playQuietPlies(afterPush, ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.status).toBe('anti_stalemate');
    // Material decides it (README §8.2): A = 25 (RE+RP) vs B = 22 (RE+PE).
    expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
    expect(ended.winner).toBe('A');
  });

  it('a push at the brink (counter at 18) rescues the game from the imminent anti-stalemate ending', () => {
    let current = gameWithSpecial('RP');
    // 18 quiet plies — two shy of the limit. Without the push, two more would end the game.
    current = playQuietPlies(current, 18);
    expect(current.turnsSinceProgress).toBe(18);
    expect(current.status).toBe('ongoing');
    expect(current.turn).toBe('A'); // even plies → A to move: the RP can act now

    const push = applyRepulse(current, 'd4', 'd5');
    expect(push.ok).toBe(true);
    if (!push.ok) return;
    current = push.state;

    // The push resets the counter instead of letting it cross the threshold.
    expect(current.turnsSinceProgress).toBe(0);
    expect(current.status).toBe('ongoing');
    // The full anti-stalemate countdown restarts from zero and the game still ends properly.
    current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
    expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(current.status).toBe('anti_stalemate');
    expect(current.winner).toBe('A'); // material 25 vs 22, unchanged by the capture-free push
  });
});
