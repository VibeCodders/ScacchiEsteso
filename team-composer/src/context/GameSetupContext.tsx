import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GameSetupContext, type GameMode, type GameSetupContextValue, type MatchResult, type TeamMap } from './gameSetup';
import type { BoardState } from '../game/board';

export function GameSetupProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode | null>(null);
  const [teamA, setTeamAState] = useState<TeamMap | null>(null);
  const [teamB, setTeamBState] = useState<TeamMap | null>(null);
  const [deployedBoard, setDeployedBoardState] = useState<BoardState | null>(null);
  const [matchResult, setMatchResultState] = useState<MatchResult | null>(null);

  const setMode = useCallback((next: GameMode) => setModeState(next), []);
  const setTeamA = useCallback((team: TeamMap) => setTeamAState(team), []);
  const setTeamB = useCallback((team: TeamMap) => setTeamBState(team), []);
  const setDeployedBoard = useCallback((board: BoardState) => setDeployedBoardState(board), []);
  const setMatchResult = useCallback((result: MatchResult) => setMatchResultState(result), []);
  const reset = useCallback(() => {
    setModeState(null);
    setTeamAState(null);
    setTeamBState(null);
    setDeployedBoardState(null);
    setMatchResultState(null);
  }, []);

  const value = useMemo<GameSetupContextValue>(
    () => ({ mode, teamA, teamB, deployedBoard, matchResult, setMode, setTeamA, setTeamB, setDeployedBoard, setMatchResult, reset }),
    [mode, teamA, teamB, deployedBoard, matchResult, setMode, setTeamA, setTeamB, setDeployedBoard, setMatchResult, reset],
  );

  return <GameSetupContext.Provider value={value}>{children}</GameSetupContext.Provider>;
}
