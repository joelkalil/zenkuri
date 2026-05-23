import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import Library from './pages/Library';
import GameDetail from './pages/GameDetail';
import Backlog from './pages/Backlog';
import Settings from './pages/Settings';
import Setup from './pages/Setup';

function isConfigured(): boolean {
  return !!(localStorage.getItem('steam-api-key') && localStorage.getItem('steam-id'));
}

export default function App() {
  const [configured, setConfigured] = useState(isConfigured);

  if (!configured) {
    return <Setup onComplete={() => setConfigured(true)} />;
  }

  return (
    <BrowserRouter>
      <div className="flex h-screen bg-gray-950 text-gray-100 overflow-hidden">
        <Sidebar />
        <main className="flex-1 overflow-y-auto pb-16 md:pb-0">
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/library" element={<Library />} />
            <Route path="/game/:appid" element={<GameDetail />} />
            <Route path="/backlog" element={<Backlog />} />
            <Route
              path="/settings"
              element={<Settings onReset={() => setConfigured(false)} />}
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </main>
        <BottomNav />
      </div>
    </BrowserRouter>
  );
}
