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
  /** True only for Swapper (SW): in addition to a King-style move, may swap two allied pieces
   *  that are each within its own 8 adjacent squares (one of the two may be the Swapper's own
   *  square). Drives getSwapperCandidateSquares / applySwapperSwap. */
  scambioTraDueAlleati?: boolean;
  /** True only for Stunner (ST): every enemy piece (except the King) on one of its 8 adjacent
   *  squares is frozen — no legal moves/special actions except a move that captures the Stunner
   *  itself. Checked by moveEngine.ts's generatePseudoLegalMoves and by every alternative-action
   *  module (scocca.ts, swap.ts, necromancy.ts, swapper.ts). */
  stunAura?: boolean;
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
