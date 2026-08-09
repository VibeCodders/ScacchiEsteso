import { createContext, useContext } from 'react';
import { KING_SIGLA } from '../data/pieces';
import type { BoardState, Owner } from '../game/board';
import type { GameStatus } from '../game/turnManager';
import type { BotDifficulty } from '../game/bot';

export type GameMode = 'pvp' | 'pvc';

/** Human-readable label for `owner`, aware of PvC's human-vs-bot assignment (`humanOwner`). */
export function playerLabel(owner: Owner, mode: GameMode | null, humanOwner: Owner): string {
  if (mode === 'pvc') return owner === humanOwner ? 'Giocatore 1' : 'PC';
  return owner === 'A' ? 'Giocatore 1' : 'Giocatore 2';
}

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
  /** In PvC, which owner the human plays (the bot takes the opposite owner). Unused in PvP. */
  humanOwner: Owner;
  botDifficulty: BotDifficulty;
}

export interface GameSetupContextValue extends GameSetupState {
  setMode: (mode: GameMode) => void;
  setTeamA: (team: TeamMap) => void;
  setTeamB: (team: TeamMap) => void;
  setDeployedBoard: (board: BoardState) => void;
  setMatchResult: (result: MatchResult) => void;
  setHumanOwner: (owner: Owner) => void;
  setBotDifficulty: (difficulty: BotDifficulty) => void;
  reset: () => void;
}

export const GameSetupContext = createContext<GameSetupContextValue | null>(null);

export function useGameSetup(): GameSetupContextValue {
  const ctx = useContext(GameSetupContext);
  if (!ctx) throw new Error('useGameSetup must be used within a GameSetupProvider');
  return ctx;
}
