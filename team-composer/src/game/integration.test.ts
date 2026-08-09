import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { createInitialGameState, applyTurn, applyScocca, applySwap, applyRevive } from './turnManager';
import { getOrphanThreats } from './orphan';

// Step 12 — multi-mechanic integration tests: scenarios that combine two rules at once, which the
// per-step targeted test files (deliberately) never exercise together.

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('Berserker capture + bonus move delivering check', () => {
  it('a compound Berserker turn (capture, then bonus move) can itself put the opponent in check', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B'); // the Berserker's capture target
    const state = createInitialGameState(board, 'A');

    const captureResult = applyTurn(state, 'd4', 'd5');
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;
    expect(captureResult.state.pendingExtraMove).toBe('d5');

    const bonusResult = applyTurn(captureResult.state, 'd5', 'd7'); // non-capturing bonus move, 2 squares
    expect(bonusResult.ok).toBe(true);
    if (!bonusResult.ok) return;

    expect(bonusResult.state.turn).toBe('B');
    expect(bonusResult.state.status).toBe('check');
  });
});

describe('Arciere scocca + anti-stalemate counter', () => {
  it("a scocca capture resets turnsSinceProgress to 0, just like any other capture", () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B'); // 3 squares north — a valid scocca target
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 19 };

    const result = applyScocca(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.turnsSinceProgress).toBe(0);
    expect(result.state.status).not.toBe('anti_stalemate');
  });
});

describe('Necromante revival delivering check', () => {
  it('reviving a Pedone onto a square that threatens the enemy King puts it in check immediately', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'f7', 'RE', 'B');
    board = place(board, 'd6', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    // e6 is adjacent to the Necromante at d6, and diagonally "ne" of it puts the revived Pedone
    // one melee-capture step from the Black King at f7.
    const result = applyRevive(state, 'd6', 'e6', 'PE');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.turn).toBe('B');
    expect(result.state.status).toBe('check');
  });
});

describe('Inquisitore Silenzio suppresses the Colosso\'s area damage', () => {
  it('a silenced Colosso still captures normally but no longer triggers collateral area damage', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'CO', 'A'); // Colosso about to capture and land on d5
    board = place(board, 'd5', 'PE', 'B'); // the melee capture target
    board = place(board, 'd6', 'PE', 'B'); // would be an area-damage victim (orthogonal to d5)
    board = place(board, 'e5', 'PE', 'B'); // would be an area-damage victim (orthogonal to d5)
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to d5 (the Colosso's landing square) — silences it there
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.has('d5')).toBe(true); // the Colosso itself, having captured
    expect(result.state.board.get('d5')?.sigla).toBe('CO');
    expect(result.state.board.has('d6')).toBe(true); // survives — area damage was silenced
    expect(result.state.board.has('e5')).toBe(true); // survives — area damage was silenced
    expect(result.state.history.at(-1)?.areaDamageCoords).toBeUndefined();
  });
});

describe('Paladino Egida does not protect against the Colosso\'s area damage', () => {
  it("an Egida-shielded ally still dies to collateral area damage — the shield only blocks ranged attacks", () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'CO', 'A'); // Colosso about to capture and land on d5
    board = place(board, 'd5', 'PE', 'B'); // the melee capture target
    board = place(board, 'e5', 'PE', 'B'); // orthogonal to d5 — the area-damage victim under test
    board = place(board, 'e4', 'PA', 'B'); // adjacent to e5 — grants it Egida (ranged-only shield)
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.has('e5')).toBe(false); // dies anyway — Egida doesn't cover area damage
    expect(result.state.history.at(-1)?.areaDamageCoords).toContain('e5');
  });
});

describe('Mistico swap as an alternative to Orfano mimicry', () => {
  it('swapping a threatened Orfano to safety is a legal alternative to mimicking a threat', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A'); // threatened by the Torre on d8
    board = place(board, 'e4', 'MI', 'A'); // adjacent ally, can swap instead of forcing mimicry
    board = place(board, 'd8', 'TO', 'B');
    const state = createInitialGameState(board, 'A');

    expect(getOrphanThreats(state.board, 'd4', 'A')).toContain('d8');

    const result = applySwap(state, 'e4', 'd4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('e4')?.sigla).toBe('OR');
    expect(result.state.board.get('d4')?.sigla).toBe('MI');
    expect(getOrphanThreats(result.state.board, 'e4', 'A')).toHaveLength(0); // safe — off the d-file
  });
});
