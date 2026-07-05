import { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SteamProvider } from './context/SteamContext';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import GameDetail from './pages/GameDetail';
import Backlog from './pages/Backlog';
import Settings from './pages/Settings';
import Setup from './pages/Setup';
import Rankings from './pages/Rankings';
import Hall from './pages/Hall';
import Almanac from './pages/Almanac';
import { getConfig } from './lib/api';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  const [configured, setConfigured] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    getConfig()
      .then((config) => setConfigured(config.configured.length > 0))
      .catch(() => setConfigured(false))
      .finally(() => setChecking(false));
  }, []);

  if (checking) {
    return <div className="min-h-screen bg-gray-950" />;
  }

  if (!configured) {
    return (
      <ThemeProvider>
        <Setup onComplete={() => setConfigured(true)} />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <SteamProvider>
        <BrowserRouter>
          <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
            <Sidebar />
            <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/library" element={<Library />} />
                <Route path="/game/:appid" element={<GameDetail />} />
                <Route path="/backlog" element={<Backlog />} />
                <Route path="/rankings" element={<Rankings />} />
                <Route path="/hall" element={<Hall />} />
                <Route path="/almanaque" element={<Almanac />} />
                <Route
                  path="/settings"
                  element={<Settings onReset={() => setConfigured(false)} onConfigured={() => setConfigured(true)} />}
                />
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </main>
            <BottomNav />
          </div>
        </BrowserRouter>
      </SteamProvider>
    </ThemeProvider>
  );
}
