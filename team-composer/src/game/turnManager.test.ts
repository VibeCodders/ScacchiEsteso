import { describe, expect, it } from 'vitest';
import { createInitialGameState, applyTurn } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('createInitialGameState', () => {
  it('starts with turn 1, the given player to move, empty history, and no captures', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.turn).toBe('A');
    expect(state.turnNumber).toBe(1);
    expect(state.history).toEqual([]);
    expect(state.captured).toEqual({ A: [], B: [] });
    expect(state.status).toBe('ongoing');
  });

  it('computes the initial status (e.g. an immediate check) up front', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'TO', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('check');
  });
});

describe('applyTurn — basic move application', () => {
  it('moves the piece, switches turn, and advances the turn number', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
  });

  it('records a history entry with from/to/sigla/capture info', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.history).toHaveLength(1);
    expect(result.state.history[0]).toMatchObject({
      turnNumber: 1,
      owner: 'A',
      from: 'd4',
      to: 'd7',
      sigla: 'TO',
      isCapture: true,
      capturedCoord: 'd7',
      capturedSigla: 'PE',
    });
  });

  it('adds a captured piece to the losing owner\'s captured list', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.captured.B).toHaveLength(1);
    expect(result.state.captured.B[0].sigla).toBe('PE');
    expect(result.state.captured.A).toHaveLength(0);
  });

  it('does not record a captured piece for a non-capturing move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'e1', 'd1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.captured).toEqual({ A: [], B: [] });
  });
});

describe('applyTurn — rejects invalid attempts without mutating state', () => {
  it('rejects a move from an empty square', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
  });

  it("rejects moving a piece that belongs to the player who isn't on turn", () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A'); // A to move, but d7 belongs to B

    const result = applyTurn(state, 'd7', 'd6');
    expect(result.ok).toBe(false);
  });

  it('rejects a pseudo-legal-but-illegal move that would leave the mover\'s own King in check', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'TO', 'A');
    board = place(board, 'e8', 'TO', 'B');
    board = place(board, 'a1', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'e5', 'd5'); // stepping off the e-file exposes the King
    expect(result.ok).toBe(false);
  });

  it('rejects any move once the game has ended in checkmate', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('checkmate');

    const result = applyTurn(state, 'a1', 'a2');
    expect(result.ok).toBe(false);
  });

  it('does not mutate the original state object on a rejected move', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    applyTurn(state, 'z9', 'z8');
    expect(state.turn).toBe('A');
    expect(state.history).toEqual([]);
  });
});

describe('applyTurn — game status transitions', () => {
  it('flags "check" on the opponent right after a checking move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd8', 'RE', 'B');
    board = place(board, 'd1', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd1', 'd5'); // rook now has a clear line to the Black King on d8
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('check');
    expect(result.state.turn).toBe('B');
  });

  it('flags "checkmate" and records the winner when the delivered move is mate', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h1', 'RE', 'B');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'c8', 'TO', 'B');
    const state = createInitialGameState(board, 'B');
    expect(state.status).toBe('ongoing');

    const result = applyTurn(state, 'c8', 'b8'); // completes the corner mate on a1
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('checkmate');
    expect(result.state.winner).toBe('B');
  });
});
