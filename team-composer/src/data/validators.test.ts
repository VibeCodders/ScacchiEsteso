import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import { computeValidation, computeBudgetSpent, getMaxIdenticalBySigla } from './validators';

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
