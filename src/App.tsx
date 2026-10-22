import { useCallback, useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SetupTutorials } from './components/SetupTutorials';
import { SteamProvider } from './context/SteamContext';
import { UpdateProgressToast } from './components/UpdateProgressToast';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TopNav } from './components/TopNav';
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
import Community from './pages/Community';
import Tutorials from './pages/Tutorials';
import { getConfig } from './lib/api';
import { ThemeProvider } from './context/ThemeContext';
import { I18nProvider, useI18n } from './i18n';

function AuthedApp() {
  const { user } = useAuth();
  const { locale, t } = useI18n();
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
    // Tutorials stay reachable during first-run setup, when the shell is not mounted yet.
    return (
      <Routes>
        <Route path="/tutoriais" element={<SetupTutorials />} />
        <Route path="*" element={<Setup onComplete={() => setConfigured(true)} />} />
      </Routes>
    );
  }

  return (
    <SteamProvider>
      <div className="app-shell">
        <a className="skip-link" href="#main-content">{t('shell.skipLink')}</a>
        <TopNav />
        {/* Keyed by locale: switching language remounts the pages, so helpers that read the active locale (e.g. planDates) refresh too. */}
        <main key={locale} id="main-content" className="app-content" tabIndex={-1}>
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
            <Route path="/comunidade" element={<Community />} />
            <Route path="/tutoriais" element={<Tutorials />} />
            <Route
              path="/settings"
              element={<Settings onReset={() => setConfigured(false)} onConfigured={() => setConfigured(true)} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <UpdateProgressToast />
      </div>
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
    <I18nProvider>
      <ThemeProvider>
        <AuthProvider>
          <BrowserRouter>
            <Gate />
          </BrowserRouter>
        </AuthProvider>
      </ThemeProvider>
    </I18nProvider>
  );
}
