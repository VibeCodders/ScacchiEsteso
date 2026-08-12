import { getPieceDef } from './moveEngine';
import type { GameState, HistoryEntry } from './turnManager';
import type { Owner } from './board';

/** Per-player aggregates derived from the move history and the final graveyards. */
export interface OwnerMatchStats {
  /** History entries played by this player (moves + special actions + bonus moves). */
  moves: number;
  /** Real removals (non-clone captures, including scocca, conversions and the Coniglio's final hop). */
  captures: number;
  /** Punti of the pieces this player removed from the opponent's army (clone captures are worth 0). */
  capturePunti: number;
  /** Wasted captures of a Miraggio clone (the illusion leaves the board but awards nothing). */
  cloneCaptures: number;
  promotions: number;
  /** Turns played via a special action (scocca, swap, repulse, teleport, ... sdoppiamento/riunione). */
  specialActions: number;
  /** Berserker/Lampo bonus non-capturing moves. */
  extraMoves: number;
  /** Bombe detonated by this player's captures — the blast backfires on the capturer. */
  explosions: number;
  /** Victims (allies and enemies) destroyed by this player's area damage. */
  areaDamageVictims: number;
}

/** What an owner lost, grouped by piece sigla (from the graveyard). */
export interface SiglaCount {
  sigla: string;
  count: number;
  punti: number;
}

/** How often each of a player's pieces moved. */
export interface ActivityEntry {
  sigla: string;
  count: number;
}

export interface MatchEventCounts {
  scocca: number;
  repulse: number;
  teleport: number;
  attract: number;
  swap: number;
  sostituzione: number;
  swapperSwap: number;
  sdoppiamento: number;
  riunione: number;
  revival: number;
  loot: number;
  conversion: number;
  dispelledClone: number;
  explosion: number;
  areaDamage: number;
}

export interface FirstBlood {
  owner: Owner;
  sigla: string;
  turnNumber: number;
  capturedSigla: string;
}

export interface BestCapture {
  owner: Owner;
  sigla: string;
  turnNumber: number;
  capturedSigla: string;
  punti: number;
}

export interface MostActivePiece {
  sigla: string;
  owner: Owner;
  count: number;
}

export interface MatchStats {
  plies: number;
  totalCaptures: number;
  totalCloneCaptures: number;
  totalCapturePunti: number;
  firstBlood: FirstBlood | null;
  bestCapture: BestCapture | null;
  mostActivePiece: MostActivePiece | null;
  players: Record<Owner, OwnerMatchStats>;
  events: MatchEventCounts;
  lostBySigla: Record<Owner, SiglaCount[]>;
  activityBySigla: Record<Owner, ActivityEntry[]>;
  /** Cumulative real captures per owner after each ply (0 = initial position), for a timeline chart. */
  cumulativeCaptures: { ply: number; A: number; B: number }[];
}

function emptyOwnerStats(): OwnerMatchStats {
  return {
    moves: 0,
    captures: 0,
    capturePunti: 0,
    cloneCaptures: 0,
    promotions: 0,
    specialActions: 0,
    extraMoves: 0,
    explosions: 0,
    areaDamageVictims: 0,
  };
}

function emptyEvents(): MatchEventCounts {
  return {
    scocca: 0,
    repulse: 0,
    teleport: 0,
    attract: 0,
    swap: 0,
    sostituzione: 0,
    swapperSwap: 0,
    sdoppiamento: 0,
    riunione: 0,
    revival: 0,
    loot: 0,
    conversion: 0,
    dispelledClone: 0,
    explosion: 0,
    areaDamage: 0,
  };
}

function isSpecialAction(entry: HistoryEntry): boolean {
  return Boolean(
    entry.isRangedAttack || entry.isSwap || entry.isSostituzione || entry.isRepulse ||
    entry.isTeleport || entry.isAttract || entry.isRevival || entry.isLoot || entry.isSwapperSwap ||
    entry.isSdoppiamento || entry.isMerge,
  );
}

/**
 * Computes the full match statistics for a finished game from its final snapshot: per-player
 * aggregates (moves, captures, points removed, promotions, special actions), the global event
 * ledger (scocca, repulse, teleport, ... explosions, conversions), what each player lost by
 * piece type (from the graveyard), which pieces moved the most, plus a cumulative-capture
 * timeline. Pure function of `state` — the end-of-game screen renders these as the post-match
 * statistics panel.
 */
export function computeMatchStats(state: GameState): MatchStats {
  const players: Record<Owner, OwnerMatchStats> = { A: emptyOwnerStats(), B: emptyOwnerStats() };
  const events = emptyEvents();
  const activityCounts: Record<Owner, Map<string, number>> = { A: new Map(), B: new Map() };
  const cumulativeCaptures: { ply: number; A: number; B: number }[] = [{ ply: 0, A: 0, B: 0 }];
  let cumA = 0;
  let cumB = 0;

  let firstBlood: FirstBlood | null = null;
  let bestCapture: BestCapture | null = null;

  for (const entry of state.history) {
    const stats = players[entry.owner];
    stats.moves++;
    activityCounts[entry.owner].set(entry.sigla, (activityCounts[entry.owner].get(entry.sigla) ?? 0) + 1);

    if (entry.isCapture && entry.capturedSigla) {
      if (entry.isCloneCapture) {
        stats.cloneCaptures++;
      } else {
        stats.captures++;
        const punti = getPieceDef(entry.capturedSigla).punti;
        stats.capturePunti += punti;
        if (!firstBlood) {
          firstBlood = { owner: entry.owner, sigla: entry.sigla, turnNumber: entry.turnNumber, capturedSigla: entry.capturedSigla };
        }
        if (!bestCapture || punti > bestCapture.punti) {
          bestCapture = { owner: entry.owner, sigla: entry.sigla, turnNumber: entry.turnNumber, capturedSigla: entry.capturedSigla, punti };
        }
      }
    }
    if (entry.promotedTo) stats.promotions++;
    if (entry.isExtraMove) stats.extraMoves++;
    if (entry.isExplosion) stats.explosions++;
    if (entry.areaDamageCoords?.length) stats.areaDamageVictims += entry.areaDamageCoords.length;
    if (isSpecialAction(entry)) stats.specialActions++;

    if (entry.isRangedAttack) events.scocca++;
    if (entry.isRepulse) events.repulse++;
    if (entry.isTeleport) events.teleport++;
    if (entry.isAttract) events.attract++;
    if (entry.isSwap) events.swap++;
    if (entry.isSostituzione) events.sostituzione++;
    if (entry.isSwapperSwap) events.swapperSwap++;
    if (entry.isSdoppiamento) events.sdoppiamento++;
    if (entry.isMerge) events.riunione++;
    if (entry.isRevival) events.revival++;
    if (entry.isLoot) events.loot++;
    if (entry.isConversion) events.conversion++;
    if (entry.dispelledClone) events.dispelledClone++;
    if (entry.isExplosion) events.explosion++;
    if (entry.areaDamageCoords?.length) events.areaDamage += entry.areaDamageCoords.length;

    const isRealCapture = entry.isCapture && !entry.isCloneCapture;
    if (entry.owner === 'A') cumA += isRealCapture ? 1 : 0;
    else cumB += isRealCapture ? 1 : 0;
    cumulativeCaptures.push({ ply: cumulativeCaptures.length, A: cumA, B: cumB });
  }

  let mostActivePiece: MostActivePiece | null = null;
  for (const owner of ['A', 'B'] as const) {
    for (const [sigla, count] of activityCounts[owner]) {
      if (!mostActivePiece || count > mostActivePiece.count) {
        mostActivePiece = { sigla, owner, count };
      }
    }
  }

  const lostBySigla: Record<Owner, SiglaCount[]> = { A: [], B: [] };
  for (const owner of ['A', 'B'] as const) {
    const counts = new Map<string, number>();
    for (const piece of state.captured[owner]) {
      counts.set(piece.sigla, (counts.get(piece.sigla) ?? 0) + 1);
    }
    lostBySigla[owner] = [...counts.entries()]
      .map(([sigla, count]) => ({ sigla, count, punti: count * getPieceDef(sigla).punti }))
      .sort((a, b) => b.punti - a.punti || a.sigla.localeCompare(b.sigla));
  }

  const activityBySigla: Record<Owner, ActivityEntry[]> = { A: [], B: [] };
  for (const owner of ['A', 'B'] as const) {
    activityBySigla[owner] = [...activityCounts[owner].entries()]
      .map(([sigla, count]) => ({ sigla, count }))
      .sort((a, b) => b.count - a.count || a.sigla.localeCompare(b.sigla))
      .slice(0, 6);
  }

  return {
    plies: state.history.length,
    totalCaptures: players.A.captures + players.B.captures,
    totalCloneCaptures: players.A.cloneCaptures + players.B.cloneCaptures,
    totalCapturePunti: players.A.capturePunti + players.B.capturePunti,
    firstBlood,
    bestCapture,
    mostActivePiece,
    players,
    events,
    lostBySigla,
    activityBySigla,
    cumulativeCaptures,
  };
}
