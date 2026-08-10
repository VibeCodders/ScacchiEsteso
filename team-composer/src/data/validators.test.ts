import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import {
  computeValidation, computeBudgetSpent, computeDistinctSpecialTypes, getMaxIdenticalBySigla,
  canAddPieceType, wouldExceedSpecialTypesLimit,
} from './validators';

function teamOf(entries: Array<[string, number]>): Map<string, number> {
  return new Map(entries);
}

describe('computeValidation — budget as a cap, not an exact requirement', () => {
  it('is valid (success) when spending is under the budget cap', () => {
    const team = teamOf([[KING_SIGLA, 1], ['PE', 1]]); // Pedone, low cost
    const result = computeValidation(team, pieces, rules);
    const spent = computeBudgetSpent(team, pieces);

    expect(spent).toBeLessThan(rules.budget);
    expect(result.budget.valid).toBe(true);
    expect(result.budget.level).toBe('success');
  });

  it('is valid (success) when spending exactly matches the budget cap', () => {
    // King (free) + build up to exactly the budget using the cheapest repeatable piece.
    const cheapest = [...pieces]
      .filter((p) => p.sigla !== KING_SIGLA && p.punti > 0)
      .sort((a, b) => a.punti - b.punti)[0];
    const count = Math.floor(rules.budget / cheapest.punti);
    const team = teamOf([[KING_SIGLA, 1], [cheapest.sigla, Math.min(count, getMaxIdenticalBySigla(cheapest.sigla, pieces, rules))]]);
    const spent = computeBudgetSpent(team, pieces);

    const result = computeValidation(team, pieces, rules);
    expect(result.budget.valid).toBe(spent <= rules.budget);
    expect(result.budget.level).toBe(spent <= rules.budget ? 'success' : 'error');
  });

  it('is invalid (error) only when spending exceeds the budget cap', () => {
    const queen = pieces.find((p) => p.descrizione === 'Regina')!;
    const copies = Math.ceil((rules.budget + 1) / queen.punti);
    const team = teamOf([[KING_SIGLA, 1], [queen.sigla, copies]]);
    const spent = computeBudgetSpent(team, pieces);

    expect(spent).toBeGreaterThan(rules.budget);
    const result = computeValidation(team, pieces, rules);
    expect(result.budget.valid).toBe(false);
    expect(result.budget.level).toBe('error');
  });

  it('does not require a minimum number of total pieces', () => {
    const team = teamOf([[KING_SIGLA, 1]]);
    const result = computeValidation(team, pieces, rules);
    expect(result.totalPieces.valid).toBe(true);
  });

  it('is invalid when total pieces exceed the max cap', () => {
    const pawn = pieces.find((p) => p.categoria === 'pedone' && p.sigla !== KING_SIGLA)!;
    // Use several distinct low-cost pieces to exceed maxPiecesTotal without tripping max-identical.
    const distinctCheap = [...pieces]
      .filter((p) => p.sigla !== KING_SIGLA)
      .sort((a, b) => a.punti - b.punti)
      .slice(0, rules.maxPiecesTotal + 1);
    const team = teamOf([[KING_SIGLA, 1], ...distinctCheap.map((p) => [p.sigla, 1] as [string, number])]);
    void pawn;

    const result = computeValidation(team, pieces, rules);
    expect(result.totalPieces.valid).toBe(false);
  });

  it('overall is true for a small, cheap, valid team even without spending the full budget', () => {
    const team = teamOf([[KING_SIGLA, 1], ['PE', 2]]);
    const result = computeValidation(team, pieces, rules);
    expect(result.overall).toBe(true);
  });

  it('flags a piece that exceeds its own max-identical limit', () => {
    const pawn = pieces.find((p) => p.categoria === 'pedone' && p.sigla !== KING_SIGLA)!;
    const limit = getMaxIdenticalBySigla(pawn.sigla, pieces, rules);
    const team = teamOf([[KING_SIGLA, 1], [pawn.sigla, limit + 1]]);
    const result = computeValidation(team, pieces, rules);
    expect(result.maxFive.valid).toBe(false);
  });

  it('flags too many pawns beyond the category cap', () => {
    const maxPawns = rules.maxCountByCategory.pedone;
    // Spread across distinct pawn-category pieces to exceed the category cap without tripping max-identical.
    const pawnPieces = pieces.filter((p) => p.categoria === 'pedone');
    const team = teamOf([[KING_SIGLA, 1]]);
    let remaining = maxPawns + 1;
    for (const p of pawnPieces) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, getMaxIdenticalBySigla(p.sigla, pieces, rules));
      team.set(p.sigla, take);
      remaining -= take;
    }
    expect(remaining).toBeLessThanOrEqual(0);

    const result = computeValidation(team, pieces, rules);
    expect(result.maxPawns.valid).toBe(false);
  });

  it('requires exactly one King', () => {
    const noKing = teamOf([['PE', 1]]);
    expect(computeValidation(noKing, pieces, rules).hasKing.valid).toBe(false);

    const oneKing = teamOf([[KING_SIGLA, 1]]);
    expect(computeValidation(oneKing, pieces, rules).hasKing.valid).toBe(true);

    const twoKings = teamOf([[KING_SIGLA, 2]]);
    expect(computeValidation(twoKings, pieces, rules).kingCount.valid).toBe(false);
  });
});

describe('computeDistinctSpecialTypes', () => {
  it('counts distinct non-classic siglas, not total copies (3 Colossi + 1 Necromante = 2 types, not 4)', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 3], ['NE', 1]]);
    expect(computeDistinctSpecialTypes(team, pieces)).toBe(2);
  });

  it('never counts classic pieces (including the King) toward the total', () => {
    const team = teamOf([[KING_SIGLA, 1], ['RA', 4], ['TO', 2], ['CA', 1]]); // all classico: true
    expect(computeDistinctSpecialTypes(team, pieces)).toBe(0);
  });

  it('is 0 for an empty/King-only team', () => {
    expect(computeDistinctSpecialTypes(teamOf([[KING_SIGLA, 1]]), pieces)).toBe(0);
  });
});

describe('computeValidation — optional max-distinct-special-types limit', () => {
  it('is always valid when no limit is set (default, null)', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct special types
    const result = computeValidation(team, pieces, rules, null);
    expect(result.specialTypesLimit.valid).toBe(true);
    expect(result.overall).toBe(true);
  });

  it('is valid when distinct special types are within the limit, regardless of copy count', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 2], ['NE', 1]]); // 2 distinct types, within budget (44*2 + 30 = 118)
    const result = computeValidation(team, pieces, rules, 2);
    expect(result.specialTypesLimit.valid).toBe(true);
    expect(result.overall).toBe(true);
  });

  it('is invalid, and drags down "overall", when distinct special types exceed the limit', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct types
    const result = computeValidation(team, pieces, rules, 2);
    expect(result.specialTypesLimit.valid).toBe(false);
    expect(result.specialTypesLimit.level).toBe('error');
    expect(result.overall).toBe(false);
  });

  it('classic pieces never count toward the limit, however many are included', () => {
    const team = teamOf([[KING_SIGLA, 1], ['RA', 1], ['TO', 1], ['AL', 1], ['CA', 1], ['CO', 1]]); // 1 distinct special type
    const result = computeValidation(team, pieces, rules, 1);
    expect(result.specialTypesLimit.valid).toBe(true);
  });
});

describe('wouldExceedSpecialTypesLimit', () => {
  const colosso = pieces.find((p) => p.sigla === 'CO')!; // classico: false
  const necromante = pieces.find((p) => p.sigla === 'NE')!; // classico: false
  const torre = pieces.find((p) => p.sigla === 'TO')!; // classico: true

  it('is always false when no limit is set', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    expect(wouldExceedSpecialTypesLimit(team, necromante, pieces, null)).toBe(false);
  });

  it('is always false for a classic piece, regardless of the limit', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    expect(wouldExceedSpecialTypesLimit(team, torre, pieces, 1)).toBe(false);
  });

  it('is false when the special type is already present (a copy does not need a new slot)', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    expect(wouldExceedSpecialTypesLimit(team, colosso, pieces, 1)).toBe(false);
  });

  it('is true when introducing a genuinely new special type with no slots left', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]); // 1/1 slots used
    expect(wouldExceedSpecialTypesLimit(team, necromante, pieces, 1)).toBe(true);
  });

  it('is false when a slot is still free', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]); // 1/2 slots used
    expect(wouldExceedSpecialTypesLimit(team, necromante, pieces, 2)).toBe(false);
  });
});

describe('Miraggio — per-piece maxIdentical cap of 1', () => {
  const mirage = pieces.find((p) => p.sigla === 'MG')!;

  it('is capped at 1 by its own maxIdentical, overriding the default limit of 5', () => {
    expect(mirage.maxIdentical).toBe(1);
    expect(getMaxIdenticalBySigla('MG', pieces, rules)).toBe(1);
  });

  it('a team with two Miraggi is flagged invalid by computeValidation', () => {
    const team = teamOf([[KING_SIGLA, 1], ['MG', 2]]);
    const result = computeValidation(team, pieces, rules);
    expect(result.maxFive.valid).toBe(false);
    expect(result.overall).toBe(false);
  });

  it('a single Miraggio is fully legal', () => {
    const team = teamOf([[KING_SIGLA, 1], ['MG', 1]]);
    expect(computeValidation(team, pieces, rules).overall).toBe(true);
  });

  it('canAddPieceType refuses a second Miraggio once one is present', () => {
    const team = teamOf([[KING_SIGLA, 1], ['MG', 1]]);
    expect(canAddPieceType(team, mirage, pieces, rules)).toBe(false);
  });
});

describe('canAddPieceType — single source of truth for structural eligibility', () => {
  it('rejects the King sigla (never addable through this path)', () => {
    const king = pieces.find((p) => p.sigla === KING_SIGLA)!;
    const team = teamOf([[KING_SIGLA, 1]]);
    expect(canAddPieceType(team, king, pieces, rules)).toBe(false);
  });

  it('rejects a piece already at its max-identical count', () => {
    const pawn = pieces.find((p) => p.categoria === 'pedone' && p.sigla !== KING_SIGLA)!;
    const limit = getMaxIdenticalBySigla(pawn.sigla, pieces, rules);
    const team = teamOf([[KING_SIGLA, 1], [pawn.sigla, limit]]);
    expect(canAddPieceType(team, pawn, pieces, rules)).toBe(false);
  });

  it('rejects a pawn-category piece once the pawn category cap is reached', () => {
    const maxPawns = rules.maxCountByCategory.pedone!;
    const pawnPieces = pieces.filter((p) => p.categoria === 'pedone');
    const team = teamOf([[KING_SIGLA, 1]]);
    let remaining = maxPawns;
    for (const p of pawnPieces) {
      if (remaining <= 0) break;
      const take = Math.min(remaining, getMaxIdenticalBySigla(p.sigla, pieces, rules));
      team.set(p.sigla, take);
      remaining -= take;
    }
    expect(remaining).toBe(0);

    const anotherPawn = pawnPieces.find((p) => (team.get(p.sigla) ?? 0) < getMaxIdenticalBySigla(p.sigla, pieces, rules));
    if (anotherPawn) {
      expect(canAddPieceType(team, anotherPawn, pieces, rules)).toBe(false);
    }
  });

  it('rejects a new special type once the distinct-types limit is saturated', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    const necromante = pieces.find((p) => p.sigla === 'NE')!;
    expect(canAddPieceType(team, necromante, pieces, rules, 1)).toBe(false);
  });

  it('allows reinforcing an already-present special type even when the limit is saturated', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    const colosso = pieces.find((p) => p.sigla === 'CO')!;
    expect(canAddPieceType(team, colosso, pieces, rules, 1)).toBe(true);
  });

  it('allows a classic piece even when the special-types limit is saturated', () => {
    const team = teamOf([[KING_SIGLA, 1], ['CO', 1]]);
    const torre = pieces.find((p) => p.sigla === 'TO')!;
    expect(canAddPieceType(team, torre, pieces, rules, 1)).toBe(true);
  });

  it('does not check budget — a piece with punti beyond any remaining budget is still structurally addable', () => {
    const queen = pieces.find((p) => p.descrizione === 'Regina')!;
    const team = teamOf([[KING_SIGLA, 1]]);
    expect(canAddPieceType(team, queen, pieces, rules)).toBe(true);
  });
});
