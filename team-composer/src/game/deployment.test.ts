import { describe, expect, it } from 'vitest';
import { createDeploymentState, isDeploymentComplete, placePiece, ownDeploymentRanks } from './deployment';
import { getPieceAt } from './board';
import { KING_SIGLA } from '../data/pieces';

function team(entries: Array<[string, number]>) {
  return new Map<string, number>(entries);
}

describe('createDeploymentState', () => {
  it('auto-places both Kings centrally, excluded from the remaining rosters', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 3]]), team([[KING_SIGLA, 1], ['TO', 2]]), 'A');

    expect(getPieceAt(state.board, 'e1')?.sigla).toBe(KING_SIGLA);
    expect(getPieceAt(state.board, 'e1')?.owner).toBe('A');
    expect(getPieceAt(state.board, 'e8')?.sigla).toBe(KING_SIGLA);
    expect(getPieceAt(state.board, 'e8')?.owner).toBe('B');

    expect(state.remaining.A.has(KING_SIGLA)).toBe(false);
    expect(state.remaining.A.get('PE')).toBe(3);
    expect(state.remaining.B.has(KING_SIGLA)).toBe(false);
    expect(state.remaining.B.get('TO')).toBe(2);
  });

  it('starts with the coin-toss winner as the current placer', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'B');
    expect(state.currentPlacer).toBe('B');
    expect(state.firstPlacer).toBe('B');
  });

  it('is already complete if both rosters only contained the King', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'A');
    expect(isDeploymentComplete(state)).toBe(true);
  });
});

describe('ownDeploymentRanks', () => {
  it('gives Player A the two ranks closest to their own side (1 and 2)', () => {
    expect(ownDeploymentRanks('A')).toEqual([1, 2]);
  });

  it('gives Player B the two ranks closest to their own side (7 and 8)', () => {
    expect(ownDeploymentRanks('B')).toEqual([7, 8]);
  });
});

describe('placePiece', () => {
  it('places the piece, decrements the roster, and is not complete until everything is placed', () => {
    let state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 2]]), team([[KING_SIGLA, 1]]), 'A');
    const result = placePiece(state, 'PE', 'a2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;

    expect(getPieceAt(state.board, 'a2')?.sigla).toBe('PE');
    expect(getPieceAt(state.board, 'a2')?.owner).toBe('A');
    expect(state.remaining.A.get('PE')).toBe(1);
    expect(isDeploymentComplete(state)).toBe(false);
  });

  it('alternates the current placer to the other player after a placement', () => {
    let state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1], ['TO', 1]]), 'A');
    const result = placePiece(state, 'PE', 'a2');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.currentPlacer).toBe('B');
  });

  it('rejects placing outside the current placer\'s own deployment ranks', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1]]), 'A');
    const result = placePiece(state, 'PE', 'a3'); // rank 3 is not in A's zone (1-2)
    expect(result.ok).toBe(false);
  });

  it('rejects placing on an already-occupied square', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1]]), 'A');
    const result = placePiece(state, 'PE', 'e1'); // the King is already there
    expect(result.ok).toBe(false);
  });

  it('rejects placing a piece not present (or exhausted) in the roster', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'A');
    const result = placePiece(state, 'TO', 'a1');
    expect(result.ok).toBe(false);
  });

  it('does not mutate the original state on a rejected placement', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1]]), 'A');
    placePiece(state, 'PE', 'a3');
    expect(state.remaining.A.get('PE')).toBe(1);
    expect(state.currentPlacer).toBe('A');
  });

  it('lets the player with a larger army keep placing alone once the other is exhausted', () => {
    let state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 2]]), team([[KING_SIGLA, 1], ['TO', 1]]), 'A');

    let result = placePiece(state, 'PE', 'a2'); // A places 1/2
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(state.currentPlacer).toBe('B');

    result = placePiece(state, 'TO', 'a8'); // B places their only piece — B is now exhausted
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(state.currentPlacer).toBe('A'); // back to A, who still has one PE left

    result = placePiece(state, 'PE', 'b2'); // A places 2/2, alone
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    state = result.state;
    expect(isDeploymentComplete(state)).toBe(true);
  });
});
