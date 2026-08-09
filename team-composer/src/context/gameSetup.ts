import { createContext, useContext } from 'react';
import { KING_SIGLA } from '../data/pieces';

export type GameMode = 'pvp' | 'pvc';

export type TeamMap = Map<string, number>;

export function emptyTeam(): TeamMap {
  return new Map([[KING_SIGLA, 1]]);
}

export interface GameSetupState {
  mode: GameMode | null;
  teamA: TeamMap | null;
  teamB: TeamMap | null;
}

export interface GameSetupContextValue extends GameSetupState {
  setMode: (mode: GameMode) => void;
  setTeamA: (team: TeamMap) => void;
  setTeamB: (team: TeamMap) => void;
  reset: () => void;
}

export const GameSetupContext = createContext<GameSetupContextValue | null>(null);

export function useGameSetup(): GameSetupContextValue {
  const ctx = useContext(GameSetupContext);
  if (!ctx) throw new Error('useGameSetup must be used within a GameSetupProvider');
  return ctx;
}
