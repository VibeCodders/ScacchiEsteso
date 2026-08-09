import { describe, expect, it } from 'vitest';
import { createInitialGameState, applyTurn, skipExtraMove, applyScocca, applySwap, applyRevive } from './turnManager';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState, type Coord } from './board';
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

describe('Orfano — copia_poteri (mimics whoever threatens it)', () => {
  it('moves normally (1 square, any direction) when not under threat', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
  });

  it('rejects a normal 1-square move while under threat, without a mimic source', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // threatens d4 along the d-file
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5'); // its normal 1-square move, no mimic source given
    expect(result.ok).toBe(false);
  });

  it('moves using the mimicked piece\'s pattern once a threatening piece is chosen', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // Torre threatens d4 along the d-file
    const state = createInitialGameState(board, 'A');

    // Mimicking the Torre lets the Orfano slide, e.g. all the way to a4 (impossible for its own 1-step move).
    const result = applyTurn(state, 'd4', 'a4', undefined, 'd8');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('a4')?.sigla).toBe('OR');
    expect(result.state.board.get('a4')?.owner).toBe('A');
  });

  it('rejects an invalid or non-threatening mimic source', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B');
    board = place(board, 'h1', 'AL', 'B'); // not adjacent/threatening d4 at all
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'a4', undefined, 'h1');
    expect(result.ok).toBe(false);
  });

  it('lets the player pick which of several threats to mimic', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'OR', 'A');
    board = place(board, 'd8', 'TO', 'B'); // slide threat along the d-file
    board = place(board, 'c6', 'CA', 'B'); // knight threat
    const state = createInitialGameState(board, 'A');

    // Mimic the Knight instead of the Rook: land on a square only a knight jump could reach.
    const result = applyTurn(state, 'd4', 'b5', undefined, 'c6');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('b5')?.sigla).toBe('OR');
  });

  it('the mimicked move still cannot leave the Orfano\'s own King in check', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd1', 'OR', 'A'); // blocks a check along rank 1
    board = place(board, 'h1', 'TO', 'B'); // pins the Orfano — also threatens it, making it mimic-eligible
    const state = createInitialGameState(board, 'A');

    // Mimicking the Rook off the pin line (e.g. straight up the d-file) would expose the King.
    const result = applyTurn(state, 'd1', 'd4', undefined, 'h1');
    expect(result.ok).toBe(false);
  });
});

describe('turnsSinceProgress — anti-stalemate counter (README §8.1)', () => {
  it('increments by 1 after an ordinary non-capturing, non-pawn move', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    const state = createInitialGameState(board, 'A');

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(1);
  });

  it('resets to 0 on a capture', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'TO', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('resets to 0 on a "pedone"-category move (PE, PG, or FG), even without capturing', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'PG', 'A'); // Paggio — pedone category, not the classic PE
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('does NOT reset for the Pedone di Dama (DA) — categoria "base", not "pedone"', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'd4', 'DA', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const result = applyTurn(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(6);
  });

  it('resets to 0 on a Mistico swap', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'MI', 'A');
    board = place(board, 'd5', 'CA', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const result = applySwap(state, 'd4', 'd5');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('resets to 0 on a Necromante revival', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'NE', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5, captured: { ...state.captured, A: [createPieceInstance('PE', 'A')] } };

    const result = applyRevive(state, 'd4', 'd5', 'PE');
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.turnsSinceProgress).toBe(0);
  });

  it('a Berserker\'s capture + non-capturing bonus move still resets to 0 for the whole turn', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const captureResult = applyTurn(state, 'd4', 'd5');
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;

    const bonusResult = applyTurn(captureResult.state, 'd5', 'd6');
    expect(bonusResult.ok).toBe(true);
    if (!bonusResult.ok) return;
    expect(bonusResult.state.turnsSinceProgress).toBe(0);
  });

  it('skipExtraMove also resets to 0 — the triggering capture already counted as progress', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');
    board = place(board, 'd4', 'BE', 'A');
    board = place(board, 'd5', 'PE', 'B');
    let state = createInitialGameState(board, 'A');
    state = { ...state, turnsSinceProgress: 5 };

    const captureResult = applyTurn(state, 'd4', 'd5');
    expect(captureResult.ok).toBe(true);
    if (!captureResult.ok) return;

    const skipResult = skipExtraMove(captureResult.state);
    expect(skipResult.ok).toBe(true);
    if (!skipResult.ok) return;
    expect(skipResult.state.turnsSinceProgress).toBe(0);
  });
});

describe('anti-stalemate game end (README §8.1-§8.3)', () => {
  it('ends the game after 20 consecutive non-progress turns, as a draw when material is equal', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'b1', 'CA', 'A');
    board = place(board, 'g8', 'CA', 'B');
    let state = createInitialGameState(board, 'A');

    const squaresA: [Coord, Coord][] = [['b1', 'a3'], ['a3', 'b1']];
    const squaresB: [Coord, Coord][] = [['g8', 'h6'], ['h6', 'g8']];

    for (let ply = 0; ply < 20; ply++) {
      const isPlayerA = ply % 2 === 0;
      const pairIndex = Math.floor(ply / 2) % 2;
      const [from, to] = isPlayerA ? squaresA[pairIndex] : squaresB[pairIndex];
      const result = applyTurn(state, from, to);
      expect(result.ok, `move ${ply + 1} (${from} -> ${to}) should be legal`).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    expect(state.turnsSinceProgress).toBe(20);
    expect(state.status).toBe('anti_stalemate');
    expect(state.winner).toBeUndefined(); // equal material (King + Cavallo on both sides)
  });

  it('awards the win to the side with more remaining material when the 20-turn limit is reached', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'b1', 'CA', 'A');
    board = place(board, 'g8', 'CA', 'B');
    board = place(board, 'd4', 'TO', 'A'); // extra material for A, parked out of the way
    let state = createInitialGameState(board, 'A');

    const squaresA: [Coord, Coord][] = [['b1', 'a3'], ['a3', 'b1']];
    const squaresB: [Coord, Coord][] = [['g8', 'h6'], ['h6', 'g8']];

    for (let ply = 0; ply < 20; ply++) {
      const isPlayerA = ply % 2 === 0;
      const pairIndex = Math.floor(ply / 2) % 2;
      const [from, to] = isPlayerA ? squaresA[pairIndex] : squaresB[pairIndex];
      const result = applyTurn(state, from, to);
      expect(result.ok, `move ${ply + 1} (${from} -> ${to}) should be legal`).toBe(true);
      if (!result.ok) return;
      state = result.state;
    }

    expect(state.status).toBe('anti_stalemate');
    expect(state.winner).toBe('A');
  });

  it('rejects any further action once the game has ended by anti-stalemate', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'h8', 'RE', 'B');
    board = place(board, 'b1', 'CA', 'A');
    let state = createInitialGameState(board, 'A');
    state = { ...state, status: 'anti_stalemate', turnsSinceProgress: 20 };

    expect(applyTurn(state, 'b1', 'a3').ok).toBe(false);
  });
});

describe('GameState — custom board dimensions', () => {
  it('createInitialGameState carries the given dimensions through, defaulting to 8×8 when omitted', () => {
    let board = place(createEmptyBoard(), 'e1', 'RE', 'A');
    board = place(board, 'e8', 'RE', 'B');

    expect(createInitialGameState(board, 'A').dimensions).toEqual({ width: 8, height: 8 });
    expect(createInitialGameState(board, 'A', { width: 10, height: 6 }).dimensions).toEqual({ width: 10, height: 6 });
  });

  it('a move beyond the default 8×8 edge is legal when the state carries wider dimensions, and the resulting state keeps them', () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a6', 'RE', 'B');
    board = place(board, 'a4', 'TO', 'A'); // will slide to j4 — beyond the default 8-file width

    const state = createInitialGameState(board, 'A', { width: 10, height: 8 });
    const result = applyTurn(state, 'a4', 'j4');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.board.get('j4')?.sigla).toBe('TO');
    expect(result.state.dimensions).toEqual({ width: 10, height: 8 });
  });

  it("anti-stalemate's material-score tiebreak correctly counts a piece placed beyond the default 8×8 bounds", () => {
    let board = place(createEmptyBoard(), 'a1', 'RE', 'A');
    board = place(board, 'a8', 'RE', 'B');
    board = place(board, 'j1', 'RA', 'A'); // Regina, 48pt — only reachable with width >= 10; decisive material edge

    let state = createInitialGameState(board, 'A', { width: 10, height: 8 });
    state = { ...state, status: 'anti_stalemate', turnsSinceProgress: 20 };
    // Re-derive status/winner the way applyTurn would, using the same dimensions-aware path.
    const result = applyTurn({ ...state, status: 'ongoing', turnsSinceProgress: 19 }, 'a1', 'b1');

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.state.status).toBe('anti_stalemate');
    expect(result.state.winner).toBe('A'); // only correct if the Regina at j1 was actually counted
  });
});
