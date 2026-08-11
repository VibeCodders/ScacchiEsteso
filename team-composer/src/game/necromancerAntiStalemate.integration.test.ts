import { describe, expect, it } from 'vitest';
import { applyRevive, applyTurn, createInitialGameState, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
import { getRevivalSquares } from './necromancy';
import { computeMaterialScore, resolveAntiStalemateWinner, ANTI_STALEMATE_TURN_LIMIT } from './antiStalemate';

// From pieces.json: RE = 15, PE = 7, NE = 28.
const RE_PUNTI = 15;
const PE_PUNTI = 7;
const NE_PUNTI = 28;

function place(board: BoardState, coord: Coord, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/**
 * A: RE a1 + NE d4, B: RE h8 + PE d6, with a fallen PE in A's graveyard (simulating an earlier
 * capture). The two Kings shuffle between their two squares as the quiet plies; the Necromante's
 * \"rianimazione\" (reviving the PE onto the adjacent empty d5) is A's progress action that resets
 * the anti-stalemate counter (README §8.1 — a board-changing special action counts as progress,
 * like attira/teleport/repulse/swap).
 */
function gameWithNecromancer(): GameState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'NE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'd6', 'PE', 'B');
  const state = createInitialGameState(board, 'A');
  return { ...state, captured: { A: [createPieceInstance('PE', 'A')], B: [] } };
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

describe('integration — the Necromante resets the anti-stalemate counter in a complete game', () => {
  it('quiet plies build the counter, the revival resets it to 0, and the game ends by anti-stalemate on material', () => {
    const state = gameWithNecromancer();
    expect(state.status).toBe('ongoing');
    expect(state.turnsSinceProgress).toBe(0);

    // Four quiet plies (two full King shuffles) push the counter up.
    const quiet = playQuietPlies(state, 4);
    expect(quiet.turnsSinceProgress).toBe(4);
    expect(quiet.status).toBe('ongoing');

    // The revival is offered by the engine: d5 is adjacent to the NE and empty.
    expect(getRevivalSquares(quiet.board, 'd4', 'A', quiet.dimensions)).toContain('d5');
    const revival = applyRevive(quiet, 'd4', 'd5', 'PE');
    expect(revival.ok).toBe(true);
    if (!revival.ok) return;
    const afterRevival = revival.state;

    // The revival resets the anti-stalemate counter — this is the core assertion.
    expect(afterRevival.turnsSinceProgress).toBe(0);
    expect(afterRevival.status).toBe('ongoing');
    expect(afterRevival.history[afterRevival.history.length - 1]).toMatchObject({
      sigla: 'NE', from: 'd4', to: 'd5', isRevival: true, revivedSigla: 'PE',
    });
    expect(afterRevival.board.get('d5')?.sigla).toBe('PE'); // the fallen ally is back on the board
    expect(afterRevival.board.get('d5')?.owner).toBe('A');
    expect(afterRevival.captured.A).toHaveLength(0); // the revived PE left the graveyard
    // Reviving adds the PE's punti back to A's material (50 vs 22).
    expect(computeMaterialScore(afterRevival.board, 'A', afterRevival.dimensions)).toBe(RE_PUNTI + NE_PUNTI + PE_PUNTI);
    expect(computeMaterialScore(afterRevival.board, 'B', afterRevival.dimensions)).toBe(RE_PUNTI + PE_PUNTI);

    // From the reset, ANTI_STALEMATE_TURN_LIMIT more quiet plies end the game.
    const ended = playQuietPlies(afterRevival, ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(ended.status).toBe('anti_stalemate');
    // Material decides it (README §8.2): A = 50 (RE+NE+PE) vs B = 22 (RE+PE).
    expect(resolveAntiStalemateWinner(ended.board, ended.dimensions)).toBe('A');
    expect(ended.winner).toBe('A');
  });

  it('a revival at the brink (counter at 18) rescues the game from the imminent anti-stalemate ending', () => {
    let current = gameWithNecromancer();
    // 18 quiet plies — two shy of the limit. Without the revival, two more would end the game.
    current = playQuietPlies(current, 18);
    expect(current.turnsSinceProgress).toBe(18);
    expect(current.status).toBe('ongoing');
    expect(current.turn).toBe('A'); // even plies → A to move: the NE can act now

    const revival = applyRevive(current, 'd4', 'd5', 'PE');
    expect(revival.ok).toBe(true);
    if (!revival.ok) return;
    current = revival.state;

    // The revival resets the counter instead of letting it cross the threshold.
    expect(current.turnsSinceProgress).toBe(0);
    expect(current.status).toBe('ongoing');
    // The full anti-stalemate countdown restarts from zero and the game still ends properly.
    current = playQuietPlies(current, ANTI_STALEMATE_TURN_LIMIT);
    expect(current.turnsSinceProgress).toBe(ANTI_STALEMATE_TURN_LIMIT);
    expect(current.status).toBe('anti_stalemate');
    expect(current.winner).toBe('A'); // material 50 vs 22 — the revival only added to A's lead
  });
});
