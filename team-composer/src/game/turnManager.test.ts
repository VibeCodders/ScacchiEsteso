import { describe, expect, it } from 'vitest';
import { createInitialGameState, applyTurn, skipExtraMove, applyScocca, applySwap, applyRevive } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';
import { generatePseudoLegalMoves } from './moveEngine';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A') {
  return setPieceAt(board, coord, createPieceInstance(sigla, owner));
}

describe('createInitialGameState', () => {
  it('starts with turn 1, the given player to move, empty history, and no captures', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.turn).toBe('A');
    expect(state.turnNumber).toBe(1);
    expect(state.history).toEqual([]);
    expect(state.captured).toEqual({ A: [], B: [] });
    expect(state.status).toBe('ongoing');
  });

  it('computes the initial status (e.g. an immediate check) up front', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'TO', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('check');
  });
});

describe('applyTurn — basic move application', () => {
  it('moves the piece, switches turn, and advances the turn number', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
  });

  it('records a history entry with from/to/sigla/capture info', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.history).toHaveLength(1);
    expect(result.state.history[0]).toMatchObject({
      turnNumber: 1,
      owner: 'A',
      from: 'd4',
      to: 'd7',
      sigla: 'TO',
      isCapture: true,
      capturedCoord: 'd7',
      capturedSigla: 'PE',
    });
  });

  it('adds a captured piece to the losing owner\'s captured list', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.captured.B).toHaveLength(1);
    expect(result.state.captured.B[0].sigla).toBe('PE');
    expect(result.state.captured.A).toHaveLength(0);
  });

  it('does not record a captured piece for a non-capturing move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'e1', 'd1');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.captured).toEqual({ A: [], B: [] });
  });
});

describe('applyTurn — rejects invalid attempts without mutating state', () => {
  it('rejects a move from an empty square', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
  });

  it("rejects moving a piece that belongs to the player who isn't on turn", () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A'); // A to move, but d7 belongs to B

    const result = applyTurn(state, 'd7', 'd6');
    expect(result.ok).toBe(false);
  });

  it('rejects a pseudo-legal-but-illegal move that would leave the mover\'s own King in check', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e5', 'TO', 'A');
    board = place(board, 'e8', 'TO', 'B');
    board = place(board, 'a1', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'e5', 'd5'); // stepping off the e-file exposes the King
    expect(result.ok).toBe(false);
  });

  it('rejects any move once the game has ended in checkmate', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('checkmate');

    const result = applyTurn(state, 'a1', 'a2');
    expect(result.ok).toBe(false);
  });

  it('does not mutate the original state object on a rejected move', () => {
    const board = place(place(createEmptyBoard(), 'e1', 'RE', 'A'), 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');
    applyTurn(state, 'z9', 'z8');
    expect(state.turn).toBe('A');
    expect(state.history).toEqual([]);
  });
});

describe('applyTurn — game status transitions', () => {
  it('flags "check" on the opponent right after a checking move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd8', 'RE', 'B');
    board = place(board, 'd1', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd1', 'd5'); // rook now has a clear line to the Black King on d8
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('check');
    expect(result.state.turn).toBe('B');
  });

  it('flags "checkmate" and records the winner when the delivered move is mate', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h1', 'RE', 'B');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'c8', 'TO', 'B');
    const state = createInitialGameState(board, 'B');
    expect(state.status).toBe('ongoing');

    const result = applyTurn(state, 'c8', 'b8'); // completes the corner mate on a1
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('checkmate');
    expect(result.state.winner).toBe('B');
  });
});

describe('applyTurn — promotion', () => {
  it('requires a promotionChoice when a Pawn reaches the promotion rank, without mutating state', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd7', 'd8');
    expect(result.ok).toBe(false);
    expect(state.turn).toBe('A');
  });

  it('rejects a promotionChoice outside the piece\'s allowed options', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd7', 'd8', 'RA'); // RA (Regina) is not one of PE's ≤20pt options
    expect(result.ok).toBe(false);
  });

  it('replaces the Pawn with the chosen piece and records promotedTo in history', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd7', 'd8', 'AL');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('d8')?.sigla).toBe('AL');
    expect(result.state.board.get('d8')?.owner).toBe('A');
    expect(result.state.board.has('d7')).toBe(false);
    expect(result.state.history[0]).toMatchObject({ sigla: 'PE', promotedTo: 'AL' });
  });

  it('promotes the Pedone di Dama only to Damone', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd7', 'DA', 'A');
    const state = createInitialGameState(board, 'A');

    const rejected = applyTurn(state, 'd7', 'd8', 'AL');
    expect(rejected.ok).toBe(false);

    const result = applyTurn(state, 'd7', 'd8', 'DM');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('d8')?.sigla).toBe('DM');
  });

  it('does not require a promotion choice for a non-promotable piece reaching the back rank', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd1', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd1', 'd8');
    expect(result.ok).toBe(true);
  });

  it('mirrors the promotion rank for Player B (rank 1)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd2', 'PE', 'B');
    const state = createInitialGameState(board, 'B');

    const result = applyTurn(state, 'd2', 'd1', 'CA');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('d1')?.sigla).toBe('CA');
  });
});

describe('applyTurn — en passant (README §6)', () => {
  it('records the passed-over square after a Pawn\'s double first move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd2', 'PE', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd2', 'd4');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.enPassantTarget).toBe('d3');
  });

  it('lets an adjacent enemy Pawn capture en passant immediately after the double step', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd2', 'PE', 'A');
    board = place(board, 'e4', 'PE', 'B');
    let state = createInitialGameState(board, 'A');

    const doubleStep = applyTurn(state, 'd2', 'd4');
    expect(doubleStep.ok).toBe(true);
    if (!doubleStep.ok) return;
    state = doubleStep.state;

    const enPassant = applyTurn(state, 'e4', 'd3');
    expect(enPassant.ok).toBe(true);
    if (!enPassant.ok) return;

    expect(enPassant.state.board.get('d3')?.sigla).toBe('PE');
    expect(enPassant.state.board.get('d3')?.owner).toBe('B');
    expect(enPassant.state.board.has('d4')).toBe(false); // the captured pawn, not on the destination square
    expect(enPassant.state.captured.A).toHaveLength(1);
  });

  it('expires after one move — the option disappears once the opponent plays something else', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd2', 'PE', 'A');
    board = place(board, 'e4', 'PE', 'B');
    board = place(board, 'a7', 'PE', 'B');
    let state = createInitialGameState(board, 'A');

    state = (applyTurn(state, 'd2', 'd4') as { ok: true; state: typeof state }).state;
    state = (applyTurn(state, 'a7', 'a6') as { ok: true; state: typeof state }).state; // B plays something else
    expect(state.enPassantTarget).toBeNull();

    const lateEnPassant = applyTurn(state, 'e4', 'd3');
    expect(lateEnPassant.ok).toBe(false);
  });

  it('is not available to the Pedone di Dama (en passant is only between classic Pawns)', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd2', 'PE', 'A');
    board = place(board, 'e4', 'DA', 'B');
    let state = createInitialGameState(board, 'A');

    state = (applyTurn(state, 'd2', 'd4') as { ok: true; state: typeof state }).state;
    const attempt = applyTurn(state, 'e4', 'd3');
    expect(attempt.ok).toBe(false);
  });
});

describe('applyTurn — Berserker bonus move (README §4.2)', () => {
  it('after a melee capture, keeps the turn with the same player and marks a pending extra move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.turn).toBe('A'); // turn has NOT passed yet
    expect(result.state.turnNumber).toBe(1); // the compound action is still turn 1
    expect(result.state.pendingExtraMove).toBe('d5');
  });

  it('does not trigger a pending extra move for a non-capturing Berserker move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingExtraMove).toBeNull();
    expect(result.state.turn).toBe('B');
  });

  it('only accepts the bonus move from the Berserker that just captured, not any other piece', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'a1', 'TO', 'A');
    let state = createInitialGameState(board, 'A');
    state = (applyTurn(state, 'd4', 'd5') as { ok: true; state: typeof state }).state;

    const result = applyTurn(state, 'a1', 'a4');
    expect(result.ok).toBe(false);
  });

  it('rejects a capturing bonus move — the extra move must be non-capturing', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'c5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = (applyTurn(state, 'd4', 'd5') as { ok: true; state: typeof state }).state;

    const result = applyTurn(state, 'd5', 'c5'); // adjacent enemy — would be a capture
    expect(result.ok).toBe(false);
  });

  it('completing a valid non-capturing bonus move finally passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = (applyTurn(state, 'd4', 'd5') as { ok: true; state: typeof state }).state;

    const result = applyTurn(state, 'd5', 'd6');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.pendingExtraMove).toBeNull();
    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.history).toHaveLength(2);
    expect(result.state.history[1].isExtraMove).toBe(true);
  });

  it('skipExtraMove declines the bonus move and passes the turn without moving again', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = (applyTurn(state, 'd4', 'd5') as { ok: true; state: typeof state }).state;

    const result = skipExtraMove(state);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.pendingExtraMove).toBeNull();
    expect(result.state.board.get('d5')?.sigla).toBe('BE'); // no extra move happened
  });

  it('skipExtraMove is rejected when there is no pending bonus move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = skipExtraMove(state);
    expect(result.ok).toBe(false);
  });
});

describe('applyScocca — Arciere ranged elimination', () => {
  it('eliminates the target without moving the Arciere, and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyScocca(state, 'd4', 'd7');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('d4')?.sigla).toBe('AR'); // attacker did not move
    expect(result.state.board.has('d7')).toBe(false); // target eliminated
    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.captured.B).toHaveLength(1);
    expect(result.state.history[0]).toMatchObject({ isRangedAttack: true, isCapture: true, capturedSigla: 'PE' });
  });

  it('rejects a target outside the 3-4 square range', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd6', 'PE', 'B'); // only 2 squares away
    const state = createInitialGameState(board, 'A');

    expect(applyScocca(state, 'd4', 'd6').ok).toBe(false);
  });

  it('rejects a target blocked by an interposed piece', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    board = place(board, 'd5', 'CA', 'A');
    const state = createInitialGameState(board, 'A');

    expect(applyScocca(state, 'd4', 'd7').ok).toBe(false);
  });

  it('rejects targeting the King', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'RE', 'B');
    const state = createInitialGameState(board, 'A');

    expect(applyScocca(state, 'd4', 'd7').ok).toBe(false);
  });

  it('rejects the action for a piece that cannot scocca', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    expect(applyScocca(state, 'd4', 'd7').ok).toBe(false);
  });

  it('rejects the action when the acting player\'s own King is already in check and this doesn\'t resolve it', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B'); // a valid scocca target, unrelated to the check
    board = place(board, 'a8', 'TO', 'B'); // checks the King on a1 right now
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('check');

    const result = applyScocca(state, 'd4', 'd7');
    expect(result.ok).toBe(false);
  });

  it('rejects any scocca once the game has ended', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'TO', 'B');
    board = place(board, 'b8', 'TO', 'B');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'e4', 'AR', 'A');
    board = place(board, 'e7', 'PE', 'B');
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('checkmate');

    expect(applyScocca(state, 'e4', 'e7').ok).toBe(false);
  });
});

describe('applySwap — Mistico position swap', () => {
  it('swaps the two pieces and passes the turn', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applySwap(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('d5')?.sigla).toBe('MI');
    expect(result.state.board.get('d4')?.sigla).toBe('CA');
    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.history[0]).toMatchObject({ isSwap: true, from: 'd4', to: 'd5' });
  });

  it('rejects swapping with the King', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd1', 'MI', 'A');
    const state = createInitialGameState(board, 'A');

    expect(applySwap(state, 'd1', 'e1').ok).toBe(false);
  });

  it('rejects swapping with an enemy piece', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    expect(applySwap(state, 'd4', 'd5').ok).toBe(false);
  });

  it('rejects swapping onto an empty square', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    const state = createInitialGameState(board, 'A');

    expect(applySwap(state, 'd4', 'd5').ok).toBe(false);
  });

  it('rejects the action for a piece that cannot swap', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd5', 'CA', 'A');
    const state = createInitialGameState(board, 'A');

    expect(applySwap(state, 'd4', 'd5').ok).toBe(false);
  });

  it('rejects a swap while the acting player\'s own King is already in check and this doesn\'t resolve it', () => {
    // Swapping two other pieces can't clear a pre-existing check (occupancy is unchanged).
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    board = place(board, 'a8', 'TO', 'B'); // checks the King on a1 right now
    const state = createInitialGameState(board, 'A');
    expect(state.status).toBe('check');

    const result = applySwap(state, 'd4', 'd5');
    expect(result.ok).toBe(false);
  });
});

describe('applyRevive — Necromante resurrection', () => {
  it('revives a fallen ally onto an adjacent empty square, removing it from the graveyard', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    const result = applyRevive(state, 'd4', 'd5', 'PE');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('d5')?.sigla).toBe('PE');
    expect(result.state.board.get('d5')?.owner).toBe('A');
    expect(result.state.captured.A).toHaveLength(0);
    expect(result.state.turn).toBe('B');
    expect(result.state.turnNumber).toBe(2);
    expect(result.state.history[0]).toMatchObject({ isRevival: true, revivedSigla: 'PE', to: 'd5' });
  });

  it('accepts reviving a Paggio or Fante — the whole "pedone" category, not just PE', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PG', 'A')] } };

    const result = applyRevive(state, 'd4', 'd5', 'PG');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('d5')?.sigla).toBe('PG');
  });

  it('rejects reviving a sigla not present in the graveyard', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    const state = createInitialGameState(board, 'A');

    expect(applyRevive(state, 'd4', 'd5', 'PE').ok).toBe(false);
  });

  it('rejects reviving a non-"pedone"-category piece even if somehow in the graveyard', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('TO', 'A')] } };

    expect(applyRevive(state, 'd4', 'd5', 'TO').ok).toBe(false);
  });

  it('rejects reviving onto an occupied square', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'd5', 'CA', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    expect(applyRevive(state, 'd4', 'd5', 'PE').ok).toBe(false);
  });

  it('rejects reviving onto a non-adjacent square', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    expect(applyRevive(state, 'd4', 'd6', 'PE').ok).toBe(false);
  });

  it('rejects the action for a piece that cannot revive allies', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    expect(applyRevive(state, 'd4', 'd5', 'PE').ok).toBe(false);
  });

  it('only consumes one instance from the graveyard when duplicates exist', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A'), createPieceInstance('PE', 'A')] } };

    const result = applyRevive(state, 'd4', 'd5', 'PE');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.captured.A).toHaveLength(1);
  });
});

describe('Inquisitore Silenzio — blocks other special actions end-to-end (README §7.3)', () => {
  it('applyScocca is rejected for an Arciere silenced by an adjacent enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'AR', 'A');
    board = place(board, 'd7', 'PE', 'B');
    board = place(board, 'd5', 'IQ', 'B'); // adjacent to the Arciere
    const state = createInitialGameState(board, 'A');

    expect(applyScocca(state, 'd4', 'd7').ok).toBe(false);
  });

  it('applySwap is rejected for a Mistico silenced by an adjacent enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to the Mistico
    const state = createInitialGameState(board, 'A');

    expect(applySwap(state, 'd4', 'd5').ok).toBe(false);
  });

  it('applyRevive is rejected for a Necromante silenced by an adjacent enemy Inquisitore', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    board = place(board, 'e4', 'IQ', 'B'); // adjacent to the Necromante
    let state = createInitialGameState(board, 'A');
    state = { ...state, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    expect(applyRevive(state, 'd4', 'd5', 'PE').ok).toBe(false);
  });
});

describe('applyTurn — Colosso area damage (README §4/§7)', () => {
  it('destroys allied and enemy pieces orthogonally adjacent to the landing square after a melee capture', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'CO', 'A');
    board = place(board, 'd5', 'PE', 'B'); // captured directly
    board = place(board, 'd6', 'CA', 'A'); // ally, north of d5 — orthogonal, destroyed by the blast
    board = place(board, 'e5', 'RI', 'B'); // enemy, east of d5 — orthogonal, destroyed by the blast
    board = place(board, 'e6', 'AL', 'B'); // enemy, diagonal to d5 — survives
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    expect(result.state.board.get('d5')?.sigla).toBe('CO'); // the Colosso itself
    expect(result.state.board.has('d6')).toBe(false); // ally destroyed (orthogonal)
    expect(result.state.board.has('e5')).toBe(false); // enemy destroyed (orthogonal)
    expect(result.state.board.has('e6')).toBe(true); // diagonal neighbor survives
    expect(result.state.captured.A).toHaveLength(1); // the destroyed ally
    expect(result.state.captured.B).toHaveLength(2); // the directly-captured pawn + the blasted RI
    expect(result.state.history[0].areaDamageCoords?.sort()).toEqual(['d6', 'e5']);
  });

  it('does not trigger on a non-capturing move', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'CO', 'A');
    board = place(board, 'd6', 'CA', 'A'); // would be adjacent to d5, but nothing is captured
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.has('d6')).toBe(true); // untouched
    expect(result.state.history[0].areaDamageCoords).toBeUndefined();
  });

  it('the King is immune to the blast even when directly adjacent', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'd6', 'RE', 'B');
    board = place(board, 'd4', 'CO', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.has('d6')).toBe(true); // the enemy King survives
  });

  it('cannot be triggered by capturing an ally — the move engine never generates such a capture', () => {
    // Sanity check: Colosso simply has no legal move that captures its own piece.
    let board = place(createEmptyBoard(), 'd4', 'CO', 'A');
    board = place(board, 'd5', 'PE', 'A');
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'd5' && m.isCapture)).toBeUndefined();
  });
});
