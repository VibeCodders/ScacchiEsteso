import { useCallback, useMemo, useState, type ReactNode } from 'react';
import { GameSetupContext, type GameMode, type GameSetupContextValue, type MatchResult, type TeamMap } from './gameSetup';
import { DEFAULT_BOARD_DIMENSIONS, type BoardDimensions, type BoardState, type Owner } from '../game/board';
import { DEFAULT_BOT_DIFFICULTY, type BotDifficulty } from '../game/bot';

const DEFAULT_HUMAN_OWNER: Owner = 'A';
const DEFAULT_MAX_DISTINCT_SPECIAL_TYPES: number | null = null;

export function GameSetupProvider({ children }: { children: ReactNode }) {
  const [mode, setModeState] = useState<GameMode | null>(null);
  const [teamA, setTeamAState] = useState<TeamMap | null>(null);
  const [teamB, setTeamBState] = useState<TeamMap | null>(null);
  const [deployedBoard, setDeployedBoardState] = useState<BoardState | null>(null);
  const [matchResult, setMatchResultState] = useState<MatchResult | null>(null);
  const [humanOwner, setHumanOwnerState] = useState<Owner>(DEFAULT_HUMAN_OWNER);
  const [botDifficulty, setBotDifficultyState] = useState<BotDifficulty>(DEFAULT_BOT_DIFFICULTY);
  const [maxDistinctSpecialTypes, setMaxDistinctSpecialTypesState] = useState<number | null>(DEFAULT_MAX_DISTINCT_SPECIAL_TYPES);
  const [boardDimensions, setBoardDimensionsState] = useState<BoardDimensions>(DEFAULT_BOARD_DIMENSIONS);

  const setMode = useCallback((next: GameMode) => setModeState(next), []);
  const setTeamA = useCallback((team: TeamMap) => setTeamAState(team), []);
  const setTeamB = useCallback((team: TeamMap) => setTeamBState(team), []);
  const setDeployedBoard = useCallback((board: BoardState) => setDeployedBoardState(board), []);
  const setMatchResult = useCallback((result: MatchResult | null) => setMatchResultState(result), []);
  const setHumanOwner = useCallback((owner: Owner) => setHumanOwnerState(owner), []);
  const setBotDifficulty = useCallback((difficulty: BotDifficulty) => setBotDifficultyState(difficulty), []);
  const setMaxDistinctSpecialTypes = useCallback((limit: number | null) => setMaxDistinctSpecialTypesState(limit), []);
  const setBoardDimensions = useCallback((dimensions: BoardDimensions) => setBoardDimensionsState(dimensions), []);
  const reset = useCallback(() => {
    setModeState(null);
    setTeamAState(null);
    setTeamBState(null);
    setDeployedBoardState(null);
    setMatchResultState(null);
    setHumanOwnerState(DEFAULT_HUMAN_OWNER);
    setBotDifficultyState(DEFAULT_BOT_DIFFICULTY);
    setMaxDistinctSpecialTypesState(DEFAULT_MAX_DISTINCT_SPECIAL_TYPES);
    setBoardDimensionsState(DEFAULT_BOARD_DIMENSIONS);
  }, []);

  const value = useMemo<GameSetupContextValue>(
    () => ({
      mode, teamA, teamB, deployedBoard, matchResult, humanOwner, botDifficulty, maxDistinctSpecialTypes, boardDimensions,
      setMode, setTeamA, setTeamB, setDeployedBoard, setMatchResult, setHumanOwner, setBotDifficulty,
      setMaxDistinctSpecialTypes, setBoardDimensions, reset,
    }),
    [mode, teamA, teamB, deployedBoard, matchResult, humanOwner, botDifficulty, maxDistinctSpecialTypes, boardDimensions,
      setMode, setTeamA, setTeamB, setDeployedBoard, setMatchResult, setHumanOwner, setBotDifficulty,
      setMaxDistinctSpecialTypes, setBoardDimensions, reset],
  );

  return <GameSetupContext.Provider value={value}>{children}</GameSetupContext.Provider>;
}
