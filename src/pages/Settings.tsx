import { useState } from 'react';
import { Key, Hash, Trash2, Download, RefreshCw, CheckCircle } from 'lucide-react';
import { cacheClearAll } from '../lib/cache';
import { useLocalDb } from '../hooks/useLocalDb';

interface SettingsProps {
  onReset: () => void;
}

export default function Settings({ onReset }: SettingsProps) {
  const { exportDb } = useLocalDb();

  const [apiKey, setApiKey] = useState(localStorage.getItem('steam-api-key') ?? '');
  const [steamId, setSteamId] = useState(localStorage.getItem('steam-id') ?? '');
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  function handleSave() {
    if (!apiKey.trim()) return setError('API Key is required.');
    if (!/^\d{17}$/.test(steamId.trim())) return setError('Steam ID must be a 17-digit number.');
    localStorage.setItem('steam-api-key', apiKey.trim());
    localStorage.setItem('steam-id', steamId.trim());
    setError('');
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  function handleClearCache() {
    cacheClearAll();
    window.location.reload();
  }

  function handleDisconnect() {
    if (!confirm('This will remove your API key and Steam ID. Continue?')) return;
    localStorage.removeItem('steam-api-key');
    localStorage.removeItem('steam-id');
    cacheClearAll();
    onReset();
  }

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your Steam connection and data</p>
      </div>

      {/* Steam config */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-4">
        <h2 className="text-sm font-semibold text-gray-300">Steam Configuration</h2>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            <Key className="w-3.5 h-3.5" /> API Key
          </label>
          <input
            type="password"
            value={apiKey}
            onChange={(e) => setApiKey(e.target.value)}
            placeholder="Steam Web API Key"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-colors"
          />
        </div>

        <div>
          <label className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-widest mb-2">
            <Hash className="w-3.5 h-3.5" /> Steam ID (64-bit)
          </label>
          <input
            type="text"
            value={steamId}
            onChange={(e) => setSteamId(e.target.value)}
            placeholder="76561198000000000"
            className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-colors font-mono"
          />
        </div>

        {error && (
          <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <button
          onClick={handleSave}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
            saved
              ? 'bg-emerald-700/20 text-emerald-400 border border-emerald-700/30'
              : 'bg-violet-600 hover:bg-violet-500 text-white'
          }`}
        >
          {saved ? (
            <>
              <CheckCircle className="w-4 h-4" /> Saved
            </>
          ) : (
            'Save changes'
          )}
        </button>
      </section>

      {/* Data management */}
      <section className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-3">
        <h2 className="text-sm font-semibold text-gray-300">Data Management</h2>

        <div className="flex flex-col sm:flex-row gap-3">
          <button
            onClick={handleClearCache}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Clear cache & reload
          </button>

          <button
            onClick={() => exportDb()}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg text-sm font-medium transition-colors"
          >
            <Download className="w-4 h-4" />
            Export platina-db.json
          </button>
        </div>

        <p className="text-xs text-gray-700">
          Clearing the cache forces a fresh fetch from Steam API on next load.
          <br />
          Your backlog, notes, and schedule are not affected.
        </p>
      </section>

      {/* Danger zone */}
      <section className="bg-red-950/20 border border-red-900/30 rounded-2xl p-5">
        <h2 className="text-sm font-semibold text-red-400 mb-3">Danger Zone</h2>
        <button
          onClick={handleDisconnect}
          className="flex items-center gap-2 px-4 py-2 bg-red-900/30 hover:bg-red-900/50 text-red-400 border border-red-800/30 rounded-lg text-sm font-medium transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Disconnect account
        </button>
        <p className="text-xs text-red-900/70 mt-2">
          Removes API key and Steam ID. Your local data (backlog, notes) is preserved.
        </p>
      </section>
    </div>
  );
}
