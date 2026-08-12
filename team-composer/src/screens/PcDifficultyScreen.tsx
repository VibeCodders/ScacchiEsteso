import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { BOT_DIFFICULTY_MAX, BOT_DIFFICULTY_MIN, difficultyToDepth, formatMovesAhead } from '../game/bot';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';

/** Passo 1 della composizione del team del PC: si sceglie la difficoltà del bot; il passo 2
 *  (come comporre l'esercito avversario) sta su /team/pc-choice. */
function PcDifficultyScreen() {
  const navigate = useNavigate();
  const { botDifficulty, setBotDifficulty } = useGameSetup();

  return (
    <PageShell title="🧠 Difficoltà del PC" subtitle="Quanto deve essere forte il bot in questa partita?" layout="center">
      <Panel title="🧠 Difficoltà" className="w-full max-w-[640px]">
        <div className="flex flex-col gap-2">
          <label htmlFor="bot-difficulty" className="text-sm text-slate-600 dark:text-slate-400">
            Livello di difficoltà: {botDifficulty} (da {BOT_DIFFICULTY_MIN} a {BOT_DIFFICULTY_MAX})
          </label>
          <input
            id="bot-difficulty"
            type="range"
            min={BOT_DIFFICULTY_MIN}
            max={BOT_DIFFICULTY_MAX}
            step={1}
            value={botDifficulty}
            onChange={(e) => setBotDifficulty(Number(e.target.value))}
            aria-label="Difficoltà del bot"
            className="w-full accent-blue-500"
          />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            {botDifficulty < 0
              ? `🫠 Il PC è stupido di proposito: gioca le mosse peggiori per sé (${formatMovesAhead(botDifficulty)}, ricerca ${difficultyToDepth(botDifficulty)} mezze mosse anti).`
              : `Il PC vede ${formatMovesAhead(botDifficulty)} avanti (profondità di ricerca ${difficultyToDepth(botDifficulty)} mezze mosse).`}
          </p>
          <Button variant="primary" className="mt-2 self-center" onClick={() => navigate('/team/pc-choice')}>
            Continua → 🎯
          </Button>
        </div>
      </Panel>
    </PageShell>
  );
}

export default PcDifficultyScreen;
