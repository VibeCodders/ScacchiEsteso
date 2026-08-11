import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import type { Owner } from '../game/board';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';

function Home() {
  const navigate = useNavigate();
  const { setMode, setHumanOwner, reset } = useGameSetup();

  const startPvp = () => {
    reset();
    setMode('pvp');
    navigate('/game-settings');
  };

  const startPvc = (owner: Owner) => {
    reset();
    setMode('pvc');
    setHumanOwner(owner);
    navigate('/game-settings');
  };

  return (
    <PageShell title="♟️ Scacchi Esteso" subtitle="Scegli come giocare" layout="center">
      <Panel title="🎮 Modalità" className="w-full max-w-[480px]">
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={startPvp}>
            PvP locale (stesso dispositivo)
          </Button>
          <Button variant="auto" onClick={() => startPvc('A')}>
            PvC — gioco come Giocatore A (muovo per primo)
          </Button>
          <Button variant="auto" onClick={() => startPvc('B')}>
            PvC — gioco come Giocatore B (muovo per secondo)
          </Button>
        </div>
      </Panel>
      <Panel title="📖 Impara" className="w-full max-w-[480px]">
        <div className="flex flex-col gap-2">
          <Button variant="improve" onClick={() => navigate('/pieces')}>
            Enciclopedia dei pezzi
          </Button>
          <Button variant="improve" onClick={() => navigate('/punti-estimator')}>
            📊 Stima punti pezzi
          </Button>
          <Button variant="improve" onClick={() => navigate('/pezzi-simili')}>
            🧬 Pezzi simili
          </Button>
        </div>
      </Panel>
    </PageShell>
  );
}

export default Home;
