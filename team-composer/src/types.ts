export interface Piece {
  sigla: string;
  descrizione: string;
  punti: number;
  classico: boolean;
  regole: string;
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