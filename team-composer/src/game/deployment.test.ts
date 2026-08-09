import { describe, expect, it } from 'vitest';
import {
  autoPlaceBoth,
  autoPlaceRemaining,
  createDeploymentState,
  isDeploymentComplete,
  ownDeploymentRanks,
  placePiece,
} from './deployment';
import { allCoords, coordToFileRank, getPieceAt } from './board';
import { KING_SIGLA } from '../data/pieces';
import { getPieceDef } from './moveEngine';

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

describe('autoPlaceRemaining', () => {
  it("places every remaining piece for the given owner, emptying that owner's roster", () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 2], ['TO', 1]]), team([[KING_SIGLA, 1], ['CA', 1]]), 'A');
    const result = autoPlaceRemaining(state, 'A');

    expect(result.remaining.A.size).toBe(0);
    expect(result.remaining.B).toEqual(state.remaining.B); // untouched
    let placedCount = 0;
    for (const coord of allCoords()) {
      const piece = getPieceAt(result.board, coord);
      if (piece?.owner === 'A') placedCount++;
    }
    expect(placedCount).toBe(4); // King + PE + PE + TO
  });

  it('only places within the deployment ranks (the own 2 back ranks) and never onto an occupied square', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 3], ['TO', 2]]), team([[KING_SIGLA, 1]]), 'A');
    const result = autoPlaceRemaining(state, 'A');

    const ranks = ownDeploymentRanks('A');
    for (const coord of allCoords()) {
      const piece = getPieceAt(result.board, coord);
      if (piece?.owner === 'A') expect(ranks).toContain(Number(coord[1]));
    }
    // no square was double-booked — the King's e1 keeps its original occupant
    expect(getPieceAt(result.board, 'e1')?.sigla).toBe(KING_SIGLA);
  });

  it('places "pedone"-category pieces on the front rank and everything else on the back rank when there is room', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 2], ['TO', 1]]), team([[KING_SIGLA, 1]]), 'A');
    const result = autoPlaceRemaining(state, 'A');

    for (const coord of allCoords()) {
      const piece = getPieceAt(result.board, coord);
      if (!piece || piece.owner !== 'A' || piece.sigla === KING_SIGLA) continue;
      const categoria = getPieceDef(piece.sigla).categoria;
      const rank = Number(coord[1]);
      if (categoria === 'pedone') expect(rank).toBe(2); // A's front rank
      else expect(rank).toBe(1); // A's back rank, alongside the King
    }
  });

  it('advances currentPlacer to the other owner if they still have pieces left, otherwise stays put', () => {
    let state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1], ['TO', 1]]), 'A');
    state = autoPlaceRemaining(state, 'A');
    expect(state.currentPlacer).toBe('B'); // B still has a Torre to place

    state = autoPlaceRemaining(state, 'B');
    expect(isDeploymentComplete(state)).toBe(true);
  });

  it('is a no-op when the owner has nothing left to place', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1], ['PE', 1]]), 'A');
    const result = autoPlaceRemaining(state, 'A'); // A's roster is already empty (just the King)
    expect(result).toEqual(state);
  });
});

describe('autoPlaceBoth', () => {
  it('completes the entire deployment for both players in one call', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 2]]), team([[KING_SIGLA, 1], ['TO', 1]]), 'A');
    const result = autoPlaceBoth(state);
    expect(isDeploymentComplete(result)).toBe(true);
  });
});

describe('deployment on a custom (non-default) board size', () => {
  it("places the King on 'e' for the default 8×8 board — the King square formula must reproduce this exactly", () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'A');
    expect(getPieceAt(state.board, 'e1')?.sigla).toBe(KING_SIGLA);
    expect(getPieceAt(state.board, 'e8')?.sigla).toBe(KING_SIGLA);
  });

  it('places the King on the exact center file for an odd board width', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'A', { width: 9, height: 9 });
    expect(getPieceAt(state.board, 'e1')?.sigla).toBe(KING_SIGLA); // file index 4 — the exact center of 9 files
    expect(getPieceAt(state.board, 'e9')?.sigla).toBe(KING_SIGLA);
  });

  it('places the King on a center file (not necessarily "e") for a non-default even width', () => {
    const state = createDeploymentState(team([[KING_SIGLA, 1]]), team([[KING_SIGLA, 1]]), 'A', { width: 4, height: 4 });
    expect(getPieceAt(state.board, 'c1')?.sigla).toBe(KING_SIGLA); // ceil((4-1)/2) = 2 -> file index 2 -> 'c'
    expect(getPieceAt(state.board, 'c4')?.sigla).toBe(KING_SIGLA);
  });

  it('computes deployment ranks from the real board height, not a hardcoded 7/8', () => {
    expect(ownDeploymentRanks('B', { width: 8, height: 12 })).toEqual([11, 12]);
    expect(ownDeploymentRanks('A', { width: 8, height: 12 })).toEqual([1, 2]); // A's zone never depends on height
  });

  it('rejects a placement outside the real deployment zone of a taller board', () => {
    const dims = { width: 8, height: 12 };
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1]]), 'A', dims);
    const result = placePiece(state, 'PE', 'a3'); // rank 3 is not in A's zone (1-2) regardless of height
    expect(result.ok).toBe(false);
  });

  it('accepts a placement that would be out of bounds on the default 8×8 board but is valid on a wider one', () => {
    const dims = { width: 10, height: 8 };
    const state = createDeploymentState(team([[KING_SIGLA, 1], ['PE', 1]]), team([[KING_SIGLA, 1]]), 'A', dims);
    const result = placePiece(state, 'PE', 'j2'); // 10th file — invalid on an 8-wide board
    expect(result.ok).toBe(true);
  });

  it('fully auto-deploys both armies on a 6×10 board, confined to their own real deployment zones', () => {
    const dims = { width: 6, height: 10 };
    const state = createDeploymentState(
      team([[KING_SIGLA, 1], ['PE', 4], ['TO', 2]]),
      team([[KING_SIGLA, 1], ['CA', 3], ['AL', 2]]),
      'A',
      dims,
    );
    const result = autoPlaceBoth(state);
    expect(isDeploymentComplete(result)).toBe(true);

    for (const coord of allCoords(dims)) {
      const piece = getPieceAt(result.board, coord);
      if (!piece) continue;
      const expectedRanks = ownDeploymentRanks(piece.owner, dims);
      expect(expectedRanks).toContain(coordToFileRank(coord).rank);
    }
  });
});
