import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SteamProvider } from './context/SteamContext';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopNav } from './components/TopNav';
import { StatusBar } from './components/StatusBar';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import GameDetail from './pages/GameDetail';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import Login from './pages/Login';
import Rankings from './pages/Rankings';
import Hall from './pages/Hall';
import Almanac from './pages/Almanac';
import Saga from './pages/Saga';
import Plan from './pages/Plan';
import { getConfig } from './lib/api';
import { ThemeProvider } from './context/ThemeContext';

function AuthedApp() {
  const { user } = useAuth();
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  const checkConfig = useCallback(() => {
    setChecking(true);
    getConfig()
      .then((config) => setConfigured(config.configured.length > 0))
      .catch(() => setConfigured(false))
      .finally(() => setChecking(false));
  }, []);

  useEffect(() => {
    checkConfig();
  }, [checkConfig, user?.id]);

  if (checking) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (!configured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  return (
    <SteamProvider>
      <BrowserRouter>
        <div className="app-shell">
          <a className="skip-link" href="#main-content">Ir para o conteúdo</a>
          <TopNav />
          <main id="main-content" className="app-content" tabIndex={-1}>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/library" element={<Library />} />
              <Route path="/game/:appid" element={<GameDetail />} />
              <Route path="/backlog" element={<Navigate to="/plano" replace />} />
              <Route path="/rankings" element={<Rankings />} />
              <Route path="/hall" element={<Hall />} />
              <Route path="/almanaque" element={<Almanac />} />
              <Route path="/sagas" element={<Navigate to="/sagas/final-fantasy" replace />} />
              <Route path="/sagas/:slug" element={<Saga />} />
              <Route path="/plano" element={<Plan />} />
              <Route
                path="/settings"
                element={<Settings onReset={() => setConfigured(false)} onConfigured={() => setConfigured(true)} />}
              />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>
          <StatusBar />
        </div>
      </BrowserRouter>
    </SteamProvider>
  );
}

function Gate() {
  const { user, checking } = useAuth();

  if (checking) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (!user) {
    return <Login />;
  }

  return <AuthedApp />;
}

export default function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <Gate />
      </AuthProvider>
    </ThemeProvider>
  );
}
