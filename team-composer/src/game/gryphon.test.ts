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

describe('Grifone (GR) — one diagonal step (empty), then an unlimited orthogonal slide outward', () => {
  it('reaches 20 squares from d4 on an empty board (one bent path per diagonal)', () => {
    const board = place(createEmptyBoard(), 'd4', 'GR');
    const moves = destinations(board, 'd4');
    expect(moves).toHaveLength(20);

    // ne pivot e5: N leg (e6,e7,e8) + E leg (f5,g5,h5)
    for (const sq of ['e6', 'e7', 'e8', 'f5', 'g5', 'h5']) expect(moves).toContain(sq);
    // nw pivot c5: N leg (c6,c7,c8) + W leg (b5,a5)
    for (const sq of ['c6', 'c7', 'c8', 'b5', 'a5']) expect(moves).toContain(sq);
    // se pivot e3: S leg (e2,e1) + E leg (f3,g3,h3)
    for (const sq of ['e2', 'e1', 'f3', 'g3', 'h3']) expect(moves).toContain(sq);
    // sw pivot c3: S leg (c2,c1) + W leg (b3,a3)
    for (const sq of ['c2', 'c1', 'b3', 'a3']) expect(moves).toContain(sq);
  });

  it('never lands on the pivot square itself, even when empty', () => {
    const board = place(createEmptyBoard(), 'd4', 'GR');
    const moves = destinations(board, 'd4');
    for (const pivot of ['c3', 'c5', 'e3', 'e5']) expect(moves).not.toContain(pivot);
  });

  it('the diagonal first leg must be empty: a piece on the pivot blocks that whole bent path', () => {
    let board = place(createEmptyBoard(), 'd4', 'GR', 'A');
    board = place(board, 'e5', 'PE', 'B'); // enemy on the ne pivot — not capturable, path blocked
    const moves = generatePseudoLegalMoves(board, 'd4');
    const neBranch = moves.filter((m) => ['e6', 'e7', 'e8', 'f5', 'g5', 'h5'].includes(m.to));
    expect(neBranch).toHaveLength(0);
    expect(moves.find((m) => m.to === 'e5')).toBeUndefined(); // the pivot itself is never a capture
    expect(moves.map((m) => m.to)).not.toContain('f5'); // the whole ne branch is gone, not just the pivot
    expect(moves.map((m) => m.to)).toContain('f3'); // the se branch (e3 pivot) is unaffected
    expect(moves.map((m) => m.to)).toContain('c6'); // the nw branch (c5 pivot) is unaffected
  });

  it('captures on the second (orthogonal) leg, stopping at the first obstacle', () => {
    let board = place(createEmptyBoard(), 'd4', 'GR', 'A');
    board = place(board, 'e6', 'PE', 'B'); // 2nd square of the ne pivot's N leg
    const moves = generatePseudoLegalMoves(board, 'd4');
    const capture = moves.find((m) => m.to === 'e6');
    expect(capture?.isCapture).toBe(true);
    expect(capture?.capturedCoord).toBe('e6');
    expect(moves.map((m) => m.to)).not.toContain('e7'); // blocked beyond the capture
    expect(moves.map((m) => m.to)).not.toContain('e8');
  });

  it('a friendly piece on the second leg blocks it without offering a capture', () => {
    let board = place(createEmptyBoard(), 'd4', 'GR', 'A');
    board = place(board, 'e6', 'PE', 'A');
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('e6');
    expect(moves).not.toContain('e7');
  });

  it('mirrors for Player B (southward first leg from e7, E leg along rank 8)', () => {
    const board = place(createEmptyBoard(), 'e7', 'GR', 'B');
    const moves = destinations(board, 'e7');
    // 'se' (owner-relative) maps to absolute ne for B: pivot f8, E leg g8,h8 (N leg runs off board)
    expect(moves).toContain('g8');
    expect(moves).toContain('h8');
    // 'ne' maps to absolute se: pivot f6, S leg f5..f1 + E leg g6,h6
    expect(moves).toContain('f5');
    expect(moves).toContain('g6');
    // 'nw' maps to absolute sw: pivot d6, S leg d5..d1 + W leg c6,b6,a6
    expect(moves).toContain('d5');
    expect(moves).toContain('a6');
    // pivots are never destinations
    expect(moves).not.toContain('f6');
    expect(moves).not.toContain('d6');
    expect(moves).not.toContain('f8');
    expect(moves).not.toContain('d8');
    expect(moves).not.toContain('f9'); // off the board
  });

  it('a slide along the second leg cannot turn again (no double bend)', () => {
    // From d4, the ne pivot's E leg runs f5,g5,h5 — h5 is the edge. A second bend (e.g. from h5
    // northward) would add h6,h7,h8, which are NOT reachable.
    const board = place(createEmptyBoard(), 'd4', 'GR');
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('h6');
    expect(moves).not.toContain('h7');
    expect(moves).not.toContain('h8');
  });

  it('respects custom board dimensions (wider board → longer E legs)', () => {
    const board = place(createEmptyBoard(), 'd4', 'GR');
    const dims = { width: 10, height: 8 };
    const moves = destinations(board, 'd4', dims);
    expect(moves).toContain('j5'); // 10th file on the ne pivot's E leg — off-board on an 8×8
    expect(moves).toContain('j3'); // se pivot's E leg
    expect(moves).not.toContain('k5');
  });

  it('a Grifone frozen by an adjacent enemy Stunner loses every move (no Stunner-capturing path exists)', () => {
    let board = place(createEmptyBoard(), 'd4', 'GR', 'A');
    board = place(board, 'd5', 'ST', 'B');
    expect(destinations(board, 'd4')).toEqual([]);
  });

  it('plays a full turn through turnManager: moves, captures and respects king safety', () => {
    const state = gameWith([['d4', 'GR', 'A'], ['e6', 'PE', 'B']]);
    const move = applyTurn(state, 'd4', 'e6'); // capture on the N leg
    expect(move.ok).toBe(true);
    if (!move.ok) return;
    expect(move.state.board.get('e6')?.sigla).toBe('GR');
    expect(move.state.turn).toBe('B');
    expect(move.state.captured.B).toHaveLength(1);
  });
});
