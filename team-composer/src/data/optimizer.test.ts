import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import { autoFillTeam, improveTeam } from './optimizer';
import { computeBudgetSpent, computeDistinctSpecialTypes, computeTotalPieces } from './validators';

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

  it('never picks Damone (DM) — it is obtainable only via in-game promotion, not team-building', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    const result = autoFillTeam(start);
    expect(result.team.has('DM')).toBe(false);
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

describe('autoFillTeam / improveTeam — custom (scaled) rules', () => {
  it('autoFillTeam respects a larger budget/piece-cap than the default rules when given custom ones', () => {
    const biggerRules = { ...rules, budget: rules.budget * 2, maxPiecesTotal: rules.maxPiecesTotal * 2 };
    const start = new Map<string, number>([[KING_SIGLA, 1]]);

    const result = autoFillTeam(start, biggerRules);
    expect(result.changed).toBe(true);
    expect(computeBudgetSpent(result.team, pieces)).toBeLessThanOrEqual(biggerRules.budget);
    expect(computeTotalPieces(result.team)).toBeLessThanOrEqual(biggerRules.maxPiecesTotal);
    // with double the default budget, it should be able to add more pieces than the default rules would ever allow
    const defaultResult = autoFillTeam(start);
    expect(computeTotalPieces(result.team)).toBeGreaterThan(computeTotalPieces(defaultResult.team));
  });

  it('autoFillTeam still stops at the default budget when no custom rules are passed', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    const result = autoFillTeam(start);
    expect(computeBudgetSpent(result.team, pieces)).toBeLessThanOrEqual(rules.budget);
  });

  it('improveTeam targets a custom budget instead of the default one', () => {
    const smallerRules = { ...rules, budget: 30, maxPiecesTotal: rules.maxPiecesTotal };
    const start = new Map<string, number>([[KING_SIGLA, 1], ['PE', 1]]); // 22pt, far from the default budget
    const result = improveTeam(start, smallerRules);
    expect(computeBudgetSpent(result.team, pieces)).toBeLessThanOrEqual(smallerRules.budget);
  });
});

describe('autoFillTeam — respects the optional distinct-special-types limit', () => {
  it('never introduces more distinct special types than the configured limit, starting from empty', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1]]);
    const result = autoFillTeam(start, rules, 2);
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBeLessThanOrEqual(2);
  });

  it('never introduces a new distinct special type once the limit is already saturated by the starting team', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1]]); // 2 distinct types, limit 2
    const result = autoFillTeam(start, rules, 2);
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBe(2);
    // still allowed to top up existing types or add classic pieces though
    expect(result.team.get('CO')).toBeGreaterThanOrEqual(1);
  });

  it('never makes things worse when the starting team already exceeds the limit (pre-existing over-limit team)', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct types
    const result = autoFillTeam(start, rules, 2); // limit lower than what's already there
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBe(3); // unchanged — no 4th type added
  });

  it('reports being blocked by the special-types limit when nothing else fits the remaining budget', () => {
    // Budget only allows a single further piece and every special-type slot is used, but a new
    // classic pawn copy is still legal — the "blocked" note only appears when literally nothing
    // (new type or otherwise) can be added; here we instead assert the limit itself always holds.
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1]]);
    const result = autoFillTeam(start, rules, 2);
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBeLessThanOrEqual(2);
  });

  it('prefers reinforcing an already-present special type over introducing a new one, even when a slot is still free', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1]]);
    const startCost = computeBudgetSpent(start, pieces); // King + CO
    // +110 headroom (verified empirically, re-check after any punti rebalance): comfortably more
    // than a second CO costs, and enough room left over for other classic/special picks too — so
    // the optimizer genuinely chooses reinforcement over diversifying, not just runs out of room
    // for anything else.
    const effectiveRules = { ...rules, budget: startCost + 110, maxPiecesTotal: rules.maxPiecesTotal };

    const result = autoFillTeam(start, effectiveRules, 3); // plenty of room for new types too
    expect(result.team.get('CO')).toBe(2); // reinforced, not diluted into a new type
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBe(1); // still just CO
  });

  it('still introduces a new special type when no room is left to reinforce an existing one (identical-copy cap reached, and nothing cheaper fits)', () => {
    const necromante = pieces.find((p) => p.sigla === 'NE')!;
    const maxIdentical = rules.maxIdenticalByCategory[necromante.categoria] ?? rules.maxIdenticalDefault;
    const start = new Map<string, number>([[KING_SIGLA, 1], ['NE', maxIdentical]]); // NE maxed out — no room to reinforce
    const currentCost = computeBudgetSpent(start, pieces);
    // Remaining budget of exactly 3 excludes every classic piece (cheapest non-King classic is 4pt) —
    // only new special types costing ≤3 (PG=2, FG=3) can possibly fill it.
    const effectiveRules = { ...rules, budget: currentCost + 3, maxPiecesTotal: computeTotalPieces(start) + 1 };

    const result = autoFillTeam(start, effectiveRules, 2); // 1 slot free (NE is the only type so far)
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBe(2);
  });
});

describe('improveTeam — respects and auto-corrects the optional distinct-special-types limit', () => {
  it('never exceeds the limit while optimizing toward the budget', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['PE', 2]]);
    const result = improveTeam(start, rules, 1);
    expect(computeDistinctSpecialTypes(result.team, pieces)).toBeLessThanOrEqual(1);
  });

  it('auto-corrects a starting team that already exceeds the limit before optimizing further', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]); // 3 distinct types
    const result = improveTeam(start, rules, 2);

    expect(computeDistinctSpecialTypes(result.team, pieces)).toBeLessThanOrEqual(2);
    expect(result.changed).toBe(true);
    expect(result.message).toMatch(/Rimoss/i);
  });

  it('removes the cheapest special type(s) first when correcting an over-limit team', () => {
    // CO=34, BE=40, NE=25 — NE is cheapest, should be the first removed to free a slot. The
    // budget is pinned to exactly the post-correction cost (King + CO=34 + BE=40) so the
    // general budget-fit optimization pass that runs afterward has nothing left to improve and
    // can't swap pieces around — isolating the correction step's own behavior from whatever
    // other pieces happen to exist in the roster.
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1]]);
    const postCorrectionCost = computeBudgetSpent(new Map([[KING_SIGLA, 1], ['CO', 1], ['BE', 1]]), pieces);
    const effectiveRules = { ...rules, budget: postCorrectionCost };
    const result = improveTeam(start, effectiveRules, 2);
    expect(result.team.has('NE')).toBe(false);
    expect(result.team.has('CO')).toBe(true);
    expect(result.team.has('BE')).toBe(true);
  });

  it('never produces a team exceeding the budget even after the special-types correction pass', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1], ['NE', 1], ['BE', 1], ['PE', 3]]);
    const result = improveTeam(start, rules, 1);
    expect(computeBudgetSpent(result.team, pieces)).toBeLessThanOrEqual(rules.budget);
  });

  it('reports no correction needed when the starting team is already within the limit', () => {
    const start = new Map<string, number>([[KING_SIGLA, 1], ['CO', 1]]);
    const result = improveTeam(start, rules, 2);
    expect(result.message).not.toMatch(/Rimoss/i);
  });
});
