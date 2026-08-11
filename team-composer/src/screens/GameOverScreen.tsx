import { useNavigate } from 'react-router-dom';
import { playerLabel, useGameSetup } from '../context/gameSetup';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';

function GameOverScreen() {
  const navigate = useNavigate();
  const { mode, humanOwner, matchResult, reset } = useGameSetup();
  const ownerLabel = (owner: 'A' | 'B') => playerLabel(owner, mode, humanOwner);

  const backToHome = () => {
    reset();
    navigate('/');
  };

  const subtitle = matchResult ? (
    <>
      {matchResult.status === 'checkmate' && `Scacco matto — vince ${ownerLabel(matchResult.winner!)}`}
      {matchResult.status === 'stalemate' && 'Stallo — partita patta'}
      {matchResult.status === 'anti_stalemate' && (
        matchResult.winner
          ? `Limite di 20 turni senza progressi — vince ${ownerLabel(matchResult.winner)} per punteggio`
          : 'Limite di 20 turni senza progressi — partita patta per punteggio pari'
      )}
    </>
  ) : (
    'Nessun risultato disponibile.'
  );

  return (
    <PageShell title="🏁 Fine Partita" subtitle={subtitle}>
      <div className="flex justify-center pt-4">
        <Button variant="primary" onClick={backToHome}>
          Torna alla Home
        </Button>
      </div>
    </PageShell>
  );
}

export default GameOverScreen;
