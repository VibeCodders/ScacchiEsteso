import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GameSetupContext, type GameMode, type GameSetupContextValue, type TeamMap } from './gameSetup';
import type { BoardState } from '../game/board';

export function GameSetupProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode | null>(null);
  const [teamA, setTeamAState] = useState<TeamMap | null>(null);
  const [teamB, setTeamBState] = useState<TeamMap | null>(null);
  const [deployedBoard, setDeployedBoardState] = useState<BoardState | null>(null);

  const setMode = useCallback((next: GameMode) => setModeState(next), []);
  const setTeamA = useCallback((team: TeamMap) => setTeamAState(team), []);
  const setTeamB = useCallback((team: TeamMap) => setTeamBState(team), []);
  const setDeployedBoard = useCallback((board: BoardState) => setDeployedBoardState(board), []);
  const reset = useCallback(() => {
    setModeState(null);
    setTeamAState(null);
    setTeamBState(null);
    setDeployedBoardState(null);
  }, []);

  const value = useMemo<GameSetupContextValue>(
    () => ({ mode, teamA, teamB, deployedBoard, setMode, setTeamA, setTeamB, setDeployedBoard, reset }),
    [mode, teamA, teamB, deployedBoard, setMode, setTeamA, setTeamB, setDeployedBoard, reset],
  );

  return <GameSetupContext.Provider value={value}>{children}</GameSetupContext.Provider>;
}
