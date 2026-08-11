import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { rules, scaleRulesForBoardSize } from '../data/pieces';
import { getPresetTeams, buildPresetTeam, randomFillTeam, isPresetValid, type PresetTeamId } from '../data/presetTeams';
import { BOT_DIFFICULTY_MAX, BOT_DIFFICULTY_MIN, difficultyToDepth, formatMovesAhead } from '../game/bot';
import Button from '../components/ui/Button';
import PageShell from '../components/ui/PageShell';
import Panel from '../components/ui/Panel';

function PcTeamChoiceScreen() {
  const navigate = useNavigate();
  const {
    humanOwner, teamA, teamB, setTeamA, setTeamB, botDifficulty, setBotDifficulty,
    boardDimensions, maxDistinctSpecialTypes,
  } = useGameSetup();

  const effectiveRules = useMemo(() => scaleRulesForBoardSize(rules, boardDimensions), [boardDimensions]);

  // The PC always composes whichever owner the human isn't playing.
  const targetOwner = humanOwner === 'A' ? 'B' : 'A';
  const setTargetTeam = targetOwner === 'A' ? setTeamA : setTeamB;
  const humanTeam = humanOwner === 'A' ? teamA : teamB;
  const targetTeamRoute = targetOwner === 'A' ? '/team/a' : '/team/b';

  const goToNextStep = () => {
    // If the PC is composing first (it takes owner A because the human chose to play B),
    // the human still needs to compose their own team next.
    navigate(targetOwner === 'A' ? '/team/b' : '/deployment');
  };

  const choosePreset = (id: PresetTeamId) => {
    setTargetTeam(buildPresetTeam(id));
    goToNextStep();
  };

  const chooseMirror = () => {
    if (humanTeam) setTargetTeam(new Map(humanTeam));
    goToNextStep();
  };

  const chooseRandom = () => {
    setTargetTeam(randomFillTeam(effectiveRules, maxDistinctSpecialTypes));
    goToNextStep();
  };

  const chooseManual = () => {
    navigate(targetTeamRoute);
  };

  return (
    <PageShell title="🤖 Team del PC" subtitle="Come vuoi comporre l'esercito avversario?" layout="center">
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
        </div>
      </Panel>

      <Panel title="🎯 Composizione" className="w-full max-w-[640px]">
        <div className="flex flex-col gap-2">
          <Button variant="primary" onClick={chooseManual}>Manuale — lo compongo io</Button>
          {getPresetTeams().map((preset) => {
            const valid = isPresetValid(preset.id, effectiveRules, maxDistinctSpecialTypes);
            return (
              <Button
                key={preset.id}
                variant="auto"
                onClick={() => choosePreset(preset.id)}
                disabled={!valid}
                title={valid ? undefined : 'Non valido con le impostazioni attuali della partita (budget o limite di tipi speciali)'}
              >
                Preset: {preset.label} — {preset.description}
                {!valid && ' (non valido con queste impostazioni)'}
              </Button>
            );
          })}
          <Button variant="improve" onClick={chooseMirror} disabled={!humanTeam}>
            Specchio — copia il mio team
          </Button>
          <Button variant="secondary" onClick={chooseRandom}>
            Casuale — genera entro il budget
          </Button>
        </div>
      </Panel>
    </PageShell>
  );
}

export default PcTeamChoiceScreen;
