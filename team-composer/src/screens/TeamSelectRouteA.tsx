import { useNavigate } from 'react-router-dom';
import TeamSelectScreen from './TeamSelectScreen';
import { useGameSetup, type TeamMap } from '../context/gameSetup';

function TeamSelectRouteA() {
  const navigate = useNavigate();
  const { mode, humanOwner, teamA, setTeamA, maxDistinctSpecialTypes, boardDimensions } = useGameSetup();
  const isHuman = mode !== 'pvc' || humanOwner === 'A';

  const handleComplete = (team: TeamMap) => {
    setTeamA(team);
    if (mode !== 'pvc') {
      navigate('/team/b');
    } else if (humanOwner === 'A') {
      navigate('/team/pc-choice'); // the bot composes owner B next
    } else {
      navigate('/team/b'); // the bot (owner A) is done — the human composes owner B next
    }
  };

  return (
    <TeamSelectScreen
      title={isHuman ? 'Composizione Team — Giocatore 1' : 'Composizione Team — PC (manuale)'}
      initialTeam={teamA ?? undefined}
      completeButtonLabel={isHuman ? '✓ Conferma Team Giocatore 1' : '✓ Conferma Team del PC'}
      onComplete={handleComplete}
      maxDistinctSpecialTypes={maxDistinctSpecialTypes}
      boardDimensions={boardDimensions}
    />
  );
}

export default TeamSelectRouteA;
