import { useNavigate } from 'react-router-dom';
import { useGameSetup } from '../context/gameSetup';
import { getPresetTeams, buildPresetTeam, randomFillTeam, type PresetTeamId } from '../data/presetTeams';
import '../App.css';

function PcTeamChoiceScreen() {
  const navigate = useNavigate();
  const { teamA, setTeamB } = useGameSetup();

  const choosePreset = (id: PresetTeamId) => {
    setTeamB(buildPresetTeam(id));
    navigate('/deployment');
  };

  const chooseMirror = () => {
    if (teamA) setTeamB(new Map(teamA));
    navigate('/deployment');
  };

  const chooseRandom = () => {
    setTeamB(randomFillTeam());
    navigate('/deployment');
  };

  const chooseManual = () => {
    navigate('/team/b');
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
          <h2>🎯 Opzioni</h2>
          <div className="actions" style={{ flexDirection: 'column' }}>
            <button className="btn-save" onClick={chooseManual}>Manuale — lo compongo io</button>
            {getPresetTeams().map((preset) => (
              <button key={preset.id} className="btn-auto" onClick={() => choosePreset(preset.id)}>
                Preset: {preset.label} — {preset.description}
              </button>
            ))}
            <button className="btn-improve" onClick={chooseMirror} disabled={!teamA}>
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
