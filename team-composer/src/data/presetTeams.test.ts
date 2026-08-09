import { describe, expect, it } from 'vitest';
import { pieces, pickablePieces, rules, KING_SIGLA } from './pieces';
import { computeBudgetSpent, computeDistinctSpecialTypes, computeValidation } from './validators';
import { getPresetTeams, buildPresetTeam, randomFillTeam, isPresetValid } from './presetTeams';

describe('preset teams — each preset is a valid, ready-to-play army', () => {
  for (const preset of getPresetTeams()) {
    it(`"${preset.label}" respects budget, piece caps and has exactly one King`, () => {
      const team = buildPresetTeam(preset.id);
      const result = computeValidation(team, pieces, rules);

      expect(result.overall).toBe(true);
      expect(team.get(KING_SIGLA)).toBe(1);
    });
  }

  it('buildPresetTeam returns a fresh map each call (callers can mutate freely)', () => {
    const first = buildPresetTeam('bilanciato');
    first.set('PE', 999);
    const second = buildPresetTeam('bilanciato');
    expect(second.get('PE')).not.toBe(999);
  });
});

describe('randomFillTeam — random counterpart to autoFillTeam', () => {
  it('always produces a valid team within budget and piece caps', () => {
    for (let i = 0; i < 20; i++) {
      const team = randomFillTeam();
      const result = computeValidation(team, pieces, rules);
      expect(result.overall).toBe(true);
    }
  });

  it('produces some variation across calls (not the same team every time)', () => {
    const signatures = new Set<string>();
    for (let i = 0; i < 15; i++) {
      const team = randomFillTeam();
      signatures.add(JSON.stringify([...team.entries()].sort()));
    }
    expect(signatures.size).toBeGreaterThan(1);
  });

  it('never picks Damone (DM) — it is obtainable only via in-game promotion, not team-building', () => {
    for (let i = 0; i < 20; i++) {
      const team = randomFillTeam();
      expect(team.has('DM')).toBe(false);
    }
  });

  it('respects a custom (scaled) budget/piece-cap instead of the fixed default rules', () => {
    const smallerRules = { ...rules, budget: 20, maxPiecesTotal: 4 };
    for (let i = 0; i < 20; i++) {
      const team = randomFillTeam(smallerRules);
      expect(computeBudgetSpent(team, pieces)).toBeLessThanOrEqual(smallerRules.budget);
      expect(team.size).toBeLessThanOrEqual(smallerRules.maxPiecesTotal);
    }
  });

  it('never exceeds a configured distinct-special-types limit', () => {
    for (let i = 0; i < 30; i++) {
      const team = randomFillTeam(rules, 2);
      expect(computeDistinctSpecialTypes(team, pieces)).toBeLessThanOrEqual(2);
    }
  });

  it('can still produce a valid team when the limit is 0 (classic-only army)', () => {
    const team = randomFillTeam(rules, 0);
    expect(computeDistinctSpecialTypes(team, pieces)).toBe(0);
    expect(team.get(KING_SIGLA)).toBe(1);
    // sanity: with 0 special types allowed, only classic pieces (and the King) may appear
    const classicSiglas = new Set(pickablePieces.filter((p) => p.classico).map((p) => p.sigla));
    for (const sigla of team.keys()) {
      if (sigla === KING_SIGLA) continue;
      expect(classicSiglas.has(sigla)).toBe(true);
    }
  });
});

describe('isPresetValid — checks a fixed preset against the current match rules', () => {
  it('is valid for every preset under the default (unlimited, unscaled) rules', () => {
    for (const preset of getPresetTeams()) {
      expect(isPresetValid(preset.id, rules, null)).toBe(true);
    }
  });

  it('"Difensivo" (Golem, Paladino, Inquisitore, Corriere) becomes invalid once the special-types limit is below 4', () => {
    expect(isPresetValid('difensivo', rules, 3)).toBe(false);
  });

  it('"Bilanciato" (only classic pieces beyond the King) stays valid even with a limit of 0', () => {
    expect(isPresetValid('bilanciato', rules, 0)).toBe(true);
  });

  it('becomes invalid when the effective (scaled) budget is too small for the preset', () => {
    const tinyRules = { ...rules, budget: 1 };
    for (const preset of getPresetTeams()) {
      expect(isPresetValid(preset.id, tinyRules, null)).toBe(false);
    }
  });
});
