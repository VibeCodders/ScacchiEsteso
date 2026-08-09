import { useNavigate } from 'react-router-dom';
import TeamSelectScreen from './TeamSelectScreen';
import { useGameSetup, type TeamMap } from '../context/gameSetup';

function TeamSelectRouteB() {
  const navigate = useNavigate();
  const { mode, humanOwner, teamB, setTeamB, maxDistinctSpecialTypes, boardDimensions } = useGameSetup();
  const isHuman = mode !== 'pvc' || humanOwner === 'B';

  const handleComplete = (team: TeamMap) => {
    setTeamB(team);
    navigate('/deployment');
  };

  return (
    <TeamSelectScreen
      title={isHuman ? (mode === 'pvc' ? 'Composizione Team — Giocatore 1' : 'Composizione Team — Giocatore 2') : 'Composizione Team — PC (manuale)'}
      initialTeam={teamB ?? undefined}
      completeButtonLabel={isHuman ? '✓ Conferma Team' : '✓ Conferma Team del PC'}
      onComplete={handleComplete}
      maxDistinctSpecialTypes={maxDistinctSpecialTypes}
      boardDimensions={boardDimensions}
    />
  );
}

export default TeamSelectRouteB;
