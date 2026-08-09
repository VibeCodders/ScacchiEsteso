import { useNavigate } from 'react-router-dom';
import TeamSelectScreen from './TeamSelectScreen';
import { useGameSetup, type TeamMap } from '../context/gameSetup';

function TeamSelectRouteA() {
  const navigate = useNavigate();
  const { mode, teamA, setTeamA } = useGameSetup();

  const handleComplete = (team: TeamMap) => {
    setTeamA(team);
    if (mode === 'pvc') {
      navigate('/team/pc-choice');
    } else {
      navigate('/team/b');
    }
  };

  return (
    <TeamSelectScreen
      title="Composizione Team — Giocatore 1"
      initialTeam={teamA ?? undefined}
      completeButtonLabel="✓ Conferma Team Giocatore 1"
      onComplete={handleComplete}
    />
  );
}

export default TeamSelectRouteA;
