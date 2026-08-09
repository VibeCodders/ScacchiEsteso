import { Routes, Route } from 'react-router-dom';
import Home from './screens/Home';
import TeamSelectRouteA from './screens/TeamSelectRouteA';
import TeamSelectRouteB from './screens/TeamSelectRouteB';
import PcTeamChoiceScreen from './screens/PcTeamChoiceScreen';
import DeploymentScreen from './screens/DeploymentScreen';
import GameScreen from './screens/GameScreen';
import GameOverScreen from './screens/GameOverScreen';
import PieceEncyclopediaScreen from './screens/PieceEncyclopediaScreen';

function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/team/a" element={<TeamSelectRouteA />} />
      <Route path="/team/pc-choice" element={<PcTeamChoiceScreen />} />
      <Route path="/team/b" element={<TeamSelectRouteB />} />
      <Route path="/deployment" element={<DeploymentScreen />} />
      <Route path="/game" element={<GameScreen />} />
      <Route path="/game-over" element={<GameOverScreen />} />
      <Route path="/pieces" element={<PieceEncyclopediaScreen />} />
    </Routes>
  );
}

export default App;
