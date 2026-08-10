import { describe, expect, it } from 'vitest';
import { generatePseudoLegalMoves, getRabbitHopOptions, getRabbitKingStepMoves } from './moveEngine';
import { createEmptyBoard, createPieceInstance, setPieceAt, type BoardState } from './board';

function place(board: BoardState, coord: string, sigla: string, owner: 'A' | 'B' = 'A', hasMoved = false) {
  const piece = createPieceInstance(sigla, owner);
  if (hasMoved) piece.hasMoved = true;
  return setPieceAt(board, coord, piece);
}

function destinations(board: BoardState, from: string): string[] {
  return generatePseudoLegalMoves(board, from).map((m) => m.to).sort();
}

describe('King (RE) — 1-square step, all 8 directions', () => {
  it('has 8 destinations on an empty board from the center', () => {
    const board = place(createEmptyBoard(), 'e4', 'RE');
    expect(destinations(board, 'e4')).toEqual(
      ['d3', 'd4', 'd5', 'e3', 'e5', 'f3', 'f4', 'f5'].sort(),
    );
  });

  it('cannot move onto a square occupied by its own piece', () => {
    let board = place(createEmptyBoard(), 'e4', 'RE');
    board = place(board, 'e5', 'PE', 'A');
    expect(destinations(board, 'e4')).not.toContain('e5');
  });

  it('captures an enemy occupying an adjacent square', () => {
    let board = place(createEmptyBoard(), 'e4', 'RE');
    board = place(board, 'e5', 'PE', 'B');
    const moves = generatePseudoLegalMoves(board, 'e4');
    const capture = moves.find((m) => m.to === 'e5');
    expect(capture?.isCapture).toBe(true);
    expect(capture?.captureMode).toBe('melee');
  });
});

describe('Pawn (PE) — direction relative to owner, double first move, diagonal-only capture', () => {
  it('Player A pawn on its start rank can advance 1 or 2 squares forward (toward higher ranks)', () => {
    const board = place(createEmptyBoard(), 'e2', 'PE', 'A', false);
    expect(destinations(board, 'e2')).toEqual(['e3', 'e4']);
  });

  it('Player A pawn that already moved can only advance 1 square', () => {
    const board = place(createEmptyBoard(), 'e3', 'PE', 'A', true);
    expect(destinations(board, 'e3')).toEqual(['e4']);
  });

  it('Player B pawn advances toward lower ranks (mirrored forward direction)', () => {
    const board = place(createEmptyBoard(), 'e7', 'PE', 'B', false);
    expect(destinations(board, 'e7')).toEqual(['e5', 'e6']);
  });

  it('is blocked from moving straight ahead by any piece, friend or foe, and cannot capture forward', () => {
    let board = place(createEmptyBoard(), 'e2', 'PE', 'A');
    board = place(board, 'e3', 'PE', 'B');
    expect(destinations(board, 'e2')).toEqual([]);
  });

  it('the double-step is blocked if the intermediate square is occupied', () => {
    let board = place(createEmptyBoard(), 'e2', 'PE', 'A');
    board = place(board, 'e4', 'CR', 'B');
    // e3 (intermediate) is empty, e4 is occupied: e3 alone should still be reachable.
    expect(destinations(board, 'e2')).toEqual(['e3']);
  });

  it('captures diagonally forward only when an enemy occupies that square', () => {
    let board = place(createEmptyBoard(), 'e4', 'PE', 'A', true);
    board = place(board, 'd5', 'PE', 'B');
    board = place(board, 'f5', 'CA', 'A');
    const moves = generatePseudoLegalMoves(board, 'e4');
    expect(moves.map((m) => m.to).sort()).toEqual(['d5', 'e5']);
    expect(moves.find((m) => m.to === 'd5')?.isCapture).toBe(true);
  });
});

describe('Rook (TO) — orthogonal slide, blocked and captures on first obstruction', () => {
  it('has 14 destinations from the center of an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'TO');
    expect(destinations(board, 'd4')).toHaveLength(14);
  });

  it('stops before a friendly piece and captures an enemy one, without going further', () => {
    let board = place(createEmptyBoard(), 'd4', 'TO', 'A');
    board = place(board, 'd6', 'PE', 'B');
    board = place(board, 'f4', 'PE', 'A');
    const moves = generatePseudoLegalMoves(board, 'd4');
    const north = moves.filter((m) => m.to.startsWith('d') && Number(m.to[1]) > 4);
    expect(north.map((m) => m.to).sort()).toEqual(['d5', 'd6']);
    expect(north.find((m) => m.to === 'd6')?.isCapture).toBe(true);
    const east = moves.filter((m) => m.to[0] > 'd' && m.to[1] === '4');
    expect(east.map((m) => m.to)).toEqual(['e4']); // f4 (own piece) excluded
  });
});

describe('Bishop (AL) — diagonal slide, unlimited range', () => {
  it('has 13 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'AL');
    expect(destinations(board, 'd4')).toHaveLength(13);
  });
});

describe('Queen (RA) — combines rook + bishop, 27 destinations from d4', () => {
  it('has 27 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'RA');
    expect(destinations(board, 'd4')).toHaveLength(27);
  });
});

describe('Knight (CA) — fixed L pattern, ignores blocking pieces', () => {
  it('has 8 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'CA');
    expect(destinations(board, 'd4')).toHaveLength(8);
  });

  it('jumps over pieces standing between it and its landing square', () => {
    let board = place(createEmptyBoard(), 'd4', 'CA', 'A');
    board = place(board, 'd5', 'PE', 'A'); // sits "in the way" but knights ignore that
    expect(destinations(board, 'd4')).toContain('e6');
  });
});

describe('Corriere (CR) — orthogonal step, max 2 squares', () => {
  it('has 8 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'CR');
    expect(destinations(board, 'd4')).toHaveLength(8);
  });
});

describe('Ricognitore (RI) — diagonal step, max 2 squares', () => {
  it('has 8 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'RI');
    expect(destinations(board, 'd4')).toHaveLength(8);
  });
});

describe('Spettro (SP) — diagonal jump up to 2 squares, ignores intervening pieces', () => {
  it('has 8 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'SP');
    expect(destinations(board, 'd4')).toHaveLength(8);
  });

  it('can land 2 squares away and separately capture what is 1 square away, ignoring the path', () => {
    let board = place(createEmptyBoard(), 'd4', 'SP', 'A');
    board = place(board, 'e5', 'PE', 'B'); // adjacent enemy — a valid capture, and does not block f6
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'e5')?.isCapture).toBe(true);
    expect(moves.map((m) => m.to)).toContain('f6');
  });
});

describe('Catapulta (CT) — horizontal jump, 1 or 2 squares', () => {
  it('has 4 destinations from d4 on an empty board (1 and 2 squares, both directions)', () => {
    const board = place(createEmptyBoard(), 'd4', 'CT');
    expect(destinations(board, 'd4')).toEqual(['b4', 'c4', 'e4', 'f4']);
  });
});

describe('Camaleonte (CM) — move set depends on the color of the departure square', () => {
  it('on a dark square, moves like a short rook plus the universal 1-step, but not diagonally', () => {
    // d4 = dark square
    const board = place(createEmptyBoard(), 'd4', 'CM');
    const moves = destinations(board, 'd4');
    expect(moves).toContain('d1'); // orthogonal up to 3 squares
    expect(moves).not.toContain('a1'); // would require the long diagonal (chiare-only entry)
    expect(moves).toContain('c5'); // universal 1-step diagonal still applies
  });

  it('on a light square, moves like a short bishop plus the universal 1-step, but not orthogonally', () => {
    // d5 = light square
    const board = place(createEmptyBoard(), 'd5', 'CM');
    const moves = destinations(board, 'd5');
    expect(moves).toContain('a8'); // diagonal up to 4 squares
    expect(moves).not.toContain('d8'); // would require the orthogonal (scure-only entry)
    expect(moves).toContain('d6'); // universal 1-step orthogonal still applies
  });
});

describe('Pedone di Dama (DA) — single checkers-style move, chain capture deferred', () => {
  it('moves 1 square forward (owner-relative) when empty', () => {
    const board = place(createEmptyBoard(), 'd4', 'DA', 'A');
    expect(destinations(board, 'd4')).toEqual(['d5']);
  });

  it('jumps over an adjacent diagonal enemy and lands 2 squares beyond, capturing the hurdle', () => {
    let board = place(createEmptyBoard(), 'd4', 'DA', 'A');
    board = place(board, 'e5', 'PE', 'B');
    const moves = generatePseudoLegalMoves(board, 'd4');
    const jump = moves.find((m) => m.to === 'f6');
    expect(jump).toBeDefined();
    expect(jump?.isCapture).toBe(true);
    expect(jump?.capturedCoord).toBe('e5');
  });

  it('cannot jump if the landing square beyond the hurdle is occupied', () => {
    let board = place(createEmptyBoard(), 'd4', 'DA', 'A');
    board = place(board, 'e5', 'PE', 'B');
    board = place(board, 'f6', 'PE', 'A');
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'f6')).toBeUndefined();
  });

  it('mirrors forward and jump directions for Player B', () => {
    const board = place(createEmptyBoard(), 'd5', 'DA', 'B');
    expect(destinations(board, 'd5')).toEqual(['d4']);
  });
});

describe('Cavalletta (CV) — grasshopper: hops over the first piece found, lands just beyond it', () => {
  it('has no move in a direction with no piece to hop over', () => {
    const board = place(createEmptyBoard(), 'd4', 'CV');
    expect(destinations(board, 'd4')).toEqual([]);
  });

  it('lands on the empty square immediately beyond the first piece encountered', () => {
    let board = place(createEmptyBoard(), 'd4', 'CV', 'A');
    board = place(board, 'd6', 'PE', 'A'); // hurdle 2 squares north
    expect(destinations(board, 'd4')).toEqual(['d7']);
  });

  it('captures a piece sitting on the landing square, but the hurdle itself is never captured', () => {
    let board = place(createEmptyBoard(), 'd4', 'CV', 'A');
    board = place(board, 'd6', 'PE', 'B'); // hurdle — hopped over, never captured
    board = place(board, 'd7', 'CA', 'B'); // landing square — this is what gets captured
    const landing = generatePseudoLegalMoves(board, 'd4').find((m) => m.to === 'd7');
    expect(landing?.isCapture).toBe(true);
    expect(landing?.capturedCoord).toBe('d7');
  });

  it('cannot land on a friendly piece occupying the landing square', () => {
    let board = place(createEmptyBoard(), 'd4', 'CV', 'A');
    board = place(board, 'd6', 'PE', 'B');
    board = place(board, 'd7', 'CA', 'A');
    expect(destinations(board, 'd4')).not.toContain('d7');
  });

  it('only hops over the nearest piece in the line, not a farther one', () => {
    let board = place(createEmptyBoard(), 'd4', 'CV', 'A');
    board = place(board, 'd5', 'PE', 'A');
    board = place(board, 'd7', 'PE', 'B');
    expect(destinations(board, 'd4')).toEqual(['d6']);
  });
});

describe('Paladino (PA) — union of a 1-step move and a knight-pattern leap', () => {
  it('combines both move sets into 16 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'PA');
    expect(destinations(board, 'd4')).toHaveLength(16);
  });
});

describe('Damone (DM) — like DA but omnidirectional (obtained only via promotion)', () => {
  it('has 4 destinations from d4 on an empty board (one diagonal step each way)', () => {
    const board = place(createEmptyBoard(), 'd4', 'DM');
    expect(destinations(board, 'd4')).toHaveLength(4);
  });

  it('jumps over an adjacent diagonal enemy in any direction, not just forward', () => {
    let board = place(createEmptyBoard(), 'd4', 'DM', 'A');
    board = place(board, 'c3', 'PE', 'B'); // sw of d4 — "backward" for a Player A pawn, fine for Damone
    const moves = generatePseudoLegalMoves(board, 'd4');
    const jump = moves.find((m) => m.to === 'b2');
    expect(jump?.isCapture).toBe(true);
    expect(jump?.capturedCoord).toBe('c3');
  });
});

describe('Duca (DU) — diagonal 1-step, standard blocking/capture', () => {
  it('has 4 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'DU');
    expect(destinations(board, 'd4')).toEqual(['c3', 'c5', 'e3', 'e5'].sort());
  });

  it('cannot step 2 squares diagonally', () => {
    const board = place(createEmptyBoard(), 'd4', 'DU');
    expect(destinations(board, 'd4')).not.toContain('b2');
  });

  it('captures a diagonal enemy at distance 1', () => {
    let board = place(createEmptyBoard(), 'd4', 'DU', 'A');
    board = place(board, 'e5', 'PE', 'B');
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'e5')?.isCapture).toBe(true);
  });

  it('is blocked (not captured) by a diagonal ally at distance 1', () => {
    let board = place(createEmptyBoard(), 'd4', 'DU', 'A');
    board = place(board, 'e5', 'PE', 'A');
    expect(destinations(board, 'd4')).not.toContain('e5');
  });
});

describe('Elefante (EL) — diagonal 1-2, ignores intervening piece', () => {
  it('has 8 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'EL');
    expect(destinations(board, 'd4')).toHaveLength(8);
  });

  it('reaches the distance-2 square even when an ally occupies the distance-1 square', () => {
    let board = place(createEmptyBoard(), 'd4', 'EL', 'A');
    board = place(board, 'e5', 'PE', 'A'); // ally at distance 1, ignored
    expect(destinations(board, 'd4')).toContain('f6');
  });

  it('reaches and independently captures the distance-1 enemy while still reaching distance-2', () => {
    let board = place(createEmptyBoard(), 'd4', 'EL', 'A');
    board = place(board, 'e5', 'PE', 'B'); // enemy at distance 1
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'e5')?.isCapture).toBe(true);
    expect(moves.map((m) => m.to)).toContain('f6');
  });

  it('cannot land on the distance-2 square when it is occupied, regardless of distance-1', () => {
    let board = place(createEmptyBoard(), 'd4', 'EL', 'A');
    board = place(board, 'f6', 'PE', 'A'); // ally on the landing square
    expect(destinations(board, 'd4')).not.toContain('f6');
    expect(destinations(board, 'd4')).toContain('e5'); // distance-1 in that direction still reachable
  });
});

describe('Generale (GE) — union of 1-step and knight-leap (Paladino pattern)', () => {
  it('combines both move sets into 16 destinations from d4 on an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'GE');
    expect(destinations(board, 'd4')).toHaveLength(16);
  });
});

describe('Tigre (TI) — union of 1-step and rook-slide', () => {
  it('has 18 destinations from d4 on an empty board (4 diagonal king-steps + 14 rook squares)', () => {
    const board = place(createEmptyBoard(), 'd4', 'TI');
    expect(destinations(board, 'd4')).toHaveLength(18);
  });

  it('a blocker 2 squares along the rook line stops the slide there, independent of the king-step entry', () => {
    let board = place(createEmptyBoard(), 'd4', 'TI', 'A');
    board = place(board, 'd6', 'PE', 'B');
    const moves = destinations(board, 'd4');
    expect(moves).toContain('d5');
    expect(moves).toContain('d6'); // capture on first obstruction
    expect(moves).not.toContain('d7');
    expect(moves).toContain('d3'); // king-step distance-1 unaffected
  });
});

describe('Rinoceronte (RN) — union of 1-step and bishop-slide', () => {
  it('has 17 destinations from d4 on an empty board (4 orthogonal king-steps + 13 bishop squares)', () => {
    const board = place(createEmptyBoard(), 'd4', 'RN');
    expect(destinations(board, 'd4')).toHaveLength(17);
  });

  it('a blocker 2 squares along the bishop line stops the slide there, independent of the king-step entry', () => {
    let board = place(createEmptyBoard(), 'd4', 'RN', 'A');
    board = place(board, 'f6', 'PE', 'B');
    const moves = destinations(board, 'd4');
    expect(moves).toContain('e5');
    expect(moves).toContain('f6'); // capture on first obstruction
    expect(moves).not.toContain('g7');
    expect(moves).toContain('d5'); // king-step distance-1 unaffected
  });
});

describe('getRabbitHopOptions (Coniglio building block) — checkers-style hop geometry, deferred capture', () => {
  it('returns one hop per adjacent enemy with an empty landing square', () => {
    let board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    board = place(board, 'e5', 'PE', 'B');
    const hops = getRabbitHopOptions(board, 'd4', 'A', { width: 8, height: 8 });
    expect(hops).toEqual([{ to: 'f6', hurdle: 'e5' }]);
  });

  it('returns nothing for an adjacent enemy whose landing square is occupied', () => {
    let board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    board = place(board, 'e5', 'PE', 'B');
    board = place(board, 'f6', 'PE', 'A');
    const hops = getRabbitHopOptions(board, 'd4', 'A', { width: 8, height: 8 });
    expect(hops).toEqual([]);
  });

  it('returns nothing for an adjacent ally — only enemies can be jumped', () => {
    let board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    board = place(board, 'e5', 'PE', 'A');
    const hops = getRabbitHopOptions(board, 'd4', 'A', { width: 8, height: 8 });
    expect(hops).toEqual([]);
  });

  it('finds hops in all 8 directions, not just diagonal', () => {
    let board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    board = place(board, 'd5', 'PE', 'B'); // orthogonal north
    const hops = getRabbitHopOptions(board, 'd4', 'A', { width: 8, height: 8 });
    expect(hops).toEqual([{ to: 'd6', hurdle: 'd5' }]);
  });
});

describe('getRabbitKingStepMoves (Coniglio building block) — plain 1-step fallback', () => {
  it('behaves like a plain King entry: 8 destinations from the center of an empty board', () => {
    const board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    const moves = getRabbitKingStepMoves(board, 'd4', 'A', { width: 8, height: 8 });
    expect(moves.map((m) => m.to).sort()).toHaveLength(8);
  });

  it('captures a King-step enemy in melee mode', () => {
    let board = place(createEmptyBoard(), 'd4', 'CN', 'A');
    board = place(board, 'd5', 'PE', 'B');
    const moves = getRabbitKingStepMoves(board, 'd4', 'A', { width: 8, height: 8 });
    const capture = moves.find((m) => m.to === 'd5');
    expect(capture?.isCapture).toBe(true);
    expect(capture?.captureMode).toBe('melee');
  });
});

describe('Rimbalzatore (RB) — diagonal slide with a single reflective bounce', () => {
  it('reflects off a single edge (rank exceeded), mirroring only the vertical component', () => {
    // from d6, "ne" hits the top edge after e7,f8 (rank would be 9 next) — single-axis edge hit,
    // so it must reflect only dr, continuing "se" from f8: g7, h6.
    const board = place(createEmptyBoard(), 'd6', 'RB');
    const moves = destinations(board, 'd6');
    expect(moves).toContain('e7');
    expect(moves).toContain('f8');
    expect(moves).toContain('g7'); // 1st square of the reflected "se" segment from f8
    expect(moves).toContain('h6'); // 2nd square of the reflected "se" segment
  });

  it('reflects both axes off a literal corner hit', () => {
    // from d4, "ne" runs off the board exactly at the h8 corner (both axes exceeded at once) —
    // reflects 180°, retracing back along the same diagonal as "sw" from h8.
    const board = place(createEmptyBoard(), 'd4', 'RB');
    const moves = destinations(board, 'd4');
    expect(moves).toContain('h8'); // last square before the corner
    expect(moves).toContain('g7'); // 1st square of the reflected "sw" segment from h8
    expect(moves).toContain('f6');
    expect(moves).toContain('e5'); // just short of d4 itself (occupied by the RB, blocks there)
    expect(moves).not.toContain('d4');
  });

  it('offers BOTH possible reflections when bouncing off an obstacle, and never touches the obstacle itself', () => {
    let board = place(createEmptyBoard(), 'd4', 'RB', 'A');
    board = place(board, 'g7', 'PE', 'A'); // ally 3 squares out on "ne" — pivot is f6
    const moves = destinations(board, 'd4');
    expect(moves).toContain('e7'); // flip-df-only reflection ("nw" from f6)
    expect(moves).toContain('g5'); // flip-dr-only reflection ("se" from f6)
    expect(moves).not.toContain('g7'); // the obstacle itself is never a destination
    const gen = generatePseudoLegalMoves(board, 'd4');
    expect(gen.find((m) => m.capturedCoord === 'g7')).toBeUndefined();
  });

  it('offers the ordinary capture-and-stop at an enemy obstacle AND both non-capturing bounce-past continuations, simultaneously', () => {
    let board = place(createEmptyBoard(), 'd4', 'RB', 'A');
    board = place(board, 'g7', 'PE', 'B'); // enemy 3 squares out on "ne"
    const moves = generatePseudoLegalMoves(board, 'd4');
    const capture = moves.find((m) => m.to === 'g7');
    expect(capture?.isCapture).toBe(true);
    expect(capture?.capturedCoord).toBe('g7');
    expect(moves.map((m) => m.to)).toContain('e7'); // flip-df-only bounce-past
    expect(moves.map((m) => m.to)).toContain('g5'); // flip-dr-only bounce-past
  });

  it('caps at one bounce: a second obstacle along the reflected path just blocks, with no further reflection', () => {
    let board = place(createEmptyBoard(), 'd4', 'RB', 'A');
    board = place(board, 'g7', 'PE', 'A'); // 1st obstacle — triggers the bounce at f6
    board = place(board, 'e7', 'PE', 'A'); // 2nd obstacle, immediately on the "nw" reflected path
    const moves = destinations(board, 'd4');
    expect(moves).not.toContain('e7'); // blocked by the 2nd ally, not a destination
    expect(moves).not.toContain('d8'); // would only be reachable via an (illegal) second bounce off e7
  });

  it('every intermediate empty square on both segments is individually a valid destination, not just the endpoint', () => {
    const board = place(createEmptyBoard(), 'd6', 'RB');
    const moves = destinations(board, 'd6');
    // From the single-edge-bounce case above: both 1st-segment squares (e7, f8) and both
    // 2nd-segment squares (g7, h6) are present — i.e. stopping mid-path is always an option.
    expect(moves).toEqual(expect.arrayContaining(['e7', 'f8', 'g7', 'h6']));
  });
});

describe('Golem (GL) — armatura blocks capture by weak attackers', () => {
  it('cannot be captured by an attacker at or below the 14pt armor threshold', () => {
    let board = place(createEmptyBoard(), 'd4', 'CA', 'A'); // Cavallo, 12pt
    board = place(board, 'e6', 'GL', 'B'); // reachable by the knight's L-pattern
    const moves = generatePseudoLegalMoves(board, 'd4');
    expect(moves.find((m) => m.to === 'e6')).toBeUndefined();
  });

  it('can be captured by an attacker above the 14pt armor threshold', () => {
    let board = place(createEmptyBoard(), 'd4', 'TO', 'A'); // Torre, 15pt
    board = place(board, 'd8', 'GL', 'B');
    const moves = generatePseudoLegalMoves(board, 'd4');
    const capture = moves.find((m) => m.to === 'd8');
    expect(capture?.isCapture).toBe(true);
  });

  it('still blocks a weak slide attacker\'s path (can approach but not capture or pass through)', () => {
    let board = place(createEmptyBoard(), 'a1', 'AL', 'A'); // Alfiere, 10pt — below the threshold
    board = place(board, 'd4', 'GL', 'B'); // 3 squares along the same diagonal
    const moves = generatePseudoLegalMoves(board, 'a1');
    expect(moves.map((m) => m.to).sort()).toEqual(['b2', 'c3']); // can approach...
    expect(moves.find((m) => m.to === 'd4')).toBeUndefined(); // ...but not capture...
    expect(moves.map((m) => m.to)).not.toContain('e5'); // ...or slide past
  });

  it('a strong attacker sliding toward the Golem captures it and stops there (does not slide past)', () => {
    let board = place(createEmptyBoard(), 'd1', 'TO', 'A'); // Torre, 15pt — above the threshold
    board = place(board, 'd4', 'GL', 'B');
    const moves = generatePseudoLegalMoves(board, 'd1');
    expect(moves.find((m) => m.to === 'd4')?.isCapture).toBe(true);
    expect(moves.map((m) => m.to)).not.toContain('d5');
  });
});

describe('Remaining pieces — destination count from d4 on an empty board', () => {
  it.each([
    ['PG', 2], // Paggio: 1-step, n/s only, no capture
    ['FG', 1], // Fante: 1-step, n only, no capture
    ['BE', 16], // Berserker: step up to 2, all 8 directions
    ['NE', 12], // Necromante: slide up to 3, 4 diagonals
    ['IQ', 12], // Inquisitore: slide up to 3, 4 orthogonals
    ['GL', 16], // Golem: step up to 2, all 8 directions
    ['MI', 16], // Mistico: step up to 2, all 8 directions
    ['AR', 16], // Arciere: step up to 2, all 8 directions (scocca is a later-step ability)
    ['CO', 16], // Colosso: step up to 2, all 8 directions
    ['OR', 8], // Orfano: 1-step, all 8 directions (power-copying is a later-step ability)
  ] as const)('%s has %i destinations', (sigla, expectedCount) => {
    const board = place(createEmptyBoard(), 'd4', sigla);
    expect(destinations(board, 'd4')).toHaveLength(expectedCount);
  });
});

describe('generatePseudoLegalMoves — general behavior', () => {
  it('returns an empty array for an empty square', () => {
    expect(generatePseudoLegalMoves(createEmptyBoard(), 'e4')).toEqual([]);
  });
});

describe('generatePseudoLegalMoves — custom board dimensions', () => {
  it('a slide piece reaches the true edge of a wider-than-8 board, not the default 8×8 edge', () => {
    const board = place(createEmptyBoard(), 'a4', 'TO');
    const dims = { width: 12, height: 6 };
    const moves = generatePseudoLegalMoves(board, 'a4', dims);
    const destinations = moves.map((m) => m.to);

    expect(destinations).toContain('l4'); // the 12th file — unreachable on a default 8-wide board
    expect(destinations).not.toContain('m4'); // one past the edge
  });

  it('a slide piece stops at the true edge of a taller-than-8 board', () => {
    const board = place(createEmptyBoard(), 'd1', 'TO');
    const dims = { width: 8, height: 12 };
    const destinations = generatePseudoLegalMoves(board, 'd1', dims).map((m) => m.to);

    expect(destinations).toContain('d12');
    expect(destinations).not.toContain('d13');
  });

  it('stays confined to a small 4×4 board (the minimum playable size)', () => {
    const board = place(createEmptyBoard(), 'a1', 'RA'); // Regina — moves in every direction
    const dims = { width: 4, height: 4 };
    const destinations = generatePseudoLegalMoves(board, 'a1', dims).map((m) => m.to);

    for (const coord of destinations) {
      expect(['a', 'b', 'c', 'd']).toContain(coord[0]);
      expect(Number(coord.slice(1))).toBeLessThanOrEqual(4);
    }
    expect(destinations).toContain('d4'); // reaches the far corner diagonally
  });

  it('a knight-pattern leap respects custom dimensions at the edge', () => {
    const board = place(createEmptyBoard(), 'i5', 'CA'); // 9th file — only valid on a wide board
    const dims = { width: 10, height: 8 };
    const destinations = generatePseudoLegalMoves(board, 'i5', dims).map((m) => m.to);

    expect(destinations).toContain('j7'); // within the 10-wide board
    expect(destinations.every((c) => c[0] !== 'k')); // nothing beyond file j (index 9)
  });
});
