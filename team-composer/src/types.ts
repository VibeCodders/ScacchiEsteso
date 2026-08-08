export type Direction = 'n' | 's' | 'e' | 'w' | 'ne' | 'nw' | 'se' | 'sw';

export interface Move {
  directions: Direction[];
  maxSteps: number;
  capture: boolean;
  jump?: boolean;
  primaMossaDoppia?: boolean;
  note?: string;
}

export interface Piece {
  sigla: string;
  descrizione: string;
  punti: number;
  classico: boolean;
  regole: string;
  moves: Move[];
  saltaInterposizioni?: boolean;
  catturaSoloInMischia?: boolean;
  catturaADistanza?: boolean;
  secondoMovimentoPostCattura?: boolean;
  dannoAdArea?: boolean;
  rianimaPedoni?: boolean;
  silenzioAttacchiADistanza?: boolean;
  armatura?: boolean;
  scambiaPosizioneConAlleato?: boolean;
  scocca?: boolean;
  egida?: boolean;
  noteCondizionali?: string;
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

export interface ValidationResult {
  budget: ConstraintResult;
  totalPieces: ConstraintResult;
  maxFive: ConstraintResult;
  maxPawns: ConstraintResult;
  hasKing: ConstraintResult;
  kingCount: ConstraintResult;
  overall: boolean;
}
