import { describe, expect, it } from 'vitest';
import { applyTurn, createInitialGameState, getLegalMovesForTurn, skipExtraMove } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt } from './board';
import { generatePseudoLegalMoves } from './moveEngine';

function boardWith(...placements: Array<[string, string, 'A' | 'B']>): ReturnType<typeof createEmptyBoard> {
  let board = createEmptyBoard();
  for (const [coord, sigla, owner] of placements) {
    board = setPieceAt(board, coord, createPieceInstance(sigla, owner));
  }
  return board;
}

const moveTos = (board: ReturnType<typeof createEmptyBoard>, from: string) =>
  generatePseudoLegalMoves(board, from).map((m) => m.to).sort();

describe('Lampo — salto dabbaba (esattamente 2 caselle ortogonali)', () => {
  it('reaches exactly the four orthogonal squares at distance 2 from the center', () => {
    const board = boardWith(['d4', 'LP', 'A']);
    expect(moveTos(board, 'd4')).toEqual(['b4', 'd2', 'd6', 'f4']);
  });

  it('never moves 1 or 3 squares, and never diagonally', () => {
    const board = boardWith(['d4', 'LP', 'A']);
    const targets = moveTos(board, 'd4');
    expect(targets).not.toContain('d5'); // 1 square
    expect(targets).not.toContain('e4'); // 1 square
    expect(targets).not.toContain('f6'); // diagonal 2
    expect(targets).not.toContain('d7'); // 3 squares
  });

  it('shrinks near the edge (off-board jumps are skipped)', () => {
    const corner = boardWith(['a1', 'LP', 'A']);
    expect(moveTos(corner, 'a1')).toEqual(['a3', 'c1']);
    const edge = boardWith(['a4', 'LP', 'A']);
    expect(moveTos(edge, 'a4')).toEqual(['a2', 'a6', 'c4']);
  });

  it('jumps OVER occupied squares (interpositions ignored) and captures on the landing square', () => {
    const board = boardWith(['d4', 'LP', 'A'], ['d5', 'PE', 'A'], ['d6', 'PE', 'B']);
    // d5 (ally) is between d4 and d6 — the LP still lands on d6 and captures the enemy there.
    const moves = generatePseudoLegalMoves(board, 'd4');
    const toD6 = moves.find((m) => m.to === 'd6');
    expect(toD6).toBeDefined();
    expect(toD6?.isCapture).toBe(true);
    expect(toD6?.capturedCoord).toBe('d6');
  });

  it('cannot land on an occupied allied square', () => {
    const board = boardWith(['d4', 'LP', 'A'], ['d6', 'PE', 'A']);
    expect(moveTos(board, 'd4')).not.toContain('d6');
  });

  it('a plain move (empty landing) is not a capture', () => {
    const board = boardWith(['d4', 'LP', 'A'], ['d6', 'PE', 'B']);
    const moves = generatePseudoLegalMoves(board, 'd4');
    const toD2 = moves.find((m) => m.to === 'd2');
    expect(toD2?.isCapture).toBe(false);
  });

  describe('fulmine — extra non-capturing 2-jump after a leap capture', () => {
    function leapCaptureState() {
      const board = boardWith(['a1', 'RE', 'A'], ['d4', 'LP', 'A'], ['d6', 'PE', 'B'], ['h8', 'RE', 'B']);
      return createInitialGameState(board, 'A');
    }

    it('a leap capture opens the extra-jump phase (pendingExtraMove), and skipping ends the turn', () => {
      let state = leapCaptureState();
      const result = applyTurn(state, 'd4', 'd6');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      state = result.state;

      // The capture happened; the Lampo may now strike again with one non-capturing 2-jump.
      expect(state.board.get('d6')?.sigla).toBe('LP');
      expect(state.pendingExtraMove).toBe('d6');
      const extraTos = getLegalMovesForTurn(state, 'd6').map((m) => m.to).sort();
      expect(extraTos).toEqual(['b6', 'd4', 'd8', 'f6']); // the 4 dabbaba squares — none capturing
      for (const to of extraTos) {
        const extra = getLegalMovesForTurn(state, 'd6').find((m) => m.to === to)!;
        expect(extra.isCapture).toBe(false); // the fulmine jump never captures
      }

      // Skipping the bonus move passes the turn.
      const skipped = skipExtraMove(state);
      expect(skipped.ok).toBe(true);
      if (skipped.ok) {
        expect(skipped.state.turn).toBe('B');
        expect(skipped.state.pendingExtraMove).toBeNull();
      }
    });

    it('a plain (non-capturing) dabbaba jump never opens the extra-jump phase', () => {
      let state = leapCaptureState();
      // d4 → f4 is an empty landing (no capture) — no fulmine.
      const result = applyTurn(state, 'd4', 'f4');
      expect(result.ok).toBe(true);
      if (!result.ok) return;
      expect(result.state.pendingExtraMove).toBeNull();
      expect(result.state.turn).toBe('B');
    });
  });
});
