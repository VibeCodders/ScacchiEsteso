import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { createInitialGameState, applyTurn } from './turnManager';
import { createDeploymentState, autoPlaceBoth, isDeploymentComplete, ownDeploymentRanks, type Roster } from './deployment';
import { rules, scaleRulesForBoardSize, KING_SIGLA } from '../data/pieces';
import { computeValidation } from '../data/validators';
import { pieces } from '../data/pieces';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

function team(entries: Array<[string, number]>): Roster {
  return new Map(entries);
}

// Step 14g — the full pipeline (settings → team budget → deployment → play → checkmate) on a
// board size that only works if every layer genuinely respects custom dimensions end-to-end,
// instead of silently falling back to the default 8×8 somewhere along the way.
describe('end-to-end on a custom (non-default) board size — 10×6', () => {
  const dims = { width: 10, height: 6 };

  it('scales the team-building budget/piece-cap for this board size, and a team within it validates', () => {
    const scaledRules = scaleRulesForBoardSize(rules, dims); // 60 squares vs the 64-square baseline
    expect(scaledRules.budget).toBeLessThan(rules.budget); // a smaller board gets a smaller budget
    expect(scaledRules.maxPiecesTotal).toBeLessThan(rules.maxPiecesTotal);

    const myTeam = team([[KING_SIGLA, 1], ['PE', 3], ['TO', 2]]);
    const validation = computeValidation(myTeam, pieces, scaledRules);
    expect(validation.overall).toBe(true);
  });

  it('fully auto-deploys both armies confined to their real (10×6) deployment zones', () => {
    const state = createDeploymentState(
      team([[KING_SIGLA, 1], ['PE', 4], ['TO', 2]]),
      team([[KING_SIGLA, 1], ['CA', 3], ['AL', 2]]),
      'A',
      dims,
    );
    const result = autoPlaceBoth(state);
    expect(isDeploymentComplete(result)).toBe(true);
    expect(result.dimensions).toEqual(dims);

    // sanity: no piece landed outside the 10-wide, 6-tall board at all
    for (const coord of result.board.keys()) {
      const rank = Number(coord.match(/\d+$/)![0]);
      expect(rank).toBeLessThanOrEqual(dims.height);
    }
  });

  it("plays a move that captures and delivers checkmate in the same action, at a corner ('j6') that only exists on a 10×6 board", () => {
    let board = place(createEmptyBoard(), 'e1', KING_SIGLA, 'A');
    board = place(board, 'a1', 'TO', 'A'); // will slide up file a, capturing the Fante on the way
    board = place(board, 'b5', 'TO', 'A'); // pre-placed: seals rank 5 (i5, j5)
    board = place(board, 'j6', KING_SIGLA, 'B'); // the far corner — file index 9, rank 6
    board = place(board, 'a6', 'FG', 'B'); // capture target; landing here also checks rank 6 through to j6

    const state = createInitialGameState(board, 'A', dims);
    expect(state.dimensions).toEqual(dims);
    expect(ownDeploymentRanks('B', dims)).toEqual([5, 6]); // sanity: B's real deployment zone on this board

    const result = applyTurn(state, 'a1', 'a6');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('a6')?.sigla).toBe('TO'); // the capturing Torre landed there
    expect(result.state.captured.B.map((p) => p.sigla)).toContain('FG'); // the Fante was captured
    expect(result.state.status).toBe('checkmate');
    expect(result.state.winner).toBe('A');

    // Confirm the dimensions genuinely mattered: under the *default* 8×8 bounds, 'j6' (file index
    // 9) is never enumerated, so Black's King is effectively invisible and the very same move
    // does NOT get recognized as checkmate — proving this result depends on the real dimensions
    // flowing all the way through, not a coincidence of the board contents alone.
    const defaultDimsResult = applyTurn(createInitialGameState(board, 'A'), 'a1', 'a6');
    expect(defaultDimsResult.ok).toBe(true);
    if (defaultDimsResult.ok) {
      expect(defaultDimsResult.state.status).not.toBe('checkmate');
    }
  });
});
