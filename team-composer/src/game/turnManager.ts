import {
  createPieceInstance,
  coordToFileRank,
  fileRankToCoord,
  getPieceAt,
  movePiece,
  removePieceAt,
  setPieceAt,
  swapPieces,
  DEFAULT_BOARD_DIMENSIONS,
  type BoardDimensions,
  type BoardState,
  type Coord,
  type Owner,
  type PieceInstance,
} from './board';
import { applyMove, getPieceDef, getRabbitHopOptions, getRabbitKingStepMoves, type GeneratedMove, type RabbitHopOption } from './moveEngine';
import { getLegalMoves, isCheckmate, isKingInCheck, isStalemate } from './check';
import { getPromotionOptions, isPromotionMove } from './promotion';
import { canUseScocca, getScoccaTargets } from './scocca';
import { canRepulse, getRepulseTargets } from './repulse';
import { canTeleport, getTeleportTargets } from './teleport';
import { canAttract, getAttractTargets } from './vortex';
import { canSwap, getSwapTargets } from './swap';
import { canSostituire, getSostituzioneTargets } from './sostituzione';
import { canSwapperSwap, getSwapperCandidateSquares } from './swapper';
import { canRevive, getRevivalSquares, getRevivableSiglas } from './necromancy';
import { getAreaDamageVictims, triggersAreaDamage } from './areaDamage';
import { resolveExplosion } from './bomb';
import { canMimic, getMimicMoves, getOrphanThreats } from './orphan';
import { canConvertOnCapture, getGhoulPlacementSquares, GHOUL_SIGLA } from './vampire';
import { isSilenced } from './auras';
import { ANTI_STALEMATE_TURN_LIMIT, resolveAntiStalemateWinner } from './antiStalemate';
import {
  canSdoppiare,
  canRiunire,
  getSdoppiamentoSquares,
  getRiunioneSquares,
  isMirageClone,
  isRealMirage,
  findCloneOf,
  findRealOf,
  removeWithMirageFallout,
} from './mirage';

export type GameStatus = 'ongoing' | 'check' | 'checkmate' | 'stalemate' | 'anti_stalemate';

export interface HistoryEntry {
  turnNumber: number;
  owner: Owner;
  from: Coord;
  to: Coord;
  sigla: string;
  isCapture: boolean;
  capturedCoord?: Coord;
  capturedSigla?: string;
  /** Set when this move promoted the piece (e.g. PE → AL, or DA → DM). */
  promotedTo?: string;
  /** True for a Berserker's bonus non-capturing move after a melee capture (README §4.2). */
  isExtraMove?: boolean;
  /** True for an Arciere's "scocca" — a ranged elimination that doesn't move the attacker. */
  isRangedAttack?: boolean;
  /** True for a Mistico's "scambio di posizione" with an adjacent ally. */
  isSwap?: boolean;
  /** True for a Brigante's "sostituzione": it swaps squares with an adjacent ENEMY (never the
   *  King) — no capture, a pure exchange of position. `to` is the enemy's original square (where
   *  the Brigante lands) and `sostituitoCon` is that same square, kept explicit for symmetry
   *  with isRepulse/isAttract (which also name the displaced piece's landing square). */
  isSostituzione?: boolean;
  sostituitoCon?: Coord;
  /** True for a Repulsore's "respingi": it pushes an adjacent enemy one square directly away
   *  from itself, onto an empty square — `to` is the pushed piece's ORIGINAL square, and
   *  `repulsedTo` is where it lands. The Repulsore itself never moves. */
  isRepulse?: boolean;
  repulsedTo?: Coord;
  /** True for a Teletrasporto's "teletrasporto": it relocates to an empty square at exactly 3
   *  squares in a straight direction, jumping over everything — `to` is the landing square. */
  isTeleport?: boolean;
  /** True for a Vortice's "attira": it pulls an enemy at exactly 2 squares onto the empty square
   *  in between — `to` is the pulled piece's ORIGINAL square, and `attractedTo` is where it lands.
   *  The Vortice itself never moves. */
  isAttract?: boolean;
  attractedTo?: Coord;
  /** True when a Bomba (BO) was the captured piece and exploded, destroying the capturer too
   *  (unless the capturer was a King). `explodedAt` is the capturer's square. */
  isExplosion?: boolean;
  explodedAt?: Coord;
  /** True for a Necromante's "rianimazione" of a fallen ally onto an adjacent empty square. */
  isRevival?: boolean;
  /** Sigla of the piece revived from the graveyard, when `isRevival` is true. */
  revivedSigla?: string;
  /** Squares destroyed by a Colosso's "danno ad area" triggered by this capture, if any. */
  areaDamageCoords?: Coord[];
  /** The pieces destroyed by that area damage, with their owners — needed to track material over
   *  time (README: the blast hits allies and enemies alike, so ownership is per victim). */
  areaDamage?: Array<{ sigla: string; owner: Owner }>;
  /** True for a Swapper's two-ally swap; `swapSquares` holds the two squares swapped (order not
   *  meaningful) since — unlike Mistico's `isSwap` — neither is guaranteed to be the acting
   *  piece's own `from` square. */
  isSwapperSwap?: boolean;
  swapSquares?: [Coord, Coord];
  /** True for a Miraggio's "sdoppiamento": it materializes an illusion clone on `cloneSquare`
   *  (the piece itself never moves) and the player designates which of the two squares holds the
   *  real Miraggio (`realSquare` — either the original `from` or `cloneSquare`). */
  isSdoppiamento?: boolean;
  cloneSquare?: Coord;
  realSquare?: Coord;
  /** True for a Miraggio's "riunione": real and clone reconstitute into a single piece on
   *  `to` (either half's square, chosen by the player); the other half dissipates. */
  isMerge?: boolean;
  /** True when the captured piece was a Miraggio's illusion clone — it leaves the board but has
   *  no material value (the opponent gained nothing: the real Miraggio survives). */
  isCloneCapture?: boolean;
  /** True when capturing the REAL Miraggio dissolved its clone as fallout (also no material value). */
  dispelledClone?: boolean;
  /** True when a Vampiro Lunare's capture CONVERTED the enemy instead of eliminating it: the
   *  victim never enters the graveyard, and an allied Ghoul materializes on `ghoulSquare`. */
  isConversion?: boolean;
  /** Where the converted Ghoul materialized (a free square adjacent to the captured piece). */
  ghoulSquare?: Coord;
}

export interface GameState {
  board: BoardState;
  /** Board size this match is being played on — fixed for the whole game, set once at creation. */
  dimensions: BoardDimensions;
  /** Whose turn it is to move now. */
  turn: Owner;
  /** 1-based count of turns completed so far, plus the one currently in progress. */
  turnNumber: number;
  history: HistoryEntry[];
  /** Pieces removed from the board, keyed by the owner they belonged to (i.e. that owner's losses). */
  captured: Record<Owner, PieceInstance[]>;
  status: GameStatus;
  /** Set once `status` becomes 'checkmate'. */
  winner?: Owner;
  /**
   * README §6 — the square a pawn skipped over on a double first move, capturable en passant by
   * an adjacent enemy pawn on the very next move only. Cleared after every move unless that move
   * itself is a fresh double step.
   */
  enPassantTarget: Coord | null;
  /**
   * README §4.2 — set right after a Berserker's melee capture: that same piece (now at this
   * square) may make one more non-capturing move before the turn actually passes. `applyTurn`
   * only accepts moves from this square while it's set; `skipExtraMove` declines it.
   */
  pendingExtraMove: Coord | null;
  /**
   * Set while a Coniglio's checkers-style jump-chain is in progress: `from` is the piece's
   * ORIGINAL square this turn, `at` is its current (post-hop) square, `lastHurdle` is the enemy
   * square that would be captured if the chain stops now. `applyTurn` only accepts further hops
   * from `at`; `stopRabbitChain` finalizes the turn, capturing only `lastHurdle` — every other
   * enemy jumped earlier in the chain remains on the board. Mutually exclusive with
   * `pendingExtraMove` by construction (no piece has both mechanics).
   */
  pendingRabbitChain: { from: Coord; at: Coord; lastHurdle: Coord; hopCount: number } | null;
  /**
   * README §8.1 — consecutive turns (plies) with no capture and no pawn-category move. Resets to
   * 0 on any capture, any "pedone"-category piece move, a Mistico swap, or a Necromante revival
   * (per the user's clarification: any board-changing special action counts as progress, not just
   * literal captures/pawn-pushes). Reaching `ANTI_STALEMATE_TURN_LIMIT` ends the game.
   */
  turnsSinceProgress: number;
}

export type ApplyTurnResult =
  | { ok: true; state: GameState }
  | { ok: false; reason: string };

function computeStatus(board: BoardState, playerToMove: Owner, turnsSinceProgress: number, dimensions: BoardDimensions): GameStatus {
  if (isCheckmate(board, playerToMove, dimensions)) return 'checkmate';
  if (isStalemate(board, playerToMove, dimensions)) return 'stalemate';
  if (turnsSinceProgress >= ANTI_STALEMATE_TURN_LIMIT) return 'anti_stalemate';
  if (isKingInCheck(board, playerToMove, dimensions)) return 'check';
  return 'ongoing';
}

function resolveWinner(status: GameStatus, board: BoardState, actingOwner: Owner, dimensions: BoardDimensions): Owner | undefined {
  if (status === 'checkmate') return actingOwner;
  if (status === 'anti_stalemate') return resolveAntiStalemateWinner(board, dimensions);
  return undefined;
}

/** README §8.1 — does this history entry count as "progress" (resets the anti-stalemate counter)? */
function isProgressEntry(entry: HistoryEntry): boolean {
  if (entry.isCapture) return true;
  if (entry.isSwap) return true;
  if (entry.isRepulse) return true; // a board-changing special action, like swap/revival
  if (entry.isTeleport) return true;
  if (entry.isAttract) return true;
  if (entry.isRevival) return true;
  if (entry.isSwapperSwap) return true;
  if (entry.isSostituzione) return true; // a board-changing special action, like swap/revival
  if (entry.isSdoppiamento) return true; // board-changing special actions, like swap/revival
  if (entry.isMerge) return true;
  return getPieceDef(entry.sigla).categoria === 'pedone';
}

export function createInitialGameState(board: BoardState, firstTurn: Owner = 'A', dimensions: BoardDimensions = DEFAULT_BOARD_DIMENSIONS): GameState {
  return {
    board,
    dimensions,
    turn: firstTurn,
    turnNumber: 1,
    history: [],
    captured: { A: [], B: [] },
    status: computeStatus(board, firstTurn, 0, dimensions),
    enPassantTarget: null,
    pendingExtraMove: null,
    pendingRabbitChain: null,
    turnsSinceProgress: 0,
  };
}

const GAME_OVER_STATUSES: ReadonlySet<GameStatus> = new Set(['checkmate', 'stalemate', 'anti_stalemate']);

/**
 * Shared preamble of every special-action turn (scocca, swap, repulse, teleport, ...): the game
 * must be ongoing, no Berserker extra move / Coniglio chain may be pending, and `from` must hold
 * the acting player's own piece. Returns the acting piece, or the rejection result to return
 * as-is — every action function used to repeat these five checks inline.
 */
function beginAction(state: GameState, from: Coord): { piece: PieceInstance } | { error: ApplyTurnResult } {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { error: { ok: false, reason: 'La partita è terminata.' } };
  }
  if (state.pendingExtraMove) {
    return { error: { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' } };
  }
  if (state.pendingRabbitChain) {
    return { error: { ok: false, reason: 'Devi prima continuare (o fermare) la catena di salti del Coniglio.' } };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { error: { ok: false, reason: `Nessun pezzo in ${from}.` } };
  }
  if (piece.owner !== state.turn) {
    return { error: { ok: false, reason: 'Non è il turno di questo giocatore.' } };
  }
  return { piece };
}

/**
 * Shared tail of every special-action turn: flips the turn, recomputes the game status, appends
 * the history entry and builds the next state. All special actions are board-changing, so
 * `turnsSinceProgress` resets to 0 unless overridden; `captured` is carried over unchanged unless
 * the action itself changed it (scocca with a Bomba explosion, a revival drawing from the
 * graveyard, ...). Previously every action function repeated this ~30-line block inline.
 */
function finishAction(
  state: GameState,
  piece: PieceInstance,
  nextBoard: BoardState,
  historyEntry: HistoryEntry,
  opts: { captured?: Record<Owner, PieceInstance[]>; turnsSinceProgress?: number } = {},
): ApplyTurnResult {
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = opts.turnsSinceProgress ?? 0; // a board-changing special action — always progress
  const status = computeStatus(nextBoard, nextTurn, turnsSinceProgress, state.dimensions);

  return {
    ok: true,
    state: {
      board: nextBoard,
      dimensions: state.dimensions,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      history: [...state.history, historyEntry],
      captured: opts.captured ?? state.captured,
      status,
      winner: resolveWinner(status, nextBoard, piece.owner, state.dimensions),
      enPassantTarget: null,
      pendingExtraMove: null,
      pendingRabbitChain: null,
      turnsSinceProgress,
    },
  };
}

/** README §6 — en passant is only between Pedoni (PE), not the checkers-style Pedone di Dama. */
const EN_PASSANT_SIGLA = 'PE';

function computeEnPassantCapture(
  board: BoardState,
  from: Coord,
  piece: PieceInstance,
  enPassantTarget: Coord,
  dimensions: BoardDimensions,
): GeneratedMove | null {
  if (piece.sigla !== EN_PASSANT_SIGLA) return null;
  if (getPieceAt(board, enPassantTarget)) return null; // destination must be empty

  const { file: fromFile, rank: fromRank } = coordToFileRank(from);
  const { file: targetFile, rank: targetRank } = coordToFileRank(enPassantTarget);
  const forwardDelta = piece.owner === 'A' ? 1 : -1;
  if (targetRank !== fromRank + forwardDelta || Math.abs(targetFile - fromFile) !== 1) return null;

  const capturedCoord = fileRankToCoord(targetFile, fromRank, dimensions);
  if (!capturedCoord) return null;
  const capturedPiece = getPieceAt(board, capturedCoord);
  if (!capturedPiece || capturedPiece.sigla !== EN_PASSANT_SIGLA || capturedPiece.owner === piece.owner) return null;

  return { from, to: enPassantTarget, isCapture: true, capturedCoord, captureMode: 'melee', movementType: 'step' };
}

/** Safety cap on the total number of hops in a single Coniglio chain — purely to bound the
 *  worst case (re-jumping the same enemy back and forth is legal and unbounded in principle);
 *  no normal game ever approaches this. */
export const RABBIT_CHAIN_SAFETY_CAP = 100;

/** A hop doesn't remove any piece from the board (capture is deferred), so "does this hop leave
 *  my own king in check" is evaluated by relocating the mover only, never removing the hurdle. */
function isRabbitHopKingSafe(board: BoardState, hop: RabbitHopOption, owner: Owner, from: Coord, dimensions: BoardDimensions): boolean {
  const resultingBoard = movePiece(board, from, hop.to);
  return !isKingInCheck(resultingBoard, owner, dimensions);
}

function rabbitHopsToMoves(board: BoardState, hops: RabbitHopOption[], owner: Owner, from: Coord, dimensions: BoardDimensions): GeneratedMove[] {
  return hops
    .filter((hop) => isRabbitHopKingSafe(board, hop, owner, from, dimensions))
    .map((hop) => ({ from, to: hop.to, isCapture: false, captureMode: 'leap' as const, movementType: 'leap' as const }));
}

/** Legal moves/hops for a Coniglio's FIRST action of the turn (not mid-chain): if any hops are
 *  available from `from` AND at least one survives king-safety filtering, those are the only
 *  legal destinations (jump takes priority over the King-step fallback); otherwise falls back to
 *  the King-step move — including when every geometrically available hop is pinned-illegal, since
 *  a jump nobody may legally play isn't really "available" for this piece's own priority rule. */
function getRabbitFirstMoveOptions(state: GameState, from: Coord, owner: Owner): GeneratedMove[] {
  const hops = getRabbitHopOptions(state.board, from, owner, state.dimensions);
  const safeHops = rabbitHopsToMoves(state.board, hops, owner, from, state.dimensions);
  if (safeHops.length > 0) return safeHops;

  return getRabbitKingStepMoves(state.board, from, owner, state.dimensions).filter((move) => {
    const resultingBoard = applyMove(state.board, move);
    return !isKingInCheck(resultingBoard, owner, state.dimensions);
  });
}

/** Legal next-hop destinations for a Coniglio already mid-chain. */
function getRabbitChainContinuationOptions(state: GameState): GeneratedMove[] {
  if (!state.pendingRabbitChain) return [];
  const { at } = state.pendingRabbitChain;
  const piece = getPieceAt(state.board, at);
  if (!piece) return [];
  const hops = getRabbitHopOptions(state.board, at, piece.owner, state.dimensions);
  return rabbitHopsToMoves(state.board, hops, piece.owner, at, state.dimensions);
}

/** The hurdle that would be captured if the chain stopped right after this hop, from the same
 *  set of options `getRabbitFirstMoveOptions`/`getRabbitChainContinuationOptions` computed. */
function findRabbitHurdle(board: BoardState, from: Coord, to: Coord, owner: Owner, dimensions: BoardDimensions): Coord | undefined {
  return getRabbitHopOptions(board, from, owner, dimensions).find((hop) => hop.to === to)?.hurdle;
}

/**
 * Legal moves for the piece at `from`, including the en passant capture when currently available.
 * If the piece is an Orfano currently threatened (README: "ha tutti i poteri di chi lo tiene in
 * scacco"), its move set instead comes entirely from mimicking `orphanMimicSource` — one of the
 * pieces returned by `getOrphanThreats` — chosen by the player when there's more than one threat.
 * Passing no (or an invalid) mimic source while threatened yields no moves, forcing the caller to
 * collect a choice first (mirroring the promotion-dialog pattern).
 */
export function getLegalMovesForTurn(state: GameState, from: Coord, orphanMimicSource?: Coord): GeneratedMove[] {
  const piece = getPieceAt(state.board, from);
  if (!piece) return [];

  if (getPieceDef(piece.sigla).catenaSaltiConCatturaFinale) {
    if (state.pendingRabbitChain) {
      return from === state.pendingRabbitChain.at ? getRabbitChainContinuationOptions(state) : [];
    }
    return getRabbitFirstMoveOptions(state, from, piece.owner);
  }

  if (canMimic(getPieceDef(piece.sigla))) {
    const threats = getOrphanThreats(state.board, from, piece.owner, state.dimensions);
    if (threats.length > 0) {
      if (!orphanMimicSource || !threats.includes(orphanMimicSource)) return [];
      return getMimicMoves(state.board, from, orphanMimicSource, state.dimensions).filter((move) => {
        const resultingBoard = applyMove(state.board, move);
        return !isKingInCheck(resultingBoard, piece.owner, state.dimensions);
      });
    }
  }

  const baseMoves = getLegalMoves(state.board, from, state.dimensions);
  if (!state.enPassantTarget) return baseMoves;

  const enPassantMove = computeEnPassantCapture(state.board, from, piece, state.enPassantTarget, state.dimensions);
  if (!enPassantMove) return baseMoves;

  const resultingBoard = applyMove(state.board, enPassantMove);
  if (isKingInCheck(resultingBoard, piece.owner, state.dimensions)) return baseMoves;

  return [...baseMoves, enPassantMove];
}

function computeEnPassantTargetAfter(piece: PieceInstance, move: GeneratedMove, dimensions: BoardDimensions): Coord | null {
  if (piece.sigla !== EN_PASSANT_SIGLA || move.isCapture) return null;
  const { file: fromFile, rank: fromRank } = coordToFileRank(move.from);
  const { rank: toRank } = coordToFileRank(move.to);
  if (Math.abs(toRank - fromRank) !== 2) return null;
  return fileRankToCoord(fromFile, (fromRank + toRank) / 2, dimensions);
}

interface MoveOutcome {
  nextBoard: BoardState;
  nextCaptured: Record<Owner, PieceInstance[]>;
  historyEntry: HistoryEntry;
}

function resolveMove(state: GameState, piece: PieceInstance, move: GeneratedMove, promotionChoice: string | undefined, isExtraMove: boolean, ghoulSquare?: Coord): MoveOutcome {
  const capturedPiece = move.capturedCoord ? getPieceAt(state.board, move.capturedCoord) : undefined;
  // The clone of a real Miraggio dissolves the moment the real is removed (applyMove handles the
  // board; the graveyard bookkeeping below handles what's worth punti).
  const dispelledClone = capturedPiece && isRealMirage(capturedPiece) ? Boolean(findCloneOf(state.board, capturedPiece.mirage!.id)) : false;
  let nextBoard = applyMove(state.board, move);

  if (promotionChoice) {
    nextBoard = setPieceAt(nextBoard, move.to, createPieceInstance(promotionChoice, piece.owner));
  }

  const pieceDef = getPieceDef(piece.sigla);
  // Vampiro Lunare's Sete di Sangue: a capture CONVERTS the enemy instead of eliminating it — an
  // allied Ghoul materializes on a free square adjacent to the captured piece. With
  // several candidates the UI has the player choose (`ghoulSquare`); the engine auto-picks the
  // first when none was given (bot / single candidate). Without any free square the conversion is
  // impossible and the capture resolves normally (the enemy is eliminated after all). A converted
  // piece never reaches the graveyard and a converted Bomba does not explode (it was not destroyed).
  let ghoulPlacement: Coord | undefined;
  if (capturedPiece && canConvertOnCapture(pieceDef) && move.isCapture && move.capturedCoord) {
    const options = getGhoulPlacementSquares(nextBoard, move.capturedCoord, state.dimensions);
    ghoulPlacement = ghoulSquare && options.includes(ghoulSquare) ? ghoulSquare : options[0];
    if (ghoulPlacement) {
      nextBoard = setPieceAt(nextBoard, ghoulPlacement, createPieceInstance(GHOUL_SIGLA, piece.owner));
    }
  }
  const converted = Boolean(ghoulPlacement);

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  if (capturedPiece && !isMirageClone(capturedPiece) && !converted) {
    // A clone is an illusion: it leaves the board but awards no punti (killing it was a wasted
    // capture — the real Miraggio survives). Only the real piece has material value.
    nextCaptured[capturedPiece.owner] = [...nextCaptured[capturedPiece.owner], capturedPiece];
  }

  // Bomba (esplodeSeCatturato): capturing it destroys the capturer too — never a King, and never
  // when the blast would expose the capturer's own King. The exploded capturer joins its owner's
  // graveyard like any captured piece. Collateral area-damage victims never trigger the blast.
  // A Bomba CONVERTED by the Vampiro Lunare was not destroyed, so it does not explode.
  let explodedAt: Coord | undefined;
  if (!converted && capturedPiece && !isMirageClone(capturedPiece)) {
    const explosion = resolveExplosion(nextBoard, capturedPiece, move.to, piece.owner, state.dimensions);
    if (explosion.explodedAt) {
      explodedAt = explosion.explodedAt;
      nextBoard = explosion.board;
      if (explosion.explodedCapturer && !isMirageClone(explosion.explodedCapturer)) {
        nextCaptured[explosion.explodedCapturer.owner] = [...nextCaptured[explosion.explodedCapturer.owner], explosion.explodedCapturer];
      }
      // A real Miraggio destroyed by the blast takes its clone with it (README §9: the illusion
      // cannot outlive its source — a lone clone must never be left on the board).
      if (explosion.explodedCapturer && isRealMirage(explosion.explodedCapturer)) {
        const clone = findCloneOf(explosion.board, explosion.explodedCapturer.mirage!.id);
        if (clone) nextBoard = removePieceAt(nextBoard, clone.coord);
      }
    }
  }

  let areaDamageCoords: Coord[] | undefined;
  let areaDamage: Array<{ sigla: string; owner: Owner }> | undefined;
  // A Colosso destroyed by the blast is gone: no area damage fires from its empty square.
  if (!explodedAt && triggersAreaDamage(pieceDef, move) && !isSilenced(nextBoard, move.to, piece.owner, state.dimensions)) {
    const victims = getAreaDamageVictims(nextBoard, move.to, state.dimensions);
    if (victims.length > 0) {
      // Collect victims plus any clones dissolved as fallout into one removal set (a real mirage
      // destroyed by the blast takes its clone with it; a clone caught in the blast is removed
      // without fallout). Only non-clone victims enter the graveyard — the rest are illusions.
      const removalSet = new Map<Coord, PieceInstance>();
      for (const coord of victims) {
        const victim = getPieceAt(nextBoard, coord);
        if (!victim) continue;
        removalSet.set(coord, victim);
        if (isRealMirage(victim)) {
          const clone = findCloneOf(nextBoard, victim.mirage!.id);
          if (clone && !removalSet.has(clone.coord)) removalSet.set(clone.coord, clone.piece);
        }
      }
      areaDamageCoords = [...removalSet.keys()];
      areaDamage = [...removalSet.values()]
        .filter((v) => !isMirageClone(v))
        .map((v) => ({ sigla: v.sigla, owner: v.owner }));
      for (const [coord, victim] of removalSet) {
        nextBoard = removePieceAt(nextBoard, coord);
        if (!isMirageClone(victim)) {
          nextCaptured[victim.owner] = [...nextCaptured[victim.owner], victim];
        }
      }
    }
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from: move.from,
    to: move.to,
    sigla: piece.sigla,
    isCapture: move.isCapture,
    capturedCoord: move.capturedCoord,
    capturedSigla: capturedPiece?.sigla,
    promotedTo: promotionChoice,
    isExtraMove: isExtraMove || undefined,
    areaDamageCoords,
    areaDamage,
    isExplosion: explodedAt ? true : undefined,
    explodedAt,
    isCloneCapture: capturedPiece && isMirageClone(capturedPiece) ? true : undefined,
    dispelledClone: dispelledClone ? true : undefined,
    isConversion: converted ? true : undefined,
    ghoulSquare: ghoulPlacement,
  };

  return { nextBoard, nextCaptured, historyEntry };
}

/**
 * Finalizes the turn: flips whose move it is, advances the turn counter, computes status for the
 * opponent. `forcedProgress` is true when a capture already happened earlier in this compound
 * turn (a Berserker's bonus-move resolution) — the anti-stalemate counter resets regardless of
 * what the final action of the turn was.
 */
function finalizeTurn(state: GameState, piece: PieceInstance, move: GeneratedMove, outcome: MoveOutcome, forcedProgress: boolean): GameState {
  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = forcedProgress || isProgressEntry(outcome.historyEntry) ? 0 : state.turnsSinceProgress + 1;
  const status = computeStatus(outcome.nextBoard, nextTurn, turnsSinceProgress, state.dimensions);

  return {
    board: outcome.nextBoard,
    dimensions: state.dimensions,
    turn: nextTurn,
    turnNumber: state.turnNumber + 1,
    history: [...state.history, outcome.historyEntry],
    captured: outcome.nextCaptured,
    status,
    winner: resolveWinner(status, outcome.nextBoard, piece.owner, state.dimensions),
    enPassantTarget: computeEnPassantTargetAfter(piece, move, state.dimensions),
    pendingExtraMove: null,
    pendingRabbitChain: null,
    turnsSinceProgress,
  };
}

/** README §4.2 — the acting player keeps the move (turn doesn't pass yet); the Berserker owes a bonus move. */
function enterExtraMovePhase(state: GameState, piece: PieceInstance, outcome: MoveOutcome): GameState {
  return {
    board: outcome.nextBoard,
    dimensions: state.dimensions,
    turn: piece.owner,
    turnNumber: state.turnNumber,
    history: [...state.history, outcome.historyEntry],
    captured: outcome.nextCaptured,
    status: computeStatus(outcome.nextBoard, piece.owner, state.turnsSinceProgress, state.dimensions),
    winner: undefined,
    enPassantTarget: null,
    pendingExtraMove: outcome.historyEntry.to,
    pendingRabbitChain: null,
    turnsSinceProgress: state.turnsSinceProgress, // the turn isn't finalized yet — resolved once the bonus move (or a skip) completes it
  };
}

function triggersExtraMove(pieceDef: ReturnType<typeof getPieceDef>, move: GeneratedMove): boolean {
  // Furia bellica (Berserker): a melee capture grants a bonus non-capturing move. Fulmine
  // (Lampo): the same, but for the dabbaba's LEAP captures — never both on one piece.
  if (pieceDef.secondoMovimentoPostCattura && move.isCapture && move.captureMode === 'melee') return true;
  if (pieceDef.fulmine && move.isCapture && move.captureMode === 'leap') return true;
  return false;
}

/** A Coniglio move is a hop (rather than its King-step fallback) exactly when it came from
 *  getRabbitHopOptions — the only Coniglio moves with captureMode 'leap'; the King-step fallback
 *  always has captureMode 'melee'. */
function isRabbitHop(pieceDef: ReturnType<typeof getPieceDef>, move: GeneratedMove): boolean {
  return Boolean(pieceDef.catenaSaltiConCatturaFinale) && move.captureMode === 'leap';
}

/** Enters (or continues) a Coniglio's jump-chain: relocates the piece without capturing anything
 *  (capture is deferred until the chain ends), keeps the turn with the acting player, and does
 *  not push a history entry yet — the whole chain becomes exactly one history entry, pushed by
 *  `stopRabbitChain`. */
function enterRabbitChainPhase(state: GameState, piece: PieceInstance, chainFrom: Coord, hop: GeneratedMove, hurdle: Coord): GameState {
  const nextBoard = movePiece(state.board, hop.from, hop.to);
  const hopCount = (state.pendingRabbitChain?.hopCount ?? 0) + 1;
  return {
    board: nextBoard,
    dimensions: state.dimensions,
    turn: piece.owner,
    turnNumber: state.turnNumber,
    history: state.history,
    captured: state.captured,
    status: computeStatus(nextBoard, piece.owner, state.turnsSinceProgress, state.dimensions),
    winner: undefined,
    enPassantTarget: null,
    pendingExtraMove: null,
    pendingRabbitChain: { from: chainFrom, at: hop.to, lastHurdle: hurdle, hopCount },
    turnsSinceProgress: state.turnsSinceProgress, // not finalized yet — resolved once the chain stops
  };
}

/**
 * Ends a Coniglio's jump-chain (README: only the LAST enemy jumped over is actually captured;
 * every other enemy hopped earlier in the chain remains on the board). Pushes exactly one
 * `HistoryEntry` for the whole chain (original square → final square) and finalizes the turn.
 */
export function stopRabbitChain(state: GameState): ApplyTurnResult {
  if (!state.pendingRabbitChain) {
    return { ok: false, reason: 'Nessuna catena di salti da fermare.' };
  }
  const { from, at, lastHurdle } = state.pendingRabbitChain;
  const piece = getPieceAt(state.board, at);
  const capturedPiece = getPieceAt(state.board, lastHurdle);
  if (!piece || !capturedPiece) {
    return { ok: false, reason: 'Stato della catena di salti non valido.' };
  }

  // Miraggio fallout: capturing the real one dissolves its clone (no punti); capturing a clone is
  // itself a wasted capture (no punti). Only the real piece lands in the graveyard.
  const dispelledClone = isRealMirage(capturedPiece) ? Boolean(findCloneOf(state.board, capturedPiece.mirage!.id)) : false;
  const { board: nextBoard0 } = removeWithMirageFallout(state.board, lastHurdle);
  const nextCaptured: Record<Owner, PieceInstance[]> = { ...state.captured };
  if (!isMirageClone(capturedPiece)) {
    nextCaptured[capturedPiece.owner] = [...nextCaptured[capturedPiece.owner], capturedPiece];
  }

  // Bomba (esplodeSeCatturato): the last jump lands on a live mine — the blast destroys the
  // Coniglio too (never a King, and never when it would expose its own King). Clones can't explode.
  let nextBoard = nextBoard0;
  let explodedAt: Coord | undefined;
  if (!isMirageClone(capturedPiece)) {
    const explosion = resolveExplosion(nextBoard0, capturedPiece, at, piece.owner, state.dimensions);
    if (explosion.explodedAt) {
      explodedAt = explosion.explodedAt;
      nextBoard = explosion.board;
      if (explosion.explodedCapturer) {
        nextCaptured[explosion.explodedCapturer.owner] = [...nextCaptured[explosion.explodedCapturer.owner], explosion.explodedCapturer];
      }
    }
  }

  const nextTurn: Owner = piece.owner === 'A' ? 'B' : 'A';
  const turnsSinceProgress = 0; // a capture — always progress
  const status = computeStatus(nextBoard, nextTurn, turnsSinceProgress, state.dimensions);

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: at,
    sigla: piece.sigla,
    isCapture: true,
    capturedCoord: lastHurdle,
    capturedSigla: capturedPiece.sigla,
    isExplosion: explodedAt ? true : undefined,
    explodedAt,
    isCloneCapture: isMirageClone(capturedPiece) ? true : undefined,
    dispelledClone: dispelledClone ? true : undefined,
  };

  return {
    ok: true,
    state: {
      board: nextBoard,
      dimensions: state.dimensions,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      history: [...state.history, historyEntry],
      captured: nextCaptured,
      status,
      winner: resolveWinner(status, nextBoard, piece.owner, state.dimensions),
      enPassantTarget: null,
      pendingExtraMove: null,
      pendingRabbitChain: null,
      turnsSinceProgress,
    },
  };
}

/**
 * Attempts to play one move as the current player's action for the turn (README §4.1 — normally
 * a single movement/capture; the Berserker's bonus move after a melee capture, README §4.2, is
 * the one built-in exception, tracked via `pendingExtraMove`). Rejects moves from the wrong
 * player, illegal moves, and any move once the game has already ended. If the move promotes the
 * piece, `promotionChoice` (one of the piece's `promotionTypes`) is required — omitting it when
 * promotion applies returns a rejection asking the caller to collect a choice and retry.
 * `orphanMimicSource` selects which threatening piece an Orfano imitates when under threat (see
 * `getLegalMovesForTurn`) — required in that situation, ignored otherwise.
 */
export function applyTurn(
  state: GameState,
  from: Coord,
  to: Coord,
  promotionChoice?: string,
  orphanMimicSource?: Coord,
  ghoulSquare?: Coord,
): ApplyTurnResult {
  if (GAME_OVER_STATUSES.has(state.status)) {
    return { ok: false, reason: 'La partita è terminata.' };
  }

  const piece = getPieceAt(state.board, from);
  if (!piece) {
    return { ok: false, reason: `Nessun pezzo in ${from}.` };
  }
  if (piece.owner !== state.turn) {
    return { ok: false, reason: 'Non è il turno di questo giocatore.' };
  }

  if (state.pendingRabbitChain) {
    if (from !== state.pendingRabbitChain.at) {
      return { ok: false, reason: 'Devi continuare (o fermare) la catena di salti del Coniglio.' };
    }
    if (state.pendingRabbitChain.hopCount >= RABBIT_CHAIN_SAFETY_CAP) {
      return { ok: false, reason: 'Limite massimo di salti raggiunto: ferma la catena.' };
    }
    const hop = getRabbitChainContinuationOptions(state).find((m) => m.to === to);
    if (!hop) {
      return { ok: false, reason: `Salto non legale: ${from} → ${to}.` };
    }
    const hurdle = findRabbitHurdle(state.board, from, to, piece.owner, state.dimensions);
    if (!hurdle) {
      return { ok: false, reason: `Salto non legale: ${from} → ${to}.` };
    }
    return { ok: true, state: enterRabbitChainPhase(state, piece, state.pendingRabbitChain.from, hop, hurdle) };
  }

  if (state.pendingExtraMove) {
    if (from !== state.pendingExtraMove) {
      return { ok: false, reason: 'Devi prima completare (o saltare) il movimento extra del Berserker.' };
    }
    const move = getLegalMovesForTurn(state, from).find((m) => m.to === to);
    if (!move) {
      return { ok: false, reason: `Mossa non legale: ${from} → ${to}.` };
    }
    if (move.isCapture) {
      return { ok: false, reason: 'Il movimento extra del Berserker non può includere una cattura.' };
    }
    const outcome = resolveMove(state, piece, move, undefined, true);
    // forcedProgress: true — reaching pendingExtraMove already required a capture earlier this turn.
    return { ok: true, state: finalizeTurn(state, piece, move, outcome, true) };
  }

  const move = getLegalMovesForTurn(state, from, orphanMimicSource).find((m) => m.to === to);
  if (!move) {
    return { ok: false, reason: `Mossa non legale: ${from} → ${to}.` };
  }

  const pieceDef = getPieceDef(piece.sigla);

  // A Vampiro Lunare's conversion placement only makes sense on a capture it can convert, and the
  // square must be a free neighbor of the captured piece on the post-capture board.
  if (ghoulSquare && !(canConvertOnCapture(pieceDef) && move.isCapture && move.capturedCoord)) {
    return { ok: false, reason: 'Conversione non applicabile a questa mossa.' };
  }
  if (ghoulSquare && move.capturedCoord) {
    const postCaptureBoard = applyMove(state.board, move);
    if (!getGhoulPlacementSquares(postCaptureBoard, move.capturedCoord, state.dimensions).includes(ghoulSquare)) {
      return { ok: false, reason: `Casella non valida per la conversione: ${ghoulSquare}.` };
    }
  }

  if (isRabbitHop(pieceDef, move)) {
    const hurdle = findRabbitHurdle(state.board, from, to, piece.owner, state.dimensions);
    if (!hurdle) {
      return { ok: false, reason: `Salto non legale: ${from} → ${to}.` };
    }
    return { ok: true, state: enterRabbitChainPhase(state, piece, from, move, hurdle) };
  }

  if (isPromotionMove(pieceDef, piece.owner, to, state.dimensions)) {
    const options = getPromotionOptions(pieceDef);
    if (!promotionChoice) {
      return { ok: false, reason: 'Scegli il pezzo di promozione.' };
    }
    if (!options.includes(promotionChoice)) {
      return { ok: false, reason: `Opzione di promozione non valida: ${promotionChoice}.` };
    }
    const outcome = resolveMove(state, piece, move, promotionChoice, false);
    return { ok: true, state: finalizeTurn(state, piece, move, outcome, false) };
  }

  const outcome = resolveMove(state, piece, move, undefined, false, ghoulSquare);
  // A Berserker destroyed by a Bomba's blast gets no bonus move — it's no longer on the board.
  if (triggersExtraMove(pieceDef, move) && !outcome.historyEntry.isExplosion) {
    return { ok: true, state: enterExtraMovePhase(state, piece, outcome) };
  }
  return { ok: true, state: finalizeTurn(state, piece, move, outcome, false) };
}

/** Declines a pending Berserker bonus move (README §4.2 makes it available, not mandatory), passing the turn. */
export function skipExtraMove(state: GameState): ApplyTurnResult {
  if (!state.pendingExtraMove) {
    return { ok: false, reason: 'Nessun movimento extra da saltare.' };
  }

  const nextTurn: Owner = state.turn === 'A' ? 'B' : 'A';
  // forcedProgress: the capture that opened this bonus phase already counts as progress this turn.
  const turnsSinceProgress = 0;
  const status = computeStatus(state.board, nextTurn, turnsSinceProgress, state.dimensions);

  return {
    ok: true,
    state: {
      ...state,
      turn: nextTurn,
      turnNumber: state.turnNumber + 1,
      status,
      winner: resolveWinner(status, state.board, state.turn, state.dimensions),
      pendingExtraMove: null,
      pendingRabbitChain: null,
      turnsSinceProgress,
    },
  };
}

/**
 * Plays an Arciere's "scocca" as the turn's action: eliminates an enemy 3-4 squares away with a
 * clear trajectory, without moving the Arciere itself (README, Arciere's alternativeActions —
 * an alternative to a normal move, not something that can be combined with one). Like any action,
 * it's rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applyScocca(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canUseScocca(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può scoccare.' };
  }

  const targets = getScoccaTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Bersaglio non valido per lo scoccare: ${target}.` };
  }

  const targetPiece = getPieceAt(state.board, target)!;
  // Miraggio fallout: shooting the real one dissolves its clone (no punti); shooting a clone is a
  // wasted shot (no punti). Only the real piece lands in the graveyard.
  const dispelledClone = isRealMirage(targetPiece) ? Boolean(findCloneOf(state.board, targetPiece.mirage!.id)) : false;
  const { board: nextBoard0 } = removeWithMirageFallout(state.board, target);

  if (isKingInCheck(nextBoard0, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const nextCaptured: Record<Owner, PieceInstance[]> = { A: state.captured.A, B: state.captured.B };
  if (!isMirageClone(targetPiece)) {
    nextCaptured[targetPiece.owner] = [...nextCaptured[targetPiece.owner], targetPiece];
  }

  // Bomba (esplodeSeCatturato): shooting one detonates it, destroying the Arciere too — never a
  // King, and never when the blast would expose the Arciere's own King. A clone cannot explode.
  let nextBoard = nextBoard0;
  let explodedAt: Coord | undefined;
  if (!isMirageClone(targetPiece)) {
    const explosion = resolveExplosion(nextBoard0, targetPiece, from, piece.owner, state.dimensions);
    if (explosion.explodedAt) {
      explodedAt = explosion.explodedAt;
      nextBoard = explosion.board;
      if (explosion.explodedCapturer) {
        nextCaptured[explosion.explodedCapturer.owner] = [...nextCaptured[explosion.explodedCapturer.owner], explosion.explodedCapturer];
      }
    }
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: from, // scocca never moves the attacker
    sigla: piece.sigla,
    isCapture: true,
    capturedCoord: target,
    capturedSigla: targetPiece.sigla,
    isRangedAttack: true,
    isExplosion: explodedAt ? true : undefined,
    explodedAt,
    isCloneCapture: isMirageClone(targetPiece) ? true : undefined,
    dispelledClone: dispelledClone ? true : undefined,
  };

  return finishAction(state, piece, nextBoard, historyEntry, { captured: nextCaptured });
}

/**
 * Plays a Mistico's "scambio di posizione" as the turn's action: instantly swaps places with an
 * adjacent ally (never the King), as an alternative to a normal move. Like any action, it's
 * rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applySwap(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canSwap(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può scambiare posizione.' };
  }

  const targets = getSwapTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Scambio non valido con: ${target}.` };
  }

  const nextBoard = swapPieces(state.board, from, target);

  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isSwap: true,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Brigante's "sostituzione" as the turn's action: instead of moving, the Brigante swaps
 * squares with an adjacent ENEMY (never the King) — no capture, a pure exchange of position (the
 * only piece in the roster that swaps with an enemy; Mistico and Swapper only swap allies). Like
 * any action, it's rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applySostituzione(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canSostituire(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può sostituirsi a un nemico.' };
  }

  const targets = getSostituzioneTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Sostituzione non valida: ${target}.` };
  }

  const nextBoard = swapPieces(state.board, from, target);
  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isSostituzione: true,
    sostituitoCon: target,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Swapper's two-ally swap as the turn's action: swaps squareA <-> squareB, both of which
 * must be in getSwapperCandidateSquares(from) — the Swapper's own square counts as one candidate,
 * so one of the two may be the Swapper itself (exactly like Mistico's swap) or both may be two
 * OTHER allies adjacent to the Swapper. Rejected if it would leave the acting player's own King
 * in check (README §3.2).
 */
export function applySwapperSwap(state: GameState, from: Coord, squareA: Coord, squareB: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canSwapperSwap(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può scambiare due alleati.' };
  }
  if (squareA === squareB) {
    return { ok: false, reason: 'Le due caselle devono essere diverse.' };
  }

  const candidates = getSwapperCandidateSquares(state.board, from, piece.owner, state.dimensions);
  if (!candidates.includes(squareA) || !candidates.includes(squareB)) {
    return { ok: false, reason: `Scambio non valido: ${squareA} <-> ${squareB}.` };
  }

  const nextBoard = swapPieces(state.board, squareA, squareB);

  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const swappedPiece = getPieceAt(state.board, squareA)!;
  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from: squareA,
    to: squareB,
    sigla: swappedPiece.sigla,
    isCapture: false,
    isSwapperSwap: true,
    swapSquares: [squareA, squareB],
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Repulsore's "respingi" as the turn's action: pushes an adjacent enemy (never the King)
 * one square directly away from the Repulsore onto an empty on-board square — an alternative to a
 * normal move that captures nothing. Like any action, it's rejected if it would leave the acting
 * player's own King in check (README §3.2 — pushing a piece away can unblock a line that was
 * shielding the King).
 */
export function applyRepulse(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canRepulse(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può respingere.' };
  }

  const targets = getRepulseTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Bersaglio non valido per respingere: ${target}.` };
  }

  // The landing square is the enemy's square mirrored past the Repulsore's own — guaranteed valid
  // by getRepulseTargets, but re-derived here so applyRepulse stays self-contained.
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);
  const { file: targetFile, rank: targetRank } = coordToFileRank(target);
  const landing = fileRankToCoord(
    targetFile + (targetFile - fromFile),
    targetRank + (targetRank - fromRank),
    state.dimensions,
  );
  if (!landing || getPieceAt(state.board, landing)) {
    return { ok: false, reason: 'La casella di arrivo non è libera.' };
  }

  const nextBoard = movePiece(state.board, target, landing);

  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isRepulse: true,
    repulsedTo: landing,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Teletrasporto's "teletrasporto" as the turn's action: instead of moving, the piece
 * relocates to any EMPTY square at exactly 3 squares in one of the 8 straight directions, jumping
 * over everything in between (interpositions ignored — it's a teleport, not a slide). Nothing is
 * captured on landing. Like any action, it's rejected if it would leave the acting player's own
 * King in check (README §3.2 — leaving `from` can expose the King).
 */
export function applyTeleport(state: GameState, from: Coord, to: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canTeleport(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può teletrasportarsi.' };
  }

  const targets = getTeleportTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(to)) {
    return { ok: false, reason: `Destinazione non valida per il teletrasporto: ${to}.` };
  }

  const nextBoard = movePiece(state.board, from, to);
  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to,
    sigla: piece.sigla,
    isCapture: false,
    isTeleport: true,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Vortice's "attira" as the turn's action: instead of moving, the Vortice drags an
 * enemy at exactly 2 squares in a straight line (never the King) one square closer, onto the
 * empty square in between — no capture, the enemy simply changes square. Like any action, it's
 * rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applyAttract(state: GameState, from: Coord, target: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canAttract(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può attirare.' };
  }

  const targets = getAttractTargets(state.board, from, piece.owner, state.dimensions);
  if (!targets.includes(target)) {
    return { ok: false, reason: `Bersaglio non valido per attirare: ${target}.` };
  }

  // The landing square is the empty square halfway between the Vortice and the enemy — guaranteed
  // valid by getAttractTargets, but re-derived here so applyAttract stays self-contained.
  const { file: fromFile, rank: fromRank } = coordToFileRank(from);
  const { file: targetFile, rank: targetRank } = coordToFileRank(target);
  const landing = fileRankToCoord(
    (fromFile + targetFile) / 2,
    (fromRank + targetRank) / 2,
    state.dimensions,
  );
  if (!landing || getPieceAt(state.board, landing)) {
    return { ok: false, reason: 'La casella di arrivo non è libera.' };
  }

  const nextBoard = movePiece(state.board, target, landing);
  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isAttract: true,
    attractedTo: landing,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Necromante's "rianimazione" as the turn's action: revives a fallen ally of "pedone"
 * category (PE, PG, or FG — the whole category, per the user's clarification, not just PE) from
 * the graveyard onto an adjacent empty square, as an alternative to a normal move. Like any
 * action, it's rejected if it would leave the acting player's own King in check (README §3.2).
 */
export function applyRevive(state: GameState, from: Coord, target: Coord, sigla: string): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canRevive(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può rianimare alleati.' };
  }

  const revivalSquares = getRevivalSquares(state.board, from, piece.owner, state.dimensions);
  if (!revivalSquares.includes(target)) {
    return { ok: false, reason: `Casella non valida per la rianimazione: ${target}.` };
  }

  const graveyard = state.captured[piece.owner];
  const revivableSiglas = getRevivableSiglas(graveyard);
  if (!revivableSiglas.includes(sigla)) {
    return { ok: false, reason: `Nessun pezzo "${sigla}" disponibile nel cimitero.` };
  }

  const indexToRevive = graveyard.findIndex((p) => p.sigla === sigla);
  const nextGraveyard = [...graveyard.slice(0, indexToRevive), ...graveyard.slice(indexToRevive + 1)];
  const nextCaptured: Record<Owner, PieceInstance[]> = { ...state.captured, [piece.owner]: nextGraveyard };

  const nextBoard = setPieceAt(state.board, target, createPieceInstance(sigla, piece.owner));

  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: target,
    sigla: piece.sigla,
    isCapture: false,
    isRevival: true,
    revivedSigla: sigla,
  };

  return finishAction(state, piece, nextBoard, historyEntry, { captured: nextCaptured });
}

/**
 * Plays a Miraggio's "sdoppiamento" as the turn's action: the Miraggio materializes an illusion
 * clone on an adjacent empty square (`cloneSquare`) — it never moves itself — and the player
 * designates which of the two squares holds the REAL Miraggio (`realSquare`, either the original
 * `from` or `cloneSquare`). The two pieces are visually indistinguishable; only removing the real
 * one destroys the Miraggio (the clone dissolves as fallout). A clone can never split again, and a
 * real Miraggio cannot split while its clone is still alive (max 2 on the board — real + clone).
 * Like any action, it's rejected if the Miraggio is frozen by an enemy Stunner (stun blocks every
 * action, mirroring applyScocca/applySwap). Adding a piece can never expose the acting player's
 * own King, so no king-safety filter applies here.
 */
export function applySdoppiamento(state: GameState, from: Coord, cloneSquare: Coord, realSquare: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canSdoppiare(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può sdoppiarsi.' };
  }

  const squares = getSdoppiamentoSquares(state.board, from, piece.owner, getPieceDef, state.dimensions);
  if (!squares.includes(cloneSquare)) {
    return { ok: false, reason: `Casella non valida per lo sdoppiamento: ${cloneSquare}.` };
  }
  if (realSquare !== from && realSquare !== cloneSquare) {
    return { ok: false, reason: 'Il Miraggio vero deve stare su una delle due caselle (quella originale o quella del clone).' };
  }

  const clonePiece = createPieceInstance(piece.sigla, piece.owner);
  // When `realSquare` is the original square, the NEW piece on `cloneSquare` is the clone; when
  // `realSquare` is the clone square, the original piece left behind on `from` is the clone.
  const realStays = realSquare === from;

  let nextBoard = setPieceAt(state.board, cloneSquare, { ...clonePiece, hasMoved: true, mirage: { id: piece.id, isClone: realStays } });
  nextBoard = setPieceAt(nextBoard, from, { ...piece, mirage: { id: piece.id, isClone: !realStays } });

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: cloneSquare,
    sigla: piece.sigla,
    isCapture: false,
    isSdoppiamento: true,
    cloneSquare,
    realSquare,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}

/**
 * Plays a Miraggio's "riunione" as the turn's action — the reverse of sdoppiamento: real and
 * clone reconstitute into a single (unsplit) Miraggio on `mergeSquare`, which may be either half's
 * square, chosen by the player. The real piece survives and the clone dissipates (no punti, and it
 * never enters the graveyard). Only possible while both halves are alive, from either half (they're
 * indistinguishable on the board), and blocked by an enemy Stunner like every other action. Unlike
 * sdoppiamento (which only ever ADDS a piece), merging can expose the acting player's own King —
 * the clone may be blocking a line, or the real may move off its current square — so the merge is
 * rejected when it would leave the King in check (README §3.2).
 */
export function applyRiunione(state: GameState, from: Coord, mergeSquare: Coord): ApplyTurnResult {
  const begun = beginAction(state, from);
  if ('error' in begun) return begun.error;
  const { piece } = begun;

  const pieceDef = getPieceDef(piece.sigla);
  if (!canRiunire(pieceDef)) {
    return { ok: false, reason: 'Questo pezzo non può riunirsi.' };
  }

  const squares = getRiunioneSquares(state.board, from, piece.owner, getPieceDef, state.dimensions);
  if (!squares.includes(mergeSquare)) {
    return { ok: false, reason: `Casella non valida per la riunione: ${mergeSquare}.` };
  }

  const groupId = piece.mirage!.id;
  const real = piece.mirage!.isClone ? findRealOf(state.board, groupId) : { coord: from, piece };
  const clone = piece.mirage!.isClone ? { coord: from, piece } : findCloneOf(state.board, groupId);
  if (!real || !clone) {
    return { ok: false, reason: 'Coppia di Miraggi incompleta: impossibile riunirsi.' };
  }

  // The real reconstitutes at the chosen square with its mirage marker cleared (it's a single,
  // unsplit Miraggio again and may split afresh); both old squares empty out and the clone simply
  // dissipates.
  let nextBoard = removePieceAt(state.board, clone.coord);
  nextBoard = removePieceAt(nextBoard, real.coord);
  nextBoard = setPieceAt(nextBoard, mergeSquare, { ...real.piece, hasMoved: true, mirage: undefined });

  if (isKingInCheck(nextBoard, piece.owner, state.dimensions)) {
    return { ok: false, reason: 'Questa azione lascerebbe il tuo Re sotto scacco.' };
  }

  const historyEntry: HistoryEntry = {
    turnNumber: state.turnNumber,
    owner: piece.owner,
    from,
    to: mergeSquare,
    sigla: piece.sigla,
    isCapture: false,
    isMerge: true,
  };

  return finishAction(state, piece, nextBoard, historyEntry);
}
