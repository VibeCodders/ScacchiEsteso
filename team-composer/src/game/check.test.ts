import { describe, expect, it } from 'vitest';
import { isKingInCheck, getLegalMoves, getAllLegalMoves, isCheckmate, isStalemate, findKingCoord } from './check';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('findKingCoord', () => {
  it('finds the King belonging to the given owner', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    expect(findKingCoord(board, 'A')).toBe('e1');
    expect(findKingCoord(board, 'B')).toBe('e8');
  });

  it('returns undefined when there is no King for that owner', () => {
    expect(findKingCoord(createEmptyBoard(), 'A')).toBeUndefined();
  });
});

describe('isKingInCheck', () => {
  it('is true when an enemy rook has a clear line to the King', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'TO', 'B');
    expect(isKingInCheck(board, 'A')).toBe(true);
  });

  it('is false when a piece blocks the line of attack', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'TO', 'B');
    board = place(board, 'e4', 'PE', 'A');
    expect(isKingInCheck(board, 'A')).toBe(false);
  });

  it('is false when the only piece on the board is the King itself', () => {
    const board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    expect(isKingInCheck(board, 'A')).toBe(false);
  });

  it('counts a Knight-style leap capture as a genuine threat (it physically lands on the King)', () => {
    let board = place(createEmptyBoard(), 'e4', 'RE', 'A');
    board = place(board, 'd6', 'CA', 'B'); // d6 -> e4 is a valid knight move
    expect(isKingInCheck(board, 'A')).toBe(true);
  });
});

describe('getLegalMoves — filters moves that would leave the mover\'s own King in check', () => {
  it('a King cannot move into a square attacked by an enemy piece', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'f8', 'TO', 'B'); // covers the whole f-file, including f1/f2
    const destinations = getLegalMoves(board, 'e1').map((m) => m.to);
    expect(destinations).not.toContain('f1');
    expect(destinations).not.toContain('f2');
    expect(destinations).toContain('d1'); // untouched escape square remains legal
  });

  it('a pinned piece cannot move off the line between the King and the attacker', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'TO', 'A');
    board = place(board, 'e8', 'TO', 'B');
    const destinations = getLegalMoves(board, 'e5').map((m) => m.to);
    expect(destinations).not.toContain('d5'); // stepping off the e-file exposes the King
    expect(destinations).toContain('e6'); // staying on the file still blocks the check
    expect(destinations).toContain('e8'); // capturing the attacker also resolves the check
  });

  it('returns nothing for an empty square', () => {
    expect(getLegalMoves(createEmptyBoard(), 'e4')).toEqual([]);
  });
});

describe('getAllLegalMoves', () => {
  it('collects legal moves across every piece owned by the given player', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'TO', 'A');
    const moves = getAllLegalMoves(board, 'A');
    expect(moves.some((m) => m.from === 'a1')).toBe(true);
    expect(moves.some((m) => m.from === 'd4')).toBe(true);
  });
});

describe('isCheckmate', () => {
  it('recognizes a classic corner mate (two rooks controlling every escape square)', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B'); // pins the King to the a-file — this is also the checking piece
    board = place(board, 'b8', 'TO', 'B'); // covers the entire b-file
    expect(isKingInCheck(board, 'A')).toBe(true);
    expect(getAllLegalMoves(board, 'A')).toEqual([]);
    expect(isCheckmate(board, 'A')).toBe(true);
  });

  it('is false if the King has at least one legal escape square', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    // b-file is left uncovered, so b1/b2 are legal escapes
    expect(isCheckmate(board, 'A')).toBe(false);
  });
});

describe('isStalemate', () => {
  it('recognizes a King with no legal moves that is not in check', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h2', 'TO', 'B'); // covers all of rank 2 (a2, b2, ...)
    board = place(board, 'b8', 'TO', 'B'); // covers all of file b (b1, b2, ...)
    expect(isKingInCheck(board, 'A')).toBe(false);
    expect(getAllLegalMoves(board, 'A')).toEqual([]);
    expect(isStalemate(board, 'A')).toBe(true);
  });

  it('is false whenever the player is in check (that is checkmate territory, not stalemate)', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    expect(isStalemate(board, 'A')).toBe(false); // this position is checkmate, not stalemate
  });

  it('is false whenever at least one legal move exists', () => {
    const board = place(createEmptyBoard(), 'e4', 'RE', 'A');
    expect(isStalemate(board, 'A')).toBe(false);
  });
});

describe('checkmate on a custom (non-default) board size', () => {
  it('detects a corner ladder-mate on a 4×4 board, where the same position is NOT checkmate under the default 8×8 bounds', () => {
    let board = place(createEmptyBoard(), 'a4', 'RE', 'B'); // cornered on a 4×4 board
    board = place(board, 'd4', 'TO', 'A'); // checks along rank 4
    board = place(board, 'd3', 'TO', 'A'); // covers rank 3, sealing off a3/b3
    board = place(board, 'd1', 'RE', 'A');

    const dims = { width: 4, height: 4 };
    expect(isKingInCheck(board, 'B', dims)).toBe(true);
    expect(isCheckmate(board, 'B', dims)).toBe(true);

    // Under the default 8×8 bounds the very same board has escape squares (a5, b5, ...) that
    // don't exist on the real 4×4 board — proving the dimensions parameter actually matters.
    expect(isCheckmate(board, 'B')).toBe(false);
  });
});
