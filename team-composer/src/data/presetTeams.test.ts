import { describe, expect, it } from 'vitest';
import { pieces, rules, KING_SIGLA } from './pieces';
import { computeValidation } from './validators';
import { getPresetTeams, buildPresetTeam, randomFillTeam } from './presetTeams';

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
});
