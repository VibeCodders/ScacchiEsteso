import { createContext, useContext } from 'react';
import { KING_SIGLA } from '../data/pieces';
import type { BoardState, Owner } from '../game/board';
import type { GameStatus } from '../game/turnManager';

export type GameMode = 'pvp' | 'pvc';

export type TeamMap = Map<string, number>;

export function emptyTeam(): TeamMap {
  return new Map([[KING_SIGLA, 1]]);
}

export interface MatchResult {
  status: Extract<GameStatus, 'checkmate' | 'stalemate' | 'anti_stalemate'>;
  winner?: Owner;
}

export interface GameSetupState {
  mode: GameMode | null;
  teamA: TeamMap | null;
  teamB: TeamMap | null;
  deployedBoard: BoardState | null;
  matchResult: MatchResult | null;
}

export interface GameSetupContextValue extends GameSetupState {
  setMode: (mode: GameMode) => void;
  setTeamA: (team: TeamMap) => void;
  setTeamB: (team: TeamMap) => void;
  setDeployedBoard: (board: BoardState) => void;
  setMatchResult: (result: MatchResult) => void;
  reset: () => void;
}

export const GameSetupContext = createContext<GameSetupContextValue | null>(null);

export function useGameSetup(): GameSetupContextValue {
  const ctx = useContext(GameSetupContext);
  if (!ctx) throw new Error('useGameSetup must be used within a GameSetupProvider');
  return ctx;
}
