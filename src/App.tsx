import { Suspense, lazy } from 'react';
import { Route, Routes } from 'react-router-dom';
import { useAuth } from './hooks/useAuth';
import { useSocketManager } from './hooks/useNetwork';
import { usePlayerProfile } from './hooks/usePlayerProfile';

const Home = lazy(() => import('./pages/Home'));
const Lobby = lazy(() => import('./pages/Lobby'));
const Game = lazy(() => import('./pages/Game'));

function SocketSync() {
  const { session, loading: authLoading } = useAuth();
  const { profile, accessories, loading: profileLoading } = usePlayerProfile();
  useSocketManager(session, profile, accessories, authLoading, profileLoading);
  return null;
}

export default function App() {
  return (
    <>
      <SocketSync />
      <Suspense
        fallback={
          <div className="bg-animated">
            <div className="page-center">Loading...</div>
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/lobby/:roomId" element={<Lobby />} />
          <Route path="/game/:roomId" element={<Game />} />
        </Routes>
      </Suspense>
    </>
  );
}
