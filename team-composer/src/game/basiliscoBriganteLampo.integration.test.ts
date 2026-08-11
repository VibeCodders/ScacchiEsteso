import { describe, expect, it } from 'vitest';
import { chooseBotAction, generateBotActions, applyBotAction, type BotAction } from './bot';
import { createInitialGameState, getLegalMovesForTurn, type GameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

const TERMINAL: ReadonlySet<GameState['status']> = new Set(['checkmate', 'stalemate', 'anti_stalemate']);

interface PlayedMove {
  before: GameState;
  action: BotAction;
}

/** Plays a bot-vs-bot game (difficulty 5 = 1 ply, deterministic) until a terminal status. */
function playFullGame(state: GameState, trackPieces: string[] = [], maxPlies = 120): { final: GameState; moves: PlayedMove[] } {
  const moves: PlayedMove[] = [];
  let current = state;
  let plies = 0;

  while (!TERMINAL.has(current.status) && plies < maxPlies) {
    const action = chooseBotAction(current, current.turn, 5);
    expect(action).not.toBeNull();
    if (!action) break;
    moves.push({ before: current, action });

    const result = applyBotAction(current, action);
    expect(result.ok).toBe(true);
    if (!result.ok) break;
    current = result.state;

    expect([...current.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'A')).toBe(true);
    expect([...current.board.values()].some((p) => p.sigla === 'RE' && p.owner === 'B')).toBe(true);
    plies++;
  }

  expect(TERMINAL.has(current.status)).toBe(true); // the game actually completed

  const moved = new Set<string>();
  for (const { before, action } of moves) {
    if (action.kind !== 'move') continue;
    const piece = getPieceAt(before.board, action.from);
    if (!piece || !trackPieces.includes(piece.sigla)) continue;
    moved.add(piece.sigla);
    const legalTos = getLegalMovesForTurn(before, action.from).map((m) => m.to);
    expect(legalTos).toContain(action.to);
  }
  for (const sigla of trackPieces) expect(moved.has(sigla)).toBe(true);

  return { final: current, moves };
}

describe('bot integration — Brigante (BR) uses sostituzione in complete games', () => {
  function brigantePosition(): GameState {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'BR', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'd5', 'PE', 'B'); // adjacent enemy — swap material: BR d4 <-> PE d5
    return createInitialGameState(board, 'A');
  }

  it('enumerates the sostituzione and plays it through the full game', () => {
    const state = brigantePosition();
    expect(state.status).toBe('ongoing');

    // The engine offers the enemy-swap as a discoverable action, and the bot enumerates it.
    expect(getLegalMovesForTurn(state, 'd4').length).toBeGreaterThan(0);
    expect(generateBotActions(state, 'A')).toContainEqual({ kind: 'sostituzione', from: 'd4', target: 'd5' });

    // Play the swap as the turn's action through the bot dispatcher: the two pieces exchange
    // squares, no capture, the counter resets, and the game continues to completion with the BR
    // moving legally throughout.
    const played = applyBotAction(state, { kind: 'sostituzione', from: 'd4', target: 'd5' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    const after = played.state;
    expect(after.board.get('d5')?.sigla).toBe('BR');
    expect(after.board.get('d4')?.sigla).toBe('PE');
    expect(after.turnsSinceProgress).toBe(0);
    expect(after.history[0]).toMatchObject({ sigla: 'BR', isSostituzione: true, sostituitoCon: 'd5' });

    playFullGame(after, ['BR'], 60);
  });

  it('the 1-ply bot takes a free capture when it also has a sostituzione available (no capture loss)', () => {
    // BR next to an enemy TO it can capture outright: the bot should prefer the capture, and the
    // sostituzione remains enumerated as an alternative.
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'BR', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'e4', 'TO', 'B'); // adjacent enemy, capturable in melee (27 pt)
    const state = createInitialGameState(board, 'A');
    expect(generateBotActions(state, 'A')).toContainEqual({ kind: 'sostituzione', from: 'd4', target: 'e4' });
    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'e4' });
  });
});

describe('bot integration — Basilisco (BS) directional freeze in complete games', () => {
  it('a piece in the gaze is fully frozen, then the game plays to completion', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'BS', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'd5', 'TO', 'B'); // in the gaze (first square ahead): only d4 (capture) left
    board = place(board, 'h5', 'PE', 'A'); // a target so the board is not dead quiet
    const state = createInitialGameState(board, 'A');

    // The frozen TO keeps only the escape capture of the Basilisco.
    expect(getLegalMovesForTurn(state, 'd5').map((m) => m.to)).toEqual(['d4']);
    // ...but that capture would be suicide-adjacent for B's material: the bot (B side) still has
    // its King; the game must remain playable for both sides.
    expect(state.status).toBe('ongoing');

    const { final } = playFullGame(state, ['BS'], 80);
    expect(final.status).toBe('anti_stalemate'); // no forced trades — the game ends by the clock
  });

  it('the Bot does not freeze its own side (owner check) and plays the BS legally', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'BS', 'A');
    board = place(board, 'd5', 'PE', 'A'); // own pawn in the gaze — unaffected
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'c5', 'PE', 'B'); // enemy pawn OUT of the gaze — moves normally
    const state = createInitialGameState(board, 'A');

    // d5→d6 and d5→d7 (the PE's double first step) — fully unaffected by the own BS's gaze.
    expect(getLegalMovesForTurn(state, 'd5').map((m) => m.to)).toEqual(['d6', 'd7']);
    // Enemy PE at c5 is OUT of the gaze (BS at d4 stares d5/d6/d7): it moves forward (c4, c3)
    // and captures diagonally toward the BS (d4) — nothing frozen.
    expect(getLegalMovesForTurn(state, 'c5').map((m) => m.to)).toEqual(['c4', 'c3', 'd4']);

    playFullGame(state, ['BS'], 80);
  });
});

describe('bot integration — Lampo (LP) dabbaba leaps in complete games', () => {
  function lampoPosition(): GameState {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'LP', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'd6', 'TO', 'B'); // exactly 2 north — the dabbaba capture
    return createInitialGameState(board, 'A');
  }

  it('enumerates and plays the exact-2 jump capture, then finishes the game', () => {
    const state = lampoPosition();
    expect(state.status).toBe('ongoing');

    expect(getLegalMovesForTurn(state, 'd4').map((m) => m.to)).toContain('d6');
    expect(generateBotActions(state, 'A')).toContainEqual({ kind: 'move', from: 'd4', to: 'd6' });

    // A free 27pt capture is the only capture on the board — the 1-ply bot takes it.
    expect(chooseBotAction(state, 'A', 5)).toEqual({ kind: 'move', from: 'd4', to: 'd6' });
    const played = applyBotAction(state, { kind: 'move', from: 'd4', to: 'd6' });
    expect(played.ok).toBe(true);
    if (!played.ok) return;
    expect(played.state.history[0]).toMatchObject({ sigla: 'LP', from: 'd4', to: 'd6', isCapture: true, capturedSigla: 'TO' });

    playFullGame(played.state, ['LP'], 60);
  });

  it('never offers 1- or 3-square moves (exact-2 only), even in a full game', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'LP', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'd5', 'PE', 'A'); // would be a 1-step landing — never offered
    board = place(board, 'd7', 'PE', 'B'); // would be a 3-step landing — never offered
    const state = createInitialGameState(board, 'A');

    const tos = getLegalMovesForTurn(state, 'd4').map((m) => m.to);
    expect(tos).not.toContain('d5');
    expect(tos).not.toContain('d7');
    expect(tos).toContain('d6'); // the exact-2 leap over the ally still works
  });
});
