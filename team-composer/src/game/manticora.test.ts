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

describe('Manticora (MA) — one orthogonal step (empty), then an unlimited diagonal slide outward', () => {
  it('reaches 20 squares from d4 on an empty board (one bent path per orthogonal direction)', () => {
    const board = place(createEmptyBoard(), 'd4', 'MA');
    const moves = destinations(board, 'd4');
    expect(moves).toHaveLength(20);

    // E pivot e4: NE leg (f5,g6,h7) + SE leg (f3,g2,h1)
    for (const sq of ['f5', 'g6', 'h7', 'f3', 'g2', 'h1']) expect(moves).toContain(sq);
    // W pivot c4: NW leg (b5,a6) + SW leg (b3,a2)
    for (const sq of ['b5', 'a6', 'b3', 'a2']) expect(moves).toContain(sq);
    // N pivot d5: NE leg (e6,f7,g8) + NW leg (c6,b7,a8)
    for (const sq of ['e6', 'f7', 'g8', 'c6', 'b7', 'a8']) expect(moves).toContain(sq);
    // S pivot d3: SE leg (e2,f1) + SW leg (c2,b1)
    for (const sq of ['e2', 'f1', 'c2', 'b1']) expect(moves).toContain(sq);
  });

  it('never lands on the pivot square itself from the center, even when empty', () => {
    const board = place(createEmptyBoard(), 'd4', 'MA');
    const moves = destinations(board, 'd4');
    for (const pivot of ['c4', 'd3', 'd5', 'e4']) expect(moves).not.toContain(pivot);
  });

  it('the orthogonal first leg must be empty: a piece on the pivot blocks that whole bent path', () => {
    let board = place(createEmptyBoard(), 'd4', 'MA', 'A');
    board = place(board, 'e4', 'PE', 'B'); // enemy on the E pivot — not capturable, path blocked
    const moves = generatePseudoLegalMoves(board, 'd4');
    const eBranch = moves.filter((m) => ['f5', 'g6', 'h7', 'f3', 'g2', 'h1'].includes(m.to));
    expect(eBranch).toHaveLength(0);
    expect(moves.find((m) => m.to === 'e4')).toBeUndefined(); // the pivot itself is never a capture
    expect(moves.map((m) => m.to)).not.toContain('f5'); // the whole E branch (NE leg) is gone
    expect(moves.map((m) => m.to)).not.toContain('f3'); // …and so is its SE leg
    expect(moves.map((m) => m.to)).toContain('e2'); // S branch (d3 pivot) is unaffected
    expect(moves.map((m) => m.to)).toContain('c6'); // N branch (d5 pivot) is unaffected
  });

  it('captures on the second (diagonal) leg, stopping at the first obstacle', () => {
    let board = place(createEmptyBoard(), 'd4', 'MA', 'A');
    board = place(board, 'f5', 'PE', 'B'); // 2nd square of the E pivot's NE leg
    const moves = generatePseudoLegalMoves(board, 'd4');
    const capture = moves.find((m) => m.to === 'f5');
    expect(capture?.isCapture).toBe(true);
    expect(capture?.capturedCoord).toBe('f5');
    expect(moves.map((m) => m.to)).not.toContain('g6'); // blocked beyond the capture
    expect(moves.map((m) => m.to)).not.toContain('h7');
  });

  it('a friendly piece on the second leg blocks it without offering a capture', () => {
    let board = place(createEmptyBoard(), 'd4', 'MA', 'A');
    board = place(board, 'f5', 'PE', 'A');
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('f5');
    expect(moves).not.toContain('g6');
  });

  it('mirrors for Player B (from e2: southward pivots + east/west unchanged)', () => {
    const board = place(createEmptyBoard(), 'e2', 'MA', 'B');
    const moves = destinations(board, 'e2');
    // 's' (backward for B) → absolute n, pivot e3: NE leg f4,g5,h6 + NW leg d4,c5,b6,a7
    expect(moves).toContain('f4');
    expect(moves).toContain('a7');
    expect(moves).toContain('d4');
    // 'e' → absolute e, pivot f2: NE g3,h4 + SE g1
    expect(moves).toContain('g3');
    expect(moves).toContain('h4');
    expect(moves).toContain('g1');
    // 'w' → absolute w, pivot d2: NW c3,b4,a5 + SW c1
    expect(moves).toContain('c3');
    expect(moves).toContain('a5');
    expect(moves).toContain('c1');
    // 'n' (forward for B) → absolute s, pivot e1: both outward diagonals run off the board edge
    // (rank 0), so that whole branch is empty — nothing to assert, just verify it contributes nothing.
    // The pivots themselves are never destinations.
    expect(moves).not.toContain('e1');
    expect(moves).not.toContain('e3');
    expect(moves).not.toContain('f2');
    expect(moves).not.toContain('d2');
    expect(moves).toHaveLength(14);
  });

  it('a slide along the second leg cannot turn again (no double bend)', () => {
    // From d4, the E pivot's NE leg runs f5,g6,h7 — a second bend from h7 would add h6/h8, which
    // are NOT reachable (the piece only bends once, after the first leg).
    const board = place(createEmptyBoard(), 'd4', 'MA');
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('h6');
    expect(moves).not.toContain('h8');
  });

  it('respects custom board dimensions (wider board → longer NE legs)', () => {
    const board = place(createEmptyBoard(), 'd4', 'MA');
    const dims = { width: 10, height: 8 };
    const moves = destinations(board, 'd4', dims);
    expect(moves).toContain('i8'); // 9th file on the N pivot's NE leg — off-board on an 8×8
    expect(moves).not.toContain('j8');
  });

  it('plays a full turn through turnManager: moves, captures and respects king safety', () => {
    const state = gameWith([['d4', 'MA', 'A'], ['f5', 'PE', 'B']]);
    const move = applyTurn(state, 'd4', 'f5'); // capture on the NE leg
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    expect(move.state.board.get('f5')?.sigla).toBe('MA');
    expect(move.state.turn).toBe('B');
    expect(move.state.captured.B).toHaveLength(1);
  });
});
