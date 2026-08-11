import { describe, expect, it } from 'vitest';
import { canAttract, getAttractTargets } from './vortex';
import { createInitialGameState, applyAttract } from './turnManager';
import { createEmptyBoard, createPieceInstance, getPieceAt, setPieceAt, type BoardState } from './board';
import { getPieceDef } from './moveEngine';
import { generateBotActions, applyBotAction } from './bot';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

/** Standard attract position: VZ d4 can pull TO d6 (2 squares north) onto the empty d5. */
function attractPosition(): BoardState {
  let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
  board = place(board, 'd4', 'VZ', 'A');
  board = place(board, 'h8', 'RE', 'B');
  board = place(board, 'd6', 'TO', 'B');
  return board;
}

describe('canAttract', () => {
  it('is true only for the Vortice', () => {
    expect(canAttract(getPieceDef('VZ'))).toBe(true);
    for (const sigla of ['RE', 'TO', 'TT', 'RP', 'ST', 'SW', 'GR', 'MA']) {
      expect(canAttract(getPieceDef(sigla))).toBe(false);
    }
  });
});

describe('getAttractTargets', () => {
  it('lists an enemy at exactly 2 squares whose intermediate square is empty', () => {
    const targets = getAttractTargets(attractPosition(), 'd4', 'A');
    expect(targets).toEqual(['d6']);
  });

  it('offers a pull in every open direction', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'VZ', 'A');
    board = place(board, 'h8', 'RE', 'B');
    for (const coord of ['d6', 'd2', 'f4', 'b4', 'f6', 'b6', 'f2', 'b2']) {
      board = place(board, coord, 'PE', 'B');
    }
    const targets = getAttractTargets(board, 'd4', 'A');
    expect(targets.sort()).toEqual(['b2', 'b4', 'b6', 'd2', 'd6', 'f2', 'f4', 'f6'].sort());
  });

  it('excludes enemies at distance 1 or 3 — only distance 2 is pulled', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'VZ', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd5', 'PE', 'B'); // distance 1
    board = place(board, 'd7', 'PE', 'B'); // distance 3
    expect(getAttractTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('excludes enemies whose intermediate square is occupied', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'VZ', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd6', 'PE', 'B'); // the enemy
    board = place(board, 'd5', 'PE', 'A'); // an ally blocks the pull path
    expect(getAttractTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('never pulls allies or the King', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'd4', 'VZ', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd6', 'CA', 'A'); // ally — never pullable
    board = place(board, 'f6', 'RE', 'B'); // the enemy King — immune to forced displacement
    expect(getAttractTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Vortice is silenced by an enemy Inquisitore', () => {
    let board = attractPosition();
    board = place(board, 'c4', 'IQ', 'B'); // adjacent enemy Inquisitore silences the VZ
    expect(getAttractTargets(board, 'd4', 'A')).toEqual([]);
  });

  it('is empty when the Vortice is frozen by an enemy Stunner', () => {
    let board = attractPosition();
    board = place(board, 'c4', 'ST', 'B'); // adjacent enemy Stunner freezes the VZ
    expect(getAttractTargets(board, 'd4', 'A')).toEqual([]);
  });
});

describe('applyAttract', () => {
  it('drags the enemy one square closer, records the action, passes the turn and resets the progress counter', () => {
    const state = createInitialGameState(attractPosition(), 'A');

    const result = applyAttract(state, 'd4', 'd6');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(getPieceAt(result.state.board, 'd4')?.sigla).toBe('VZ'); // the Vortice never moves
    expect(getPieceAt(result.state.board, 'd6')).toBeUndefined(); // the enemy left its square
    expect(getPieceAt(result.state.board, 'd5')?.sigla).toBe('TO'); // ...and landed one square closer
    expect(getPieceAt(result.state.board, 'd5')?.owner).toBe('B');

    const entry = result.state.history[result.state.history.length - 1];
    expect(entry.isAttract).toBe(true);
    expect(entry.to).toBe('d6'); // the pulled piece's ORIGINAL square
    expect(entry.attractedTo).toBe('d5'); // where it landed
    expect(entry.isCapture).toBe(false);
    expect(result.state.captured).toEqual({ A: [], B: [] });
    expect(result.state.turn).toBe('B');
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('rejects a pull that would leave the acting player King in check', () => {
    // A's VZ d4 pulls B's TO f6 → e5 (diagonal NE, 2 squares): the TO then stands on the e-file
    // with nothing between it and A's King on e1 — a pull that exposes the King is rejected.
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'VZ', 'A');
    board = place(board, 'f6', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyAttract(state, 'd4', 'f6');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.reason).toContain('scacco');
  });

  it('rejects pulls by pieces that are not a Vortice', () => {
    const state = createInitialGameState(attractPosition(), 'A');
    // swap the VZ for a TO on d4: the TO can't attract
    const withTorre = setPieceAt(state.board, 'd4', createPieceInstance('TO', 'A'));
    const result = applyAttract({ ...state, board: withTorre }, 'd4', 'd6');
    expect(result.ok).toBe(false);
  });
});

describe('bot integration', () => {
  it('enumerates the attract among the bot options and plays it through the action pipeline', () => {
    const state = createInitialGameState(attractPosition(), 'A');
    const actions = generateBotActions(state, 'A');
    expect(actions.some((a) => a.kind === 'attract' && a.from === 'd4' && a.target === 'd6')).toBe(true);

    const result = applyBotAction(state, { kind: 'attract', from: 'd4', target: 'd6' });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.history[result.state.history.length - 1].isAttract).toBe(true);
    expect(getPieceAt(result.state.board, 'd5')?.sigla).toBe('TO');
    expect(result.state.turn).toBe('B');
  });
});
