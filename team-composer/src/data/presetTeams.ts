import { pieces, rules, KING_SIGLA } from './pieces';
import { getMaxIdenticalBySigla, computeBudgetSpent, countByCategory } from './validators';
import type { Piece } from '../types';

export type PresetTeamId = 'bilanciato' | 'aggressivo' | 'difensivo';

interface PresetTeamDef {
  id: PresetTeamId;
  label: string;
  description: string;
  composition: Array<[string, number]>;
}

// Compositions are hand-picked within budget/rules; validity is enforced by tests, not assumed.
const PRESET_DEFS: PresetTeamDef[] = [
  {
    id: 'bilanciato',
    label: 'Bilanciato',
    description: 'Un esercito classico: pedoni, alfieri, cavalli, torri e la regina.',
    composition: [[KING_SIGLA, 1], ['PE', 8], ['AL', 2], ['CA', 2], ['TO', 2], ['RA', 1]],
  },
  {
    id: 'aggressivo',
    label: 'Aggressivo',
    description: 'Pochi pedoni, molti pezzi ad alto impatto per colpire in fretta.',
    composition: [[KING_SIGLA, 1], ['PE', 5], ['BE', 2], ['CO', 1], ['AR', 1]],
  },
  {
    id: 'difensivo',
    label: 'Difensivo',
    description: 'Muro di pedoni con Golem, Paladino e Inquisitore a protezione.',
    composition: [[KING_SIGLA, 1], ['PE', 8], ['GL', 1], ['PA', 1], ['IQ', 1], ['TO', 1], ['CR', 1]],
  },
];

export function getPresetTeams(): PresetTeamDef[] {
  return PRESET_DEFS;
}

export function buildPresetTeam(id: PresetTeamId): Map<string, number> {
  const def = PRESET_DEFS.find((p) => p.id === id);
  if (!def) throw new Error(`Unknown preset team: ${id}`);
  return new Map(def.composition);
}

function getMaxIdenticalFor(sigla: string): number {
  return getMaxIdenticalBySigla(sigla, pieces, rules);
}

/**
 * Fills a team with random valid picks (respecting budget, max-identical, pawn cap,
 * and total piece cap) until nothing more fits — a random counterpart to autoFillTeam's
 * greedy optimizer.
 */
export function randomFillTeam(): Map<string, number> {
  const team = new Map<string, number>([[KING_SIGLA, 1]]);
  const maxPawns = rules.maxCountByCategory.pedone ?? rules.maxIdenticalDefault;

  let guard = 0;
  while (guard++ < 500) {
    const spent = computeBudgetSpent(team, pieces);
    let total = 0;
    team.forEach((c) => { total += c; });
    if (total >= rules.maxPiecesTotal) break;
    const budgetLeft = rules.budget - spent;
    if (budgetLeft <= 0) break;

    const candidates = pieces.filter((p: Piece) => {
      if (p.sigla === KING_SIGLA) return false;
      if (p.punti > budgetLeft) return false;
      const currentCount = team.get(p.sigla) ?? 0;
      if (currentCount >= getMaxIdenticalFor(p.sigla)) return false;
      if (p.categoria === 'pedone' && countByCategory(team, pieces, 'pedone') + 1 > maxPawns) return false;
      return true;
    });

    if (candidates.length === 0) break;

    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    team.set(pick.sigla, (team.get(pick.sigla) ?? 0) + 1);
  }

  return team;
}
