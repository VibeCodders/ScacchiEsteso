export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export type MovementType = 'step' | 'slide' | 'leap' | 'speciale';
export type CaptureMode = 'melee' | 'leap' | 'ranged' | 'none' | 'area';
export type ColorRestriction = 'chiare' | 'scure' | 'nessuna' | 'forward' | 'backward';
export type LeapPattern = 'L' | 'grasshopper' | 'custom';
export type ActionModalita = 'alternativa' | 'aggiuntiva' | 'passiva' | 'sul_cattura';
export type Categoria = 'base' | 'pedone';

export interface Move {
  directions: Direction[];
  minSteps: number;
  maxSteps: number;
  capture: boolean;
  captureMode: CaptureMode;
  movementType: MovementType;
  jump?: boolean;
  colorRestriction?: ColorRestriction;
  leapPattern?: LeapPattern;
  jumpOver?: boolean;
  jumpOverCount?: number;
  landBeyond?: boolean;
  multiJump?: boolean;
  primaMossaDoppia?: boolean;
  note?: string;
}

export interface AlternativeAction {
  type: string;
  modalita: ActionModalita;
  params: Record<string, unknown>;
}

export interface Piece {
  sigla: string;
  descrizione: string;
  punti: number;
  categoria: Categoria;
  classico: boolean;
  regole: string;
  moves: Move[];
  movimentoTipo?: MovementType;
  /** Per-piece cap on how many copies of this exact sigla a single team may field, overriding the
   *  rules' default/category limits (e.g. Miraggio's `maxIdentical: 1` — its clone brings the
   *  on-board count to 2, so a player can never own two of them). */
  maxIdentical?: number;
  /** True only for Miraggio (MG): in addition to its King-style move, it may split into a real
   *  piece plus an illusion clone (see game/mirage.ts). Drives the sdoppiamento action UI and the
   *  capture-resolution logic (killing the real one dissolves the clone; killing the clone is a
   *  wasted capture — it awards no points). */
  sdoppiamento?: boolean;
  /** True only for Miraggio (MG): while its clone is alive, it may instead reconstitute real and
   *  clone into a single piece (see game/mirage.ts's getRiunioneSquares / turnManager's
   *  applyRiunione) — the reverse of sdoppiamento. */
  riunione?: boolean;
  promotable?: boolean;
  promotionTypes?: string[];
  promotionRank?: number;
  resistance: number;
  immunityTypes: string[];
  alternativeActions: AlternativeAction[];
  saltaInterposizioni?: boolean;
  catturaSoloInMischia?: boolean;
  catturaADistanza?: boolean;
  secondoMovimentoPostCattura?: boolean;
  dannoAdArea?: boolean;
  rianimaPedoni?: boolean;
  /** True for the Sciacallo (SC): its "sciacallaggio" alternative action revives a fallen piece
   *  from the OPPONENT's graveyard (value ≤ 20, never the King) as an allied piece on an empty
   *  adjacent square. Drives the loot resolution in turnManager, the bot and GameScreen's picker.
   *  Mirrors rianimaPedoni (Necromante) but from the enemy's losses instead of your own. */
  sciacallaggio?: boolean;
  silenzioAttacchiADistanza?: boolean;
  armatura?: boolean;
  armaturaMaxCosto?: number;
  scambiaPosizioneConAlleato?: boolean;
  scocca?: boolean;
  egida?: boolean;
  noteCondizionali?: string;
  /** True for pieces obtainable only via in-game promotion (e.g. Damone) — excluded from team-building rosters. */
  obtainableOnlyViaPromotion?: boolean;
  /** True only for Coniglio (CN): checkers-style jump-chain where only the LAST jumped-over
   *  enemy is actually captured when the player stops; the King-step fallback move is only
   *  offered when no jump is currently available. Drives turnManager's pendingRabbitChain flow. */
  catenaSaltiConCatturaFinale?: boolean;
  /** True only for Rimbalzatore (RB): diagonal slide that may reflect off the board edge or an
   *  obstacle at most once. Its single Move entry uses movementType "speciale" and is dispatched
   *  to generateBounceSlideMoves instead of generateStepOrSlideMoves. */
  rimbalzoUnico?: boolean;
  /** True only for Grifone (GR): bent slide — exactly one diagonal step (to an EMPTY square, no
   *  capture on the first leg), then an unlimited orthogonal slide outward along the file or rank
   *  that the diagonal step moved away from. Dispatched to generateBentSlideMoves. */
  gryphon?: boolean;
  /** True only for Manticora (MA): the mirror image of the Grifone — exactly one orthogonal step
   *  (to an EMPTY square), then an unlimited diagonal slide outward. Shares generateBentSlideMoves
   *  with the Grifone, parameterized by which leg comes first. */
  manticora?: boolean;
  /** True only for Swapper (SW): in addition to a King-style move, may swap two allied pieces
   *  that are each within its own 8 adjacent squares (one of the two may be the Swapper's own
   *  square). Drives getSwapperCandidateSquares / applySwapperSwap. */
  scambioTraDueAlleati?: boolean;
  /** True only for Stunner (ST): every enemy piece (except the King) on one of its 8 adjacent
   *  squares is frozen — no legal moves/special actions except a move that captures the Stunner
   *  itself. Checked by moveEngine.ts's generatePseudoLegalMoves and by every alternative-action
   *  module (scocca.ts, swap.ts, necromancy.ts, swapper.ts). */
  stunAura?: boolean;
  /** True only for Repulsore (RP): in addition to a King-style move, may push an adjacent enemy
   *  (never the King) one square directly away from itself, onto an empty on-board square — an
   *  alternative action that captures nothing. Drives getRepulseTargets / applyRepulse. */
  respingeNemici?: boolean;
  /** True only for Teletrasporto (TT): in addition to a King-style move, may teleport — instead of
   *  moving, it relocates to any EMPTY square at exactly 3 squares in one of the 8 directions,
   *  jumping over everything in between (interpositions ignored), capturing nothing on landing.
   *  Drives getTeleportTargets / applyTeleport. */
  teletrasporto?: boolean;
  /** True only for Vortice (VZ): in addition to a King-style move, may "attira" — instead of
   *  moving, it pulls an enemy at exactly 2 squares (straight line, never the King) onto the
   *  empty square in between, dragging it 1 square closer without capturing it.
   *  Drives getAttractTargets / applyAttract. */
  attiraNemici?: boolean;
  /** True only for Bomba (BO): when this piece is captured (by any capture — melee, leap, ranged
   *  or chain), it explodes and destroys the capturer too — unless the capturer is a King, which
   *  is always immune to the blast. Collateral area-damage victims never trigger it.
   *  Enforced by the capture resolution in turnManager. */
  esplodeSeCatturato?: boolean;
  /** True only for Basilisco (BS): its petrifying gaze freezes every enemy piece (never the King,
   *  which is always immune) standing on the 3 squares directly in front of it (owner-relative
   *  forward, toward the opponent) — the gaze pierces through pieces in between. A frozen piece
   *  has no moves and no special actions, except the one move that would capture the Basilisco
   *  itself (mirroring the Stunner's stunAura, but directional). Checked by stun.ts's
   *  isInEnemyBasiliskGaze via the shared freeze path (moveEngine + every action module). */
  congelaDirezione?: boolean;
  /** True only for Brigante (BR): in addition to a King-style move, may "sostituirsi" — instead
   *  of moving, it swaps squares with an ADJACENT ENEMY (never the King), capturing nothing: a
   *  pure exchange of position. Drives getSostituzioneTargets / applySostituzione. */
  scambioConNemico?: boolean;
  /** True only for Lampo (LP): "fulmine" — after a successful leap capture (its dabbaba jump), it
   *  may immediately make one more NON-capturing 2-square jump, mirroring the Berserker's Furia
   *  bellica but for leaps (the Berserker's extra move only triggers on melee captures). Drives
   *  turnManager's triggersExtraMove via the pendingExtraMove flow. */
  fulmine?: boolean;
  /** True only for Vampiro Lunare (VL): "Sete di Sangue" — instead of eliminating the enemy it
   *  captures, it converts it into an allied Ghoul (GH, priced by the point estimator like any
   *  other piece) materialized on a free square adjacent to the captured piece. The converted
   *  piece never reaches the graveyard; the VL's capture still counts as progress. Drives the
   *  capture resolution in turnManager and the placement-choice flow in GameScreen. */
  vampirismo?: boolean;
  /** True only for pieces obtainable only in-game via the Vampiro Lunare's conversion (Ghoul) —
   *  excluded from team-building rosters, like obtainableOnlyViaPromotion pieces. */
  obtainableOnlyViaConversion?: boolean;
}

export interface MirageMarker {
  /** Shared id linking the real piece to its clone — the clone dissolves when the real is removed. */
  id: string;
  /** false on the real Miraggio, true on its illusion clone. */
  isClone: boolean;
}

export interface TeamMember {
  piece: Piece;
  count: number;
}

export interface ConstraintResult {
  valid: boolean;
  message: string;
  level: 'error' | 'warning' | 'success';
}

export interface BudgetResult {
  spent: number;
  remaining: number;
  exact: boolean;
}

export interface Rules {
  budget: number;
  maxPiecesTotal: number;
  kingSigla: string;
  maxIdenticalDefault: number;
  maxIdenticalByCategory: Record<string, number>;
  maxCountByCategory: Record<string, number>;
}

export interface ValidationResult {
  budget: ConstraintResult;
  totalPieces: ConstraintResult;
  maxFive: ConstraintResult;
  maxPawns: ConstraintResult;
  hasKing: ConstraintResult;
  kingCount: ConstraintResult;
  specialTypesLimit: ConstraintResult;
  overall: boolean;
}
