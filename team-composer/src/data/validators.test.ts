import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import {
  computeValidation, computeBudgetSpent, computeDistinctSpecialTypes, getMaxIdenticalBySigla,
  getMaxIdentical, getFormulaMaxIdentical, getEffectiveMaxIdentical,
  canAddPieceType, wouldExceedSpecialTypesLimit,
} from './validators';
import { autoFillTeam } from './optimizer';

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

describe('getFormulaMaxIdentical — new dynamic per-type cap x = round((d / punti)²)', () => {
  const d = Math.max(...pieces.map((p) => p.punti));

  it('caps the most expensive piece at exactly 1 copy', () => {
    const mostExpensive = pieces.find((p) => p.punti === d)!;
    expect(mostExpensive.punti).toBe(d);
    expect(getFormulaMaxIdentical(mostExpensive, pieces)).toBe(1); // (d/d)² = 1
  });

  it('is stricter for more expensive pieces (a cheaper piece never has a lower cap)', () => {
    const sorted = [...pieces].sort((a, b) => a.punti - b.punti);
    for (let i = 1; i < sorted.length; i++) {
      expect(getFormulaMaxIdentical(sorted[i], pieces))
        .toBeLessThanOrEqual(getFormulaMaxIdentical(sorted[i - 1], pieces));
    }
  });

  it('computes the exact formula on a synthetic roster, with d derived from that roster', () => {
    const base = pieces[0];
    const cheap = { ...base, punti: 5 };
    const mid = { ...base, punti: 10 };
    const top = { ...base, punti: 20 };
    const roster = [cheap, mid, top]; // d = 20
    expect(getFormulaMaxIdentical(top, roster)).toBe(1);   // (20/20)² = 1
    expect(getFormulaMaxIdentical(mid, roster)).toBe(4);   // (20/10)² = 4
    expect(getFormulaMaxIdentical(cheap, roster)).toBe(16); // (20/5)² = 16
  });

  it('is dynamic — raising the most expensive piece tightens every other cap', () => {
    const base = pieces[0];
    const at20 = { ...base, punti: 20 };
    const top40 = { ...base, punti: 40 };
    const top80 = { ...base, punti: 80 };
    const withD40 = getFormulaMaxIdentical(at20, [top40, at20]);
    const withD80 = getFormulaMaxIdentical(at20, [top80, at20]);
    expect(withD40).toBe(4);  // (40/20)² = 4
    expect(withD80).toBe(16); // (80/20)² = 16
    expect(withD80).toBeGreaterThan(withD40);
  });

  it('never divides by zero — a punti-0 piece has no formula cap', () => {
    const base = pieces[0];
    const free = { ...base, punti: 0 };
    expect(getFormulaMaxIdentical(free, pieces)).toBe(Number.POSITIVE_INFINITY);
  });
});

describe('getEffectiveMaxIdentical — the formula and the existing limits both apply (strictest wins)', () => {
  it('is the min of the existing cap and the formula cap for every piece in the roster', () => {
    for (const piece of pieces) {
      expect(getEffectiveMaxIdentical(piece, pieces, rules))
        .toBe(Math.min(getMaxIdentical(piece, rules), getFormulaMaxIdentical(piece, pieces)));
    }
  });

  it('never relaxes an existing per-piece cap (Miraggio stays at 1 despite a formula cap of 4)', () => {
    const mirage = pieces.find((p) => p.sigla === 'MG')!;
    expect(getFormulaMaxIdentical(mirage, pieces)).toBe(3); // 30pt with d=51: (51/30)² ≈ 2.89 → 3
    expect(getEffectiveMaxIdentical(mirage, pieces, rules)).toBe(1);
    expect(getMaxIdenticalBySigla('MG', pieces, rules)).toBe(1);
  });

  it('keeps the classic default for pieces cheap enough that the formula allows 5 or more', () => {
    const cheap = [...pieces].filter((p) => p.punti > 0).sort((a, b) => a.punti - b.punti)[0];
    expect(getFormulaMaxIdentical(cheap, pieces)).toBeGreaterThanOrEqual(5);
    expect(getEffectiveMaxIdentical(cheap, pieces, rules))
      .toBe(Math.min(getMaxIdentical(cheap, rules), getFormulaMaxIdentical(cheap, pieces)));
  });
});

describe('new placement rule — enforcement in canAddPieceType / computeValidation', () => {
  it('enforces the formula cap on a mid-priced piece (Regina): cap copies are legal, cap+1 is refused', () => {
    const regina = pieces.find((p) => p.sigla === 'RA')!;
    const cap = getFormulaMaxIdentical(regina, pieces);
    expect(cap).toBeGreaterThanOrEqual(1);
    expect(cap).toBeLessThan(getMaxIdentical(regina, rules)); // the formula must actually bind here

    const atCap = teamOf([[KING_SIGLA, 1], ['RA', cap]]);
    expect(computeValidation(atCap, pieces, rules).overall).toBe(true);
    expect(canAddPieceType(atCap, regina, pieces, rules)).toBe(false);

    const over = teamOf([[KING_SIGLA, 1], ['RA', cap + 1]]);
    expect(computeValidation(over, pieces, rules).maxFive.valid).toBe(false);
    expect(computeValidation(over, pieces, rules).overall).toBe(false);
  });

  it('caps the most expensive piece (today the Paladino) at exactly 1 copy', () => {
    const d = Math.max(...pieces.map((p) => p.punti));
    const mostExpensive = pieces.find((p) => p.punti === d)!;
    const one = teamOf([[KING_SIGLA, 1], [mostExpensive.sigla, 1]]);
    expect(computeValidation(one, pieces, rules).overall).toBe(true);
    expect(canAddPieceType(one, mostExpensive, pieces, rules)).toBe(false);
    const two = teamOf([[KING_SIGLA, 1], [mostExpensive.sigla, 2]]);
    expect(computeValidation(two, pieces, rules).overall).toBe(false);
  });

  it('a cheap piece can still field the old maximum of 5 identical copies', () => {
    const cheap = [...pieces].filter((p) => p.sigla !== KING_SIGLA && p.punti > 0).sort((a, b) => a.punti - b.punti)[0];
    const five = teamOf([[KING_SIGLA, 1], [cheap.sigla, 5]]);
    expect(computeValidation(five, pieces, rules).overall).toBe(true);
  });

  it('autoFillTeam never exceeds the formula cap either (it filters through canAddPieceType)', () => {
    // A budget that only fits Regina copies: the optimizer must stop at the formula cap, not at 5.
    const regina = pieces.find((p) => p.sigla === 'RA')!;
    const cap = getFormulaMaxIdentical(regina, pieces);
    const effectiveRules = { ...rules, budget: cap * regina.punti, maxPiecesTotal: cap + 1 };
    const result = autoFillTeam(teamOf([[KING_SIGLA, 1]]), effectiveRules);
    expect(result.team.get('RA') ?? 0).toBeLessThanOrEqual(cap);
    expect(computeValidation(result.team, pieces, effectiveRules).overall).toBe(true);
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
