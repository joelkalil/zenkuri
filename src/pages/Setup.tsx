import { useState } from 'react';
import { Trophy, Key, Hash, ArrowRight, ExternalLink } from 'lucide-react';

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [apiKey, setApiKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [error, setError] = useState('');

  function handleSave() {
    if (!apiKey.trim()) return setError('Steam API Key is required.');
    if (!steamId.trim() || !/^\d{17}$/.test(steamId.trim())) {
      return setError('Steam ID must be a 17-digit number.');
    }
    localStorage.setItem('steam-api-key', apiKey.trim());
    localStorage.setItem('steam-id', steamId.trim());
    onComplete();
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-900/40">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Welcome to Platina</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Connect your Steam account to start tracking achievements
          </p>
        </div>

        {/* Form */}
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6 space-y-5">
          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              <Key className="w-3.5 h-3.5" />
              Steam API Key
            </label>
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your Steam Web API key"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-colors"
            />
            <p className="mt-1.5 text-xs text-gray-700">
              Get yours at{' '}
              <a
                href="https://steamcommunity.com/dev/apikey"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-0.5"
              >
                steamcommunity.com/dev/apikey <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
              <Hash className="w-3.5 h-3.5" />
              Steam ID (64-bit)
            </label>
            <input
              type="text"
              value={steamId}
              onChange={(e) => setSteamId(e.target.value)}
              placeholder="e.g. 76561198000000000"
              className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-700 focus:outline-none focus:border-violet-500 transition-colors font-mono"
            />
            <p className="mt-1.5 text-xs text-gray-700">
              Find yours at{' '}
              <a
                href="https://www.steamidfinder.com/"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:text-blue-400 inline-flex items-center gap-0.5"
              >
                steamidfinder.com <ExternalLink className="w-3 h-3" />
              </a>
            </p>
          </div>

          {error && (
            <p className="text-xs text-red-400 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            Launch Platina <ArrowRight className="w-4 h-4" />
          </button>
        </div>

        <p className="text-center text-xs text-gray-700 mt-4">
          Your credentials are stored locally and never sent anywhere except Steam's API.
        </p>
      </div>
    </div>
  );
}
