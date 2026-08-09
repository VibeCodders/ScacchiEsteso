import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { rules, scaleRulesForBoardSize } from '../data/pieces';
import { getPresetTeams, buildPresetTeam, randomFillTeam, isPresetValid, type PresetTeamId } from '../data/presetTeams';
import { DIFFICULTY_DEPTH, type BotDifficulty } from '../game/bot';
import '../App.css';

const DIFFICULTY_LABELS: Record<BotDifficulty, string> = { easy: 'Facile', medium: 'Medio', hard: 'Difficile' };

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
    <div className="app">
      <header className="header">
        <div>
          <h1>🤖 Team del PC</h1>
          <p className="subtitle">Come vuoi comporre l'esercito avversario?</p>
        </div>
      </header>
      <div className="main" style={{ gridTemplateColumns: '1fr', justifyItems: 'center', paddingTop: '2rem' }}>
        <div className="panel" style={{ maxWidth: 640 }}>
          <h2>🧠 Difficoltà</h2>
          <div className="actions">
            {(Object.keys(DIFFICULTY_LABELS) as BotDifficulty[]).map((difficulty) => (
              <button
                key={difficulty}
                className={botDifficulty === difficulty ? 'btn-save' : 'btn-auto'}
                onClick={() => setBotDifficulty(difficulty)}
              >
                {DIFFICULTY_LABELS[difficulty]} (profondità {DIFFICULTY_DEPTH[difficulty]})
              </button>
            ))}
          </div>

          <h2>🎯 Composizione</h2>
          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className="btn-save" onClick={chooseManual}>Manuale — lo compongo io</button>
            {getPresetTeams().map((preset) => {
              const valid = isPresetValid(preset.id, effectiveRules, maxDistinctSpecialTypes);
              return (
                <button
                  key={preset.id}
                  className="btn-auto"
                  onClick={() => choosePreset(preset.id)}
                  disabled={!valid}
                  title={valid ? undefined : 'Non valido con le impostazioni attuali della partita (budget o limite di tipi speciali)'}
                >
                  Preset: {preset.label} — {preset.description}
                  {!valid && ' (non valido con queste impostazioni)'}
                </button>
              );
            })}
            <button className="btn-improve" onClick={chooseMirror} disabled={!humanTeam}>
              Specchio — copia il mio team
            </button>
            <button className="btn-reset" onClick={chooseRandom}>
              Casuale — genera entro il budget
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default PcTeamChoiceScreen;
