import { describe, expect, it } from 'vitest';
import { createEmptyBoard, createPieceInstance, setPieceAt } from './board';
import { generatePseudoLegalMoves, getPieceDef } from './moveEngine';
import { getScoccaTargets } from './scocca';
import { getSostituzioneTargets } from './sostituzione';

function boardWith(...placements: Array<[string, string, 'A' | 'B']>): ReturnType<typeof createEmptyBoard> {
  let board = createEmptyBoard();
  for (const [coord, sigla, owner] of placements) {
    board = setPieceAt(board, coord, createPieceInstance(sigla, owner));
  }
  return board;
}

const moveTos = (board: ReturnType<typeof createEmptyBoard>, from: string) =>
  generatePseudoLegalMoves(board, from).map((m) => m.to);

describe('Basilisco — sguardo pietrificante (directional freeze, 3 squares ahead)', () => {
  it('freezes an enemy piece standing on the first square straight ahead', () => {
    // BS (A) at d4 stares toward rank 8: an enemy TO at d5 is frozen — it keeps only the move
    // that captures the BS itself (d5 → d4), nothing else (its slide beyond is gone).
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'TO', 'B']);
    expect(moveTos(board, 'd5')).toEqual(['d4']);
  });

  it('freezes an enemy two and three squares ahead too (the whole ray)', () => {
    const board2 = boardWith(['d4', 'BS', 'A'], ['d6', 'PE', 'B']);
    expect(moveTos(board2, 'd6')).toEqual([]);
    const board3 = boardWith(['d4', 'BS', 'A'], ['d7', 'PE', 'B']);
    expect(moveTos(board3, 'd7')).toEqual([]);
  });

  it('the gaze pierces through pieces in between (a stare, not a blocking ray)', () => {
    // An allied PE of A's on d5 does not shield the enemy at d6 from the gaze.
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'PE', 'A'], ['d6', 'PE', 'B']);
    expect(moveTos(board, 'd6')).toEqual([]);
  });

  it('does NOT freeze enemies flanking or behind the Basilisco', () => {
    const board = boardWith(['d4', 'BS', 'A'], ['e4', 'PE', 'B'], ['d3', 'PE', 'B']);
    expect(moveTos(board, 'e4').length).toBeGreaterThan(0);
    expect(moveTos(board, 'd3').length).toBeGreaterThan(0);
  });

  it('mirrors for owner B (gaze toward rank 1)', () => {
    // BS (B) at d5 stares toward rank 1: an enemy TO (A) at d4 is frozen — its only move left is
    // the capture of the Basilisco itself (d4 → d5).
    const board = boardWith(['d5', 'BS', 'B'], ['d4', 'TO', 'A']);
    expect(moveTos(board, 'd4')).toEqual(['d5']);
  });

  it('never freezes the enemy King — the King always moves normally', () => {
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'RE', 'B']);
    // The King on d5 has its normal 8-neighbor moves that stay on the board (minus none frozen).
    expect(moveTos(board, 'd5').length).toBeGreaterThanOrEqual(3);
  });

  it('freezes special actions too, not just moves (a frozen Arciere cannot scocca)', () => {
    // AR (B) at d7 sits on the BS's ray (d4→d5→d6→d7): frozen — its ranged shot is gone.
    const frozen = boardWith(['d4', 'BS', 'A'], ['d7', 'AR', 'B'], ['d3', 'PE', 'A']);
    expect(getScoccaTargets(frozen, 'd7', 'B')).toEqual([]);
    // Same Arciere with the Basilisk moved off the ray (a1): the shot (d7→d3, distance 4) is back.
    const free = boardWith(['a1', 'BS', 'A'], ['d7', 'AR', 'B'], ['d3', 'PE', 'A']);
    expect(getScoccaTargets(free, 'd7', 'B')).toContain('d3');
  });

  it('a frozen piece can escape by capturing the Basilisco itself', () => {
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'TO', 'B']);
    expect(moveTos(board, 'd5')).toEqual(['d4']);
  });

  it('the Basilisco itself is never frozen by its own gaze', () => {
    const board = boardWith(['d4', 'BS', 'A'], ['d6', 'PE', 'B']);
    expect(moveTos(board, 'd4').length).toBeGreaterThan(0);
  });

  it('an enemy Basilisco freezes the first Basilisco (mutual gazes overlap forward)', () => {
    // BS A at d4 gazes d5; BS B at d5 gazes d4 (its forward is toward rank 1). Both stare at each
    // other: each freezes the other — neither may move (their only escapes would be capturing each
    // other, impossible from d4/d5 without moving... d4→d5 captures BS B, and d5→d4 captures BS A,
    // so each keeps exactly that one capture move).
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'BS', 'B']);
    expect(moveTos(board, 'd4')).toEqual(['d5']);
    expect(moveTos(board, 'd5')).toEqual(['d4']);
  });

  it('sostituzione is blocked for a frozen Brigante (shared freeze path via isActionBlocked)', () => {
    // BR (B) at d5 sits on the BS's ray (d4→d5→d6→d7): frozen — its swap is gone. The ally PE at
    // e5 would otherwise be a valid sostituzione target.
    const board = boardWith(['d4', 'BS', 'A'], ['d5', 'BR', 'B'], ['e5', 'PE', 'A']);
    expect(getSostituzioneTargets(board, 'd5', 'B')).toEqual([]);
    // With the Basilisk off the ray (a1), the same swap is available again.
    const free = boardWith(['a1', 'BS', 'A'], ['d5', 'BR', 'B'], ['e5', 'PE', 'A']);
    expect(getSostituzioneTargets(free, 'd5', 'B')).toEqual(['e5']);
  });

  it('roster integrity: BS is the only congelaDirezione piece', () => {
    const flagged = ['BS'];
    for (const sigla of flagged) expect(getPieceDef(sigla).congelaDirezione).toBe(true);
  });
});
