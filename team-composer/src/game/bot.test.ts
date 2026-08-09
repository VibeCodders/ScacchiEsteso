import { describe, expect, it } from 'vitest';
import { chooseBotAction, generateBotActions, applyBotAction, DIFFICULTY_TIME_BUDGET_MS } from './bot';
import { createInitialGameState } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { buildClassicStartingBoard } from './samplePositions';
import { isKingInCheck } from './check';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('generateBotActions', () => {
  it('lists move actions for every piece the owner has, plus special abilities when applicable', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A'); // Arciere: normal moves + scocca
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const actions = generateBotActions(state, 'A');
    expect(actions.some((a) => a.kind === 'move' && a.from === 'd4')).toBe(true);
    expect(actions.some((a) => a.kind === 'scocca' && a.from === 'd4' && a.target === 'd7')).toBe(true);
  });

  it('offers only moves from the pending square plus skipExtraMove during a Berserker bonus phase', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    const captureResult = applyBotAction(state, { kind: 'move', from: 'd4', to: 'd5' });
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;
    state = captureResult.state;
    expect(state.pendingExtraMove).toBe('d5');

    const actions = generateBotActions(state, 'A');
    expect(actions.every((a) => a.kind === 'skipExtraMove' || (a.kind === 'move' && a.from === 'd5'))).toBe(true);
    expect(actions.some((a) => a.kind === 'skipExtraMove')).toBe(true);
  });

  it('enumerates one move action per Orfano mimic threat', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // one threat
    const state = createInitialGameState(board, 'A');

    const orphanActions = generateBotActions(state, 'A').filter((a) => a.kind === 'move' && a.from === 'd4');
    expect(orphanActions.length).toBeGreaterThan(0);
    expect(orphanActions.every((a) => a.kind === 'move' && a.orphanMimicSource === 'd8')).toBe(true);
  });

  it('enumerates one move action per promotion option when a Pawn reaches the back rank', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const promotionActions = generateBotActions(state, 'A').filter((a) => a.kind === 'move' && a.to === 'd8');
    expect(promotionActions).toHaveLength(4); // PE, AL, CA, SP
    const choices = promotionActions.map((a) => (a.kind === 'move' ? a.promotionChoice : undefined)).sort();
    expect(choices).toEqual(['AL', 'CA', 'PE', 'SP'].sort());
  });
});

describe('chooseBotAction', () => {
  it('always chooses a legal action, applying cleanly, across several positions', () => {
    const boards: BoardState[] = [
      buildClassicStartingBoard(),
      (() => {
        let b = place(createEmptyBoard(), 'e1', 'RE', 'A');
        b = place(b, 'e8', 'RE', 'B');
        b = place(b, 'd4', 'TO', 'A');
        b = place(b, 'd7', 'PE', 'B');
        return b;
      })(),
    ];

    for (const board of boards) {
      const state = createInitialGameState(board, 'A');
      const action = chooseBotAction(state, 'A', 'easy');
      expect(action).not.toBeNull();
      if (!action) continue;
      const result = applyBotAction(state, action);
      expect(result.ok).toBe(true);
    }
  });

  it('picks a free capture when one is available (greedy material gain)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'RA', 'B'); // an undefended Regina — a huge, obvious capture
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 'easy');
    expect(action).toEqual({ kind: 'move', from: 'd4', to: 'd7' });
  });

  it('never leaves its own King in check', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'TO', 'A'); // blocks a check along the e-file
    board = place(board, 'e8', 'TO', 'B');
    board = place(board, 'a8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const action = chooseBotAction(state, 'A', 'medium');
    expect(action).not.toBeNull();
    if (!action) return;
    const result = applyBotAction(state, action);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(isKingInCheck(result.state.board, 'A')).toBe(false);
  });

  it('returns null when there is nothing legal to do', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A'); // checkmate
    expect(chooseBotAction(state, 'A', 'easy')).toBeNull();
  });

  it('completes within a reasonable time at "medium" difficulty on a busy board', () => {
    const board = buildClassicStartingBoard();
    const state = createInitialGameState(board, 'A');

    const start = Date.now();
    const action = chooseBotAction(state, 'A', 'medium');
    const elapsed = Date.now() - start;

    expect(action).not.toBeNull();
    expect(elapsed).toBeLessThan(10000);
  });
});

describe('chooseBotAction — hard difficulty performance', () => {
  it('respects its wall-clock time budget (with slack for one in-flight branch) on the classic starting position', () => {
    const board = buildClassicStartingBoard();
    const state = createInitialGameState(board, 'A');
    const start = Date.now();
    const action = chooseBotAction(state, 'A', 'hard');
    const elapsed = Date.now() - start;
    expect(action).not.toBeNull();
    expect(elapsed).toBeLessThan(DIFFICULTY_TIME_BUDGET_MS.hard * 2.5);
  });
});
