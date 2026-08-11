import { describe, expect, it } from 'vitest';
import { applySostituzione, applyTurn, createInitialGameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt } from './board';
import { getSostituzioneTargets } from './sostituzione';
import { getPieceDef } from './moveEngine';

function boardWith(...placements: Array<[string, string, 'A' | 'B']>): ReturnType<typeof createEmptyBoard> {
  let board = createEmptyBoard();
  for (const [coord, sigla, owner] of placements) {
    board = setPieceAt(board, coord, createPieceInstance(sigla, owner));
  }
  return board;
}

function gameWith(...placements: Array<[string, string, 'A' | 'B']>) {
  return createInitialGameState(boardWith(...placements), 'A');
}

describe('getSostituzioneTargets — the Brigante swaps places with an adjacent enemy', () => {
  it('offers every adjacent enemy, and only enemies', () => {
    const state = gameWith(
      ['d4', 'BR', 'A'],
      ['d5', 'PE', 'B'],
      ['e4', 'PE', 'B'],
      ['c4', 'PE', 'A'], // ally — never a target
    );
    const targets = getSostituzioneTargets(state.board, 'd4', 'A').sort();
    expect(targets).toEqual(['d5', 'e4']);
    expect(targets).not.toContain('c4');
  });

  it('never offers the enemy King', () => {
    const state = gameWith(['d4', 'BR', 'A'], ['d5', 'RE', 'B']);
    expect(getSostituzioneTargets(state.board, 'd4', 'A')).toEqual([]);
  });

  it('offers nothing with no adjacent enemy', () => {
    const state = gameWith(['d4', 'BR', 'A'], ['a1', 'RE', 'A'], ['h8', 'RE', 'B']);
    expect(getSostituzioneTargets(state.board, 'd4', 'A')).toEqual([]);
  });
});

describe('applySostituzione — swaps squares with an adjacent enemy', () => {
  it('exchanges the two squares without capturing, flips the turn and records the history entry', () => {
    const state = gameWith(['a1', 'RE', 'A'], ['d4', 'BR', 'A'], ['d5', 'PE', 'B'], ['h8', 'RE', 'B']);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    const after = result.state;
    expect(after.board.get('d5')?.sigla).toBe('BR');
    expect(after.board.get('d4')?.sigla).toBe('PE');
    expect(after.board.get('d4')?.owner).toBe('B');
    expect(after.turn).toBe('B');
    expect(after.captured.A).toHaveLength(0); // no capture
    expect(after.captured.B).toHaveLength(0);
    const entry = after.history[after.history.length - 1];
    expect(entry).toMatchObject({ sigla: 'BR', from: 'd4', to: 'd5', isCapture: false, isSostituzione: true, sostituitoCon: 'd5' });
    expect(after.turnsSinceProgress).toBe(0); // a board-changing special action — always progress
  });

  it('rejects swapping with the enemy King', () => {
    const state = gameWith(['a1', 'RE', 'A'], ['d4', 'BR', 'A'], ['d5', 'RE', 'B']);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('non valida');
  });

  it('rejects a swap that would leave the acting King in check', () => {
    // A's King on a1; an enemy Torre on h1 pins the swap: moving BR from d4 to d5 (or the swap
    // itself) must not expose a1 — simplest: an enemy Alfiere on h7 attacks d4's destination d5's
    // rank line? Use a concrete pin: Torre on e1 gives check along rank 1 only after the King
    // moves — instead, swap BR d4 with enemy TO d5 where TO's original square d5 gives check to a1
    // along the d-file (a1 is not on the d-file). Use an enemy TO on d5 + King a1: after the swap
    // the TO sits on d4 — still no check on a1. Construct a real exposure: King a1, BR d4, enemy
    // AL d5 (diagonal a1→d4→... no). Simplest real case: King b1, BR d4, enemy TO d5 — after swap
    // TO lands on d4, giving check to b1 along rank 4? b1 is not on rank 4. Use King d1, BR d4,
    // enemy TO d5: after the swap TO lands on d4 and checks d1 along the d-file. The move is then
    // rejected.
    const state = gameWith(['d1', 'RE', 'A'], ['d4', 'BR', 'A'], ['d5', 'TO', 'B'], ['h8', 'RE', 'B']);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('scacco');
  });

  it('is rejected for a piece that cannot sostituire', () => {
    const state = gameWith(['a1', 'RE', 'A'], ['d4', 'PE', 'A'], ['d5', 'PE', 'B'], ['h8', 'RE', 'B']);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('non può sostituirsi');
  });

  it('is blocked while an enemy Stunner freezes the Brigante', () => {
    const state = gameWith(['a1', 'RE', 'A'], ['d4', 'BR', 'A'], ['d5', 'PE', 'B'], ['e4', 'ST', 'B'], ['h8', 'RE', 'B']);
    expect(getSostituzioneTargets(state.board, 'd4', 'A')).toEqual([]);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
  });

  it('counts as progress in a complete game (anti-stalemate counter resets)', () => {
    // Two full quiet King shuffles (4 plies) to move the counter, then the swap resets it.
    let state = gameWith(['a1', 'RE', 'A'], ['d4', 'BR', 'A'], ['d5', 'PE', 'B'], ['h8', 'RE', 'B']);
    for (const [from, to] of [['a1', 'a2'], ['h8', 'h7'], ['a2', 'a1'], ['h7', 'h8']] as const) {
      const r = applyTurn(state, from, to);
      expect(r.ok).toBe(true);
      if (r.ok) state = r.state;
    }
    expect(state.turnsSinceProgress).toBe(4);
    const result = applySostituzione(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('getPieceDef exposes the new flags (roster integrity)', () => {
    expect(getPieceDef('BR').scambioConNemico).toBe(true);
    expect(getPieceDef('BS').congelaDirezione).toBe(true);
  });
});
