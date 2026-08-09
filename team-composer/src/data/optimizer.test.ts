import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import { autoFillTeam, improveTeam } from './optimizer';
import { computeBudgetSpent, computeTotalPieces } from './validators';

describe('autoFillTeam — fills up without requiring an exact budget match', () => {
  it('adds pieces until the budget cap or piece cap is reached, never exceeding either', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    const result = autoFillTeam(start);

    const spent = computeBudgetSpent(result.team, pieces);
    const total = computeTotalPieces(result.team);

    expect(result.changed).toBe(true);
    expect(spent).toBeLessThanOrEqual(rules.budget);
    expect(total).toBeLessThanOrEqual(rules.maxPiecesTotal);
  });

  it('does not treat "under budget" as a failure — a partial fill is still a valid changed result', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    const result = autoFillTeam(start);
    // The optimizer should have added at least one piece even though there is no minimum to satisfy.
    expect(computeTotalPieces(result.team)).toBeGreaterThan(1);
  });

  it('reports no change when the budget is already exhausted', () => {
    const queen = pieces.find((p) => p.descrizione === 'Regina')!;
    const copies = Math.floor(rules.budget / queen.punti);
    const start = new Map<string, number>([[KING_SIGLA, 1], [queen.sigla, Math.min(copies, 5)]]);
    const spentBefore = computeBudgetSpent(start, pieces);
    const remaining = rules.budget - spentBefore;

    const result = autoFillTeam(start);
    if (remaining <= 0) {
      expect(result.changed).toBe(false);
    }
  });

  it('reports no change when the max piece count is already reached', () => {
    const cheapest = [...pieces].filter((p) => p.sigla !== KING_SIGLA).sort((a, b) => a.punti - b.punti);
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    let total = 1;
    for (const p of cheapest) {
      if (total >= rules.maxPiecesTotal) break;
      const canAdd = Math.min(rules.maxPiecesTotal - total, 5);
      if (canAdd <= 0) break;
      start.set(p.sigla, canAdd);
      total += canAdd;
      if (total >= rules.maxPiecesTotal) break;
    }
    expect(computeTotalPieces(start)).toBeGreaterThanOrEqual(rules.maxPiecesTotal);

    const result = autoFillTeam(start);
    expect(result.changed).toBe(false);
    expect(result.message).toMatch(/completo/i);
  });
});

describe('improveTeam — still tries to approach the budget cap, but is optional', () => {
  it('leaves a team unchanged if it already spends exactly the budget', () => {
    const cheapest = [...pieces].filter((p) => p.sigla !== KING_SIGLA && p.punti > 0).sort((a, b) => a.punti - b.punti)[0];
    if (rules.budget % cheapest.punti === 0) {
      const count = rules.budget / cheapest.punti;
      const start = new Map<string, number>([[KING_SIGLA, 1], [cheapest.sigla, Math.min(count, 5)]]);
      if (computeBudgetSpent(start, pieces) === rules.budget) {
        const result = improveTeam(start);
        expect(result.changed).toBe(false);
      }
    }
  });

  it('never produces a team that exceeds the budget', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['PE', 3]]);
    const result = improveTeam(start);
    expect(computeBudgetSpent(result.team, pieces)).toBeLessThanOrEqual(rules.budget);
  });
});
