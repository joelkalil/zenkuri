import { useEffect, useState } from 'react';
import { Key, Hash, Trash2, Download, RefreshCw, CheckCircle, Database, Gamepad2, Shield, Trophy } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import {
  getConfig,
  deletePlatformConfig,
  savePsnConfig,
  saveRetroAchievementsConfig,
  saveSteamConfig,
  syncPlatform,
} from '../lib/api';
import type { Platform } from '../types/steam';

interface SettingsProps {
  onReset: () => void;
  onConfigured: () => void;
}

const PLATFORM_LABEL: Record<Platform, string> = {
  steam: 'Steam',
  retroachievements: 'RetroAchievements',
  psn: 'PlayStation Network',
};

export default function Settings({ onReset, onConfigured }: SettingsProps) {
  const { sync } = useSteam();
  const { exportDb } = useLocalDb();

  const [configured, setConfigured] = useState<Platform[]>([]);
  const [steamKey, setSteamKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [raUsername, setRaUsername] = useState('');
  const [raKey, setRaKey] = useState('');
  const [npsso, setNpsso] = useState('');
  const [saved, setSaved] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<Platform | 'all' | ''>('');

  function refreshConfig() {
    getConfig()
      .then((config) => setConfigured(config.configured.map((entry) => entry.platform)))
      .catch(() => setConfigured([]));
  }

  useEffect(() => {
    refreshConfig();
  }, []);

  async function save(platform: Platform) {
    setBusy(platform);
    setError('');
    setSaved('');
    try {
      if (platform === 'steam') {
        if (!steamKey.trim()) throw new Error('Steam API Key is required.');
        if (!/^\d{17}$/.test(steamId.trim())) throw new Error('Steam ID must be a 17-digit number.');
        await saveSteamConfig({ key: steamKey.trim(), steamid: steamId.trim() });
      }
      if (platform === 'retroachievements') {
        await saveRetroAchievementsConfig({ username: raUsername.trim(), webApiKey: raKey.trim() });
      }
      if (platform === 'psn') {
        await savePsnConfig({ npsso: npsso.trim() });
      }
      await syncPlatform(platform);
      setSaved(`${PLATFORM_LABEL[platform]} saved and synced.`);
      refreshConfig();
      window.dispatchEvent(new Event('zenkuri-config-updated'));
      onConfigured();
    } catch (err) {
      setError(err instanceof Error ? err.message : `Failed to save ${PLATFORM_LABEL[platform]}.`);
    } finally {
      setBusy('');
      setTimeout(() => setSaved(''), 3000);
    }
  }

  function handleSyncAll() {
    setBusy('all');
    sync();
    setTimeout(() => setBusy(''), 800);
  }

  async function handleDisconnect() {
    if (!confirm('This will return to setup when no platform remains configured. Continue?')) return;
    await Promise.all(configured.map((platform) => deletePlatformConfig(platform)));
    setConfigured([]);
    window.dispatchEvent(new Event('zenkuri-config-updated'));
    onReset();
  }

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage platform connections, sync, and local planning data</p>
      </div>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-300">Connected Platforms</h2>
          <div className="flex items-center gap-1.5 text-xs text-gray-500">
            <Database className="w-3.5 h-3.5" />
            SQLite local
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {(['steam', 'retroachievements', 'psn'] as Platform[]).map((platform) => (
            <span
              key={platform}
              className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-xs font-semibold ${
                configured.includes(platform)
                  ? 'border-emerald-700/40 bg-emerald-900/20 text-emerald-300'
                  : 'border-gray-800 bg-gray-950 text-gray-500'
              }`}
            >
              <CheckCircle className="w-3.5 h-3.5" />
              {PLATFORM_LABEL[platform]}
            </span>
          ))}
        </div>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Steam</h2>
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            <Key className="w-3.5 h-3.5" /> API Key
          </label>
          <input type="password" value={steamKey} onChange={(e) => setSteamKey(e.target.value)}
            placeholder="Steam Web API Key"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
        </div>
        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            <Hash className="w-3.5 h-3.5" /> Steam ID (64-bit)
          </label>
          <input type="text" value={steamId} onChange={(e) => setSteamId(e.target.value)}
            placeholder="76561198000000000"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors font-mono" />
        </div>
        <button onClick={() => save('steam')} disabled={busy === 'steam'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white transition-colors">
          <Gamepad2 className="w-4 h-4" /> Save and sync Steam
        </button>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">RetroAchievements</h2>
        <div className="grid sm:grid-cols-2 gap-3">
          <input type="text" value={raUsername} onChange={(e) => setRaUsername(e.target.value)}
            placeholder="RA username"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
          <input type="password" value={raKey} onChange={(e) => setRaKey(e.target.value)}
            placeholder="RA Web API Key"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors" />
        </div>
        <button onClick={() => save('retroachievements')} disabled={busy === 'retroachievements'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-blue-600 hover:bg-blue-500 disabled:opacity-60 text-white transition-colors">
          <Trophy className="w-4 h-4" /> Save and sync RetroAchievements
        </button>
      </section>

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">PlayStation Network</h2>
        <input type="password" value={npsso} onChange={(e) => setNpsso(e.target.value)}
          placeholder="NPSSO token"
          className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors font-mono" />
        <p className="text-xs text-gray-500">
          NPSSO is sensitive, like a password. It stays in your local SQLite database and is only used by the local backend.
        </p>
        <button onClick={() => save('psn')} disabled={busy === 'psn'}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold bg-indigo-600 hover:bg-indigo-500 disabled:opacity-60 text-white transition-colors">
          <Shield className="w-4 h-4" /> Save and sync PSN
        </button>
      </section>

      {(error || saved) && (
        <p className={`text-xs rounded-lg px-3 py-2 border ${error ? 'text-red-300 bg-red-900/20 border-red-800/30' : 'text-emerald-300 bg-emerald-900/20 border-emerald-800/30'}`}>
          {error || saved}
        </p>
      )}

      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Data Management</h2>
        <div className="space-y-2">
          <button onClick={handleSyncAll} disabled={busy === 'all'}
            className="w-full flex items-center gap-2 px-4 py-2.5 bg-blue-600/10 hover:bg-blue-600/20 text-blue-300 border border-blue-700/20 rounded-lg text-sm font-medium transition-colors">
            <RefreshCw className="w-4 h-4" />
            Sync all configured platforms
          </button>
          <button onClick={() => exportDb()}
            className="flex items-center gap-2 px-3 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-xs font-medium transition-colors">
            <Download className="w-3.5 h-3.5" />
            Export planning JSON
          </button>
        </div>
      </section>

      <section className="bg-red-950/20 border border-red-900/30 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-red-300 mb-3">Danger Zone</h2>
        <button onClick={handleDisconnect}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-300 border border-red-800/30 rounded-lg text-sm font-medium transition-colors">
          <Trash2 className="w-4 h-4" />
          Return to setup
        </button>
      </section>
    </div>
  );
}
