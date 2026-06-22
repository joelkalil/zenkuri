import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  ExternalLink,
  Hash,
  Key,
  Loader2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
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

const EMPTY_FORM: PlatformForm = {
  steamKey: '',
  steamId: '',
  raUsername: '',
  raKey: '',
  npsso: '',
};

const STEPS = ['Platforms', 'Profile', 'Finish'] as const;

const PLATFORMS: {
  id: Platform;
  label: string;
  blurb: string;
  /** circular logo container background + ring */
  iconClass: string;
}[] = [
  {
    id: 'steam',
    label: 'Steam',
    blurb: 'Import your Steam achievements',
    iconClass: 'bg-gradient-to-b from-slate-700 to-slate-900 ring-1 ring-slate-600/50',
  },
  {
    id: 'psn',
    label: 'PlayStation Network',
    blurb: 'Import your PSN trophies',
    iconClass: 'bg-gradient-to-b from-blue-500 to-blue-700 ring-1 ring-blue-400/40',
  },
  {
    id: 'retroachievements',
    label: 'RetroAchievements',
    blurb: 'Import your retro achievements',
    iconClass: 'bg-gray-950 ring-1 ring-amber-500/50',
  },
];

function platformValidation(platform: Platform, form: PlatformForm): string {
  if (platform === 'steam') {
    if (!form.steamKey.trim()) return 'Steam API Key is required.';
    if (!/^\d{17}$/.test(form.steamId.trim())) return 'Steam ID must be a 17-digit number.';
  }
  if (platform === 'psn' && !form.npsso.trim()) return 'PSN NPSSO is required.';
  if (platform === 'retroachievements') {
    if (!form.raUsername.trim()) return 'RetroAchievements username is required.';
    if (!form.raKey.trim()) return 'RetroAchievements Web API key is required.';
  }
  return '';
}

async function persistPlatform(platform: Platform, form: PlatformForm) {
  if (platform === 'steam') {
    await saveSteamConfig({ key: form.steamKey.trim(), steamid: form.steamId.trim() });
  } else if (platform === 'psn') {
    await savePsnConfig({ npsso: form.npsso.trim() });
  } else {
    await saveRetroAchievementsConfig({ username: form.raUsername.trim(), webApiKey: form.raKey.trim() });
  }
  await syncPlatform(platform);
}

const inputClass =
  'w-full bg-gray-950 border border-gray-800 rounded-lg px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:border-violet-500 transition-colors';
const labelClass =
  'flex items-center gap-2 text-xs font-semibold text-gray-400 uppercase tracking-widest mb-2';

export default function Setup({ onComplete }: SetupProps) {
  const [connected, setConnected] = useState<Platform[]>([]);
  const [modal, setModal] = useState<Platform | null>(null);
  const [form, setForm] = useState<PlatformForm>(EMPTY_FORM);
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  const canContinue = connected.length > 0;
  const activeMeta = useMemo(
    () => (modal ? PLATFORMS.find((item) => item.id === modal) ?? null : null),
    [modal],
  );

  function updateForm(key: keyof PlatformForm, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function openModal(platform: Platform) {
    setError('');
    setModal(platform);
  }

  function closeModal() {
    if (saving) return;
    setModal(null);
    setError('');
  }

  async function handleConnect() {
    if (!modal) return;
    const validation = platformValidation(modal, form);
    if (validation) return setError(validation);

    setSaving(true);
    setError('');
    try {
      await persistPlatform(modal, form);
      setConnected((current) => (current.includes(modal) ? current : [...current, modal]));
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect platform.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-100">Welcome to Zenkuri</h1>
          <p className="text-gray-500 mt-2">Let&apos;s connect at least one platform to get started.</p>
        </div>

        {/* Stepper */}
        <div className="flex items-center justify-center gap-2 sm:gap-4 mb-10">
          {STEPS.map((step, index) => {
            const isActive = index === 0;
            return (
              <div key={step} className="flex items-center gap-2 sm:gap-4">
                <div className="flex items-center gap-2.5">
                  <span
                    className={`flex h-8 w-8 items-center justify-center rounded-full border text-sm font-semibold transition-colors ${
                      isActive
                        ? 'border-violet-500 text-violet-300 bg-violet-500/10'
                        : 'border-gray-700 text-gray-500'
                    }`}
                  >
                    {index + 1}
                  </span>
                  <span className={`text-sm font-medium ${isActive ? 'text-gray-100' : 'text-gray-500'}`}>
                    {step}
                  </span>
                </div>
                {index < STEPS.length - 1 && <span className="h-px w-8 sm:w-16 bg-gray-800" />}
              </div>
            );
          })}
        </div>

        {/* Platform cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {PLATFORMS.map(({ id, label, blurb, iconClass }) => {
            const isConnected = connected.includes(id);
            return (
              <div
                key={id}
                className={`relative flex flex-col items-center text-center rounded-2xl border p-6 transition-colors ${
                  isConnected
                    ? 'border-emerald-600/50 bg-emerald-950/10'
                    : 'border-gray-800 bg-gray-900/60'
                }`}
              >
                {isConnected && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                    <Check className="h-3 w-3" />
                    Connected
                  </span>
                )}

                <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${iconClass}`}>
                  <img
                    src={PLATFORM_META[id].logo}
                    alt=""
                    className="max-h-11 max-w-11 object-contain"
                  />
                </div>

                <h2 className="text-lg font-bold text-gray-100">{label}</h2>
                <p className="mt-1.5 text-sm text-gray-500 leading-snug">{blurb}</p>

                <button
                  type="button"
                  onClick={() => openModal(id)}
                  className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                    isConnected
                      ? 'bg-gray-800 text-gray-300 hover:bg-gray-700'
                      : 'bg-violet-600 text-white hover:bg-violet-500'
                  }`}
                >
                  {isConnected ? 'Reconnect' : 'Connect'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div className="mt-8 flex flex-col items-center gap-4">
          <button
            type="button"
            onClick={onComplete}
            disabled={!canContinue}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-violet-600"
          >
            <span>{canContinue ? 'Continue to Zenkuri' : 'Connect a platform to continue'}</span>
            {canContinue && <ArrowRight className="h-4 w-4" />}
          </button>
          <p className="text-center text-xs text-gray-500">
            You can connect more platforms later in Settings.
          </p>
        </div>
      </div>

      {/* Credential modal */}
      {modal && activeMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-gray-800 bg-gray-900 p-6 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className={`flex h-11 w-11 items-center justify-center rounded-full ${activeMeta.iconClass}`}>
                  <img src={PLATFORM_META[modal].logo} alt="" className="max-h-6 max-w-6 object-contain" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-gray-100">Connect {activeMeta.label}</h3>
                  <p className="text-xs text-gray-500">{activeMeta.blurb}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-gray-500 transition-colors hover:bg-gray-800 hover:text-gray-300"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
              {modal === 'steam' && (
                <>
                  <div>
                    <label className={labelClass}>
                      <Key className="h-3.5 w-3.5" />
                      Steam API Key
                    </label>
                    <input
                      type="password"
                      value={form.steamKey}
                      onChange={(e) => updateForm('steamKey', e.target.value)}
                      placeholder="Paste your Steam Web API key"
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      Get yours at{' '}
                      <a
                        href="https://steamcommunity.com/dev/apikey"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-0.5 text-blue-400 hover:text-blue-300"
                      >
                        steamcommunity.com/dev/apikey <ExternalLink className="h-3 w-3" />
                      </a>
                    </p>
                  </div>
                  <div>
                    <label className={labelClass}>
                      <Hash className="h-3.5 w-3.5" />
                      Steam ID (64-bit)
                    </label>
                    <input
                      type="text"
                      value={form.steamId}
                      onChange={(e) => updateForm('steamId', e.target.value)}
                      placeholder="e.g. 76561198000000000"
                      className={`${inputClass} font-mono`}
                    />
                  </div>
                </>
              )}

              {modal === 'psn' && (
                <div>
                  <label className={labelClass}>
                    <ShieldCheck className="h-3.5 w-3.5" />
                    PSN NPSSO
                  </label>
                  <input
                    type="password"
                    value={form.npsso}
                    onChange={(e) => updateForm('npsso', e.target.value)}
                    placeholder="Paste your NPSSO token"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    NPSSO is sensitive, like a password. It stays in your local SQLite database.
                  </p>
                </div>
              )}

              {modal === 'retroachievements' && (
                <>
                  <div>
                    <label className={labelClass}>
                      <User className="h-3.5 w-3.5" />
                      Username
                    </label>
                    <input
                      type="text"
                      value={form.raUsername}
                      onChange={(e) => updateForm('raUsername', e.target.value)}
                      placeholder="RetroAchievements username"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className={labelClass}>
                      <Key className="h-3.5 w-3.5" />
                      Web API Key
                    </label>
                    <input
                      type="password"
                      value={form.raKey}
                      onChange={(e) => updateForm('raKey', e.target.value)}
                      placeholder="RA Web API key"
                      className={inputClass}
                    />
                  </div>
                </>
              )}

              {error && (
                <p className="rounded-lg border border-red-800/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                  {error}
                </p>
              )}

              <button
                type="button"
                onClick={handleConnect}
                disabled={saving}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-violet-600 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60 disabled:hover:bg-violet-600"
              >
                {saving ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Connecting &amp; syncing…
                  </>
                ) : (
                  'Connect & Sync'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
