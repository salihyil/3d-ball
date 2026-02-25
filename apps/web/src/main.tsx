import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.tsx';
import { AuthProvider } from './context/AuthContext';
import { PlayerProfileProvider } from './context/PlayerProfileContext';
import './i18n/config';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <PlayerProfileProvider>
          <App />
        </PlayerProfileProvider>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
