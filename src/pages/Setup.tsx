import { useMemo, useState, type ElementType } from 'react';
import { ArrowRight, CheckCircle, ExternalLink, Gamepad2, Hash, Key, Shield, Trophy, User } from 'lucide-react';
import {
  savePsnConfig,
  saveRetroAchievementsConfig,
  saveSteamConfig,
  syncPlatform,
} from '../lib/api';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';

interface SetupProps {
  onComplete: () => void;
}

type PlatformForm = {
  steamKey: string;
  steamId: string;
  raUsername: string;
  raKey: string;
  npsso: string;
};

const PLATFORMS: {
  id: Platform;
  label: string;
  short: string;
  description: string;
  icon: ElementType;
  accent: string;
}[] = [
  {
    id: 'steam',
    label: 'Steam',
    short: 'Steam',
    description: 'PC library and achievements',
    icon: Gamepad2,
    accent: 'border-sky-700/40 bg-sky-950/20 text-sky-300',
  },
  {
    id: 'psn',
    label: 'PlayStation Network',
    short: 'PSN',
    description: 'Trophies and platinum progress',
    icon: Shield,
    accent: 'border-blue-700/40 bg-blue-950/20 text-blue-300',
  },
  {
    id: 'retroachievements',
    label: 'RetroAchievements',
    short: 'RA',
    description: 'Retro sets, hardcore progress',
    icon: Trophy,
    accent: 'border-amber-700/40 bg-amber-950/20 text-amber-300',
  },
];

function hasCredentials(platform: Platform, form: PlatformForm) {
  if (platform === 'steam') return form.steamKey.trim() && /^\d{17}$/.test(form.steamId.trim());
  if (platform === 'psn') return form.npsso.trim();
  return form.raUsername.trim() && form.raKey.trim();
}

export default function Setup({ onComplete }: SetupProps) {
  const [selected, setSelected] = useState<Platform[]>(['steam']);
  const [active, setActive] = useState<Platform>('steam');
  const [form, setForm] = useState<PlatformForm>({
    steamKey: '',
    steamId: '',
    raUsername: '',
    raKey: '',
    npsso: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState<Platform | null>(null);

  const readyPlatforms = useMemo(
    () => selected.filter((platform) => hasCredentials(platform, form)),
    [selected, form],
  );

  function updateForm(key: keyof PlatformForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePlatform(platform: Platform) {
    setSelected((current) => {
      const next = current.includes(platform)
        ? current.filter((item) => item !== platform)
        : [...current, platform];
      setActive(next.includes(platform) ? platform : next[0] ?? platform);
      return next;
    });
  }

  function validateSelected() {
    if (selected.length === 0) return 'Choose at least one platform.';
    for (const platform of selected) {
      if (platform === 'steam') {
        if (!form.steamKey.trim()) return 'Steam API Key is required.';
        if (!/^\d{17}$/.test(form.steamId.trim())) return 'Steam ID must be a 17-digit number.';
      }
      if (platform === 'psn' && !form.npsso.trim()) return 'PSN NPSSO is required.';
      if (platform === 'retroachievements') {
        if (!form.raUsername.trim()) return 'RetroAchievements username is required.';
        if (!form.raKey.trim()) return 'RetroAchievements Web API key is required.';
      }
    }
    return '';
  }

  async function savePlatform(platform: Platform) {
    if (platform === 'steam') {
      await saveSteamConfig({ key: form.steamKey.trim(), steamid: form.steamId.trim() });
    } else if (platform === 'psn') {
      await savePsnConfig({ npsso: form.npsso.trim() });
    } else {
      await saveRetroAchievementsConfig({ username: form.raUsername.trim(), webApiKey: form.raKey.trim() });
    }
    setSyncing(platform);
    await syncPlatform(platform);
  }

  async function handleSave() {
    const validation = validateSelected();
    if (validation) return setError(validation);

    setSaving(true);
    setError('');
    try {
      for (const platform of selected) {
        await savePlatform(platform);
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save platform configuration.');
    } finally {
      setSyncing(null);
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <div className="text-center mb-7">
          <div className="w-16 h-16 bg-violet-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg shadow-violet-900/40">
            <Trophy className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-gray-100">Welcome to Zenkuri</h1>
          <p className="text-gray-500 mt-2 text-sm">
            Pick one or more platforms, add credentials, then sync your first library.
          </p>
        </div>

        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-5 space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {PLATFORMS.map(({ id, label, short, description, icon: Icon, accent }) => {
              const isSelected = selected.includes(id);
              const isActive = active === id;
              const isReady = hasCredentials(id, form);
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => togglePlatform(id)}
                  className={`relative text-left rounded-xl border p-3 transition-colors ${
                    isActive
                      ? 'border-violet-500 bg-violet-950/20'
                      : isSelected
                        ? 'border-gray-600 bg-gray-950'
                        : 'border-gray-800 bg-gray-950/60 hover:border-gray-700'
                  }`}
                >
                  <div className={`mb-3 flex h-9 w-9 items-center justify-center rounded-lg border ${accent}`}>
                    <img
                      src={PLATFORM_META[id].logo}
                      alt=""
                      className="max-h-5 max-w-5 object-contain"
                      onError={(event) => {
                        event.currentTarget.style.display = 'none';
                      }}
                    />
                    <Icon className="hidden w-4 h-4" />
                  </div>
                  <p className="text-sm font-bold text-gray-100">{short}</p>
                  <p className="mt-0.5 text-xs text-gray-500">{description}</p>
                  <div className="absolute right-2.5 top-2.5">
                    {isReady ? (
                      <CheckCircle className="w-4 h-4 text-emerald-400" />
                    ) : (
                      <span className={`block h-3.5 w-3.5 rounded-full border ${isSelected ? 'border-violet-400 bg-violet-500/20' : 'border-gray-700'}`} />
                    )}
                  </div>
                  <span className="sr-only">{label}</span>
                </button>
              );
            })}
          </div>

          {active === 'steam' && (
            <div className="space-y-4">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  <Key className="w-3.5 h-3.5" />
                  Steam API Key
                </label>
                <input
                  type="password"
                  value={form.steamKey}
                  onChange={(e) => updateForm('steamKey', e.target.value)}
                  placeholder="Paste your Steam Web API key"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Get yours at{' '}
                  <a href="https://steamcommunity.com/dev/apikey" target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 inline-flex items-center gap-0.5">
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
                  value={form.steamId}
                  onChange={(e) => updateForm('steamId', e.target.value)}
                  placeholder="e.g. 76561198000000000"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
                />
              </div>
            </div>
          )}

          {active === 'psn' && (
            <div className="space-y-3">
              <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest">
                <Shield className="w-3.5 h-3.5" />
                PSN NPSSO
              </label>
              <input
                type="password"
                value={form.npsso}
                onChange={(e) => updateForm('npsso', e.target.value)}
                placeholder="Paste your NPSSO token"
                className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors font-mono"
              />
              <p className="text-xs text-gray-500">
                NPSSO is sensitive, like a password. It stays in your local SQLite database.
              </p>
            </div>
          )}

          {active === 'retroachievements' && (
            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <input
                  type="text"
                  value={form.raUsername}
                  onChange={(e) => updateForm('raUsername', e.target.value)}
                  placeholder="RetroAchievements username"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
              <div>
                <label className="flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2">
                  <Key className="w-3.5 h-3.5" />
                  Web API Key
                </label>
                <input
                  type="password"
                  value={form.raKey}
                  onChange={(e) => updateForm('raKey', e.target.value)}
                  placeholder="RA Web API key"
                  className="w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors"
                />
              </div>
            </div>
          )}

          {error && (
            <p className="text-xs text-red-300 bg-red-900/20 border border-red-800/30 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            onClick={handleSave}
            disabled={saving || readyPlatforms.length === 0}
            className="w-full flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled:opacity-60 disabled:hover:bg-violet-600 text-white font-semibold py-2.5 rounded-lg transition-colors"
          >
            {saving ? (
              <>
                <Gamepad2 className="w-4 h-4" />
                {syncing ? `Syncing ${PLATFORMS.find((item) => item.id === syncing)?.short}` : 'Saving platforms'}
              </>
            ) : (
              <>
                <span>Launch Zenkuri</span>
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </div>

        <p className="text-center text-xs text-gray-500 mt-4">
          Configure one platform now or all three. You can add or replace credentials later in Settings.
        </p>
      </div>
    </div>
  );
}
