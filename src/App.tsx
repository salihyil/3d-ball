import { Route, Routes } from 'react-router-dom';
import Game from './pages/Game';
import Home from './pages/Home';
import Lobby from './pages/Lobby';

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/lobby/:roomId" element={<Lobby />} />
      <Route path="/game/:roomId" element={<Game />} />
    </Routes>
  );
}
