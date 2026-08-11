import { describe, expect, it } from 'vitest';
import { generatePseudoLegalMoves } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { createInitialGameState, applyTurn } from './turnManager';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A'): BoardState {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

function destinations(board: BoardState, from: string, dims = { width: 8, height: 8 }): string[] {
  return generatePseudoLegalMoves(board, from, dims).map((m) => m.to).sort();
}

/** Kings far apart + the piece under test, ready for turnManager calls. */
function gameWith(extraPieces: Array<[string, string, 'A' | 'B']>, firstTurn: 'A' | 'B' = 'A') {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'h8', 'RE', 'B');
  for (const [coord, sigla, owner] of extraPieces) board = place(board, coord, sigla, owner);
  return createInitialGameState(board, firstTurn);
}

describe('Drago (DR) — union of a rook slide and a knight-pattern leap', () => {
  it('combines both move sets into 22 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'DR');
    const moves = destinations(board, 'd4');
    expect(moves).toHaveLength(22);
    // Rook slide
    for (const sq of ['d1', 'd2', 'd3', 'd5', 'd6', 'd7', 'd8', 'a4', 'b4', 'c4', 'e4', 'f4', 'g4', 'h4']) {
      expect(moves).toContain(sq);
    }
    // Knight leap
    for (const sq of ['b3', 'b5', 'c2', 'c6', 'e2', 'e6', 'f3', 'f5']) {
      expect(moves).toContain(sq);
    }
  });

  it('marks the knight lands as leap captures and the rook lands as melee captures', () => {
    let board = place(createEmptyBoard(), 'd4', 'DR', 'A');
    board = place(board, 'e6', 'PE', 'B'); // knight landing
    board = place(board, 'd6', 'PE', 'B'); // rook landing
    const moves = generatePseudoLegalMoves(board, 'd4');
    const knight = moves.find((m) => m.to === 'e6');
    expect(knight?.isCapture).toBe(true);
    expect(knight?.captureMode).toBe('leap');
    const rook = moves.find((m) => m.to === 'd6');
    expect(rook?.isCapture).toBe(true);
    expect(rook?.captureMode).toBe('melee');
  });

  it('the knight leap ignores interpositions while the rook slide stops at the first piece', () => {
    let board = place(createEmptyBoard(), 'd4', 'DR', 'A');
    board = place(board, 'e4', 'PE', 'A'); // ally directly on the east rook line
    board = place(board, 'c5', 'PE', 'B'); // sits on a knight path — must not matter
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('e4'); // rook blocked by the ally
    expect(moves).not.toContain('f4'); // …and cannot slide past it
    expect(moves).toContain('e6'); // knight landing over c5/d5 unaffected
    expect(moves).toContain('b5'); // knight landing over c5 unaffected
    expect(moves).toContain('c6');
  });

  it('captures on both move sets, stopping at the first obstacle on the rook lines', () => {
    let board = place(createEmptyBoard(), 'd4', 'DR', 'A');
    board = place(board, 'd6', 'PE', 'B'); // rook capture 2 squares north
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.map((m) => m.to)).toContain('d6');
    expect(moves.map((m) => m.to)).not.toContain('d7'); // no sliding past the capture
    expect(moves.map((m) => m.to)).not.toContain('d8');
    expect(moves.map((m) => m.to)).toContain('e6'); // knight reach unaffected
  });

  it('mirrors cleanly for Player B (rook lines and knight pattern are direction-independent)', () => {
    const board = place(createEmptyBoard(), 'e7', 'DR', 'B');
    const moves = destinations(board, 'e7');
    expect(moves).toContain('e1'); // rook slide south, all the way down
    expect(moves).toContain('h7'); // rook slide east
    expect(moves).toContain('g6'); // knight landing (e7 is an edge rank, so only 6 of 8 lands fit)
    expect(moves).toContain('c6'); // knight landing
    expect(moves).toHaveLength(20);
  });

  it('respects custom board dimensions (rook slide reaches the true board edge)', () => {
    const board = place(createEmptyBoard(), 'd4', 'DR');
    const dims = { width: 10, height: 8 };
    const moves = destinations(board, 'd4', dims);
    expect(moves).toContain('j4'); // 10th file — off-board on an 8×8
    expect(moves).not.toContain('k4');
  });

  it('plays a full turn through turnManager: moves, captures and respects king safety', () => {
    const state = gameWith([['d4', 'DR', 'A'], ['d6', 'PE', 'B']]);
    const move = applyTurn(state, 'd4', 'd6'); // rook capture
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    expect(move.state.board.get('d6')?.sigla).toBe('DR');
    expect(move.state.turn).toBe('B');
    expect(move.state.captured.B).toHaveLength(1);
  });
});
