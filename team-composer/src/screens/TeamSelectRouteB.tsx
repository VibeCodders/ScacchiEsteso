import { useNavigate } from 'react-router-dom';
import TeamSelectScreen from './TeamSelectScreen';
import { useGameSetup, type TeamMap } from '../context/gameSetup';

function TeamSelectRouteB() {
  const navigate = useNavigate();
  const { mode, teamB, setTeamB } = useGameSetup();

  const handleComplete = (team: TeamMap) => {
    setTeamB(team);
    navigate('/deployment');
  };

  return (
    <TeamSelectScreen
      title={mode === 'pvc' ? 'Composizione Team — PC (manuale)' : 'Composizione Team — Giocatore 2'}
      initialTeam={teamB ?? undefined}
      completeButtonLabel={mode === 'pvc' ? '✓ Conferma Team del PC' : '✓ Conferma Team Giocatore 2'}
      onComplete={handleComplete}
    />
  );
}

export default TeamSelectRouteB;
