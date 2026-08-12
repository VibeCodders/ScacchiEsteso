import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import TeamSelectRouteA from './screens/TeamSelectRouteA';
import TeamSelectRouteB from './screens/TeamSelectRouteB';
import PcDifficultyScreen from './screens/PcDifficultyScreen';
import PcTeamChoiceScreen from './screens/PcTeamChoiceScreen';
import DeploymentScreen from './screens/DeploymentScreen';
import GameScreen from './screens/GameScreen';
import GameOverScreen from './screens/GameOverScreen';
import PieceEncyclopediaScreen from './screens/PieceEncyclopediaScreen';
import GameSettingsScreen from './screens/GameSettingsScreen';
import PuntiEstimatorScreen from './screens/PuntiEstimatorScreen';
import SimilarPiecesScreen from './screens/SimilarPiecesScreen';
import LeaveGameGuard from './components/LeaveGameGuard';

function App() {
  return (
    <LeaveGameGuard>
      <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/game-settings" element={<GameSettingsScreen />} />
      <Route path="/team/a" element={<TeamSelectRouteA />} />
      <Route path="/team/pc-difficulty" element={<PcDifficultyScreen />} />
      <Route path="/team/pc-choice" element={<PcTeamChoiceScreen />} />
      <Route path="/team/b" element={<TeamSelectRouteB />} />
      <Route path="/deployment" element={<DeploymentScreen />} />
      <Route path="/game" element={<GameScreen />} />
      <Route path="/game-over" element={<GameOverScreen />} />
      <Route path="/pieces" element={<PieceEncyclopediaScreen />} />
      <Route path="/punti-estimator" element={<PuntiEstimatorScreen />} />
      <Route path="/pezzi-simili" element={<SimilarPiecesScreen />} />
      </Routes>
    </LeaveGameGuard>
  );
}

export default App;
