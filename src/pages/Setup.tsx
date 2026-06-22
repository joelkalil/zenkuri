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
import { Logo } from '../components/Logo';

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

const STEPS = ['Plataformas', 'Perfil', 'Finalizar'] as const;

const PLATFORMS: {
  id: Platform;
  label: string;
  blurb: string;
  recommended?: boolean;
  /** circular logo container background + ring */
  iconClass: string;
}[] = [
  {
    id: 'steam',
    label: 'Steam',
    blurb: 'Importe suas conquistas da Steam',
    recommended: true,
    iconClass: 'bg-gradient-to-b from-slate-700 to-slate-900 ring-1 ring-slate-600/50',
  },
  {
    id: 'psn',
    label: 'PlayStation Network',
    blurb: 'Importe seus troféus da PSN',
    iconClass: 'bg-gradient-to-b from-blue-500 to-blue-700 ring-1 ring-blue-400/40',
  },
  {
    id: 'retroachievements',
    label: 'RetroAchievements',
    blurb: 'Importe suas conquistas retrô',
    iconClass: 'bg-gray-950 ring-1 ring-amber-500/50',
  },
];

function platformValidation(platform: Platform, form: PlatformForm): string {
  if (platform === 'steam') {
    if (!form.steamKey.trim()) return 'A API Key da Steam é obrigatória.';
    if (!/^\d{17}$/.test(form.steamId.trim())) return 'O Steam ID deve ter 17 dígitos.';
  }
  if (platform === 'psn' && !form.npsso.trim()) return 'O token NPSSO da PSN é obrigatório.';
  if (platform === 'retroachievements') {
    if (!form.raUsername.trim()) return 'O usuário do RetroAchievements é obrigatório.';
    if (!form.raKey.trim()) return 'A Web API Key do RetroAchievements é obrigatória.';
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
    <div className="relative flex min-h-screen bg-gray-950">
      {/* Content panel */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-3xl px-6 py-10 sm:px-10">
          <Logo size={34} />

          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-100">Bem-vindo ao Zenkuri</h1>
              <p className="mt-2 text-gray-500">Vamos configurar sua jornada de conquistas em poucos passos.</p>
            </div>
            {/* Stepper */}
            <div className="flex shrink-0 items-center gap-2">
              {STEPS.map((step, index) => {
                const isActive = index === 0;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                      isActive ? 'border-violet-500 bg-violet-500/10 text-violet-300' : 'border-gray-700 text-gray-600'
                    }`}>
                      {index + 1}
                    </span>
                    <span className={`text-xs font-medium ${isActive ? 'text-gray-200' : 'text-gray-600'}`}>{step}</span>
                    {index < STEPS.length - 1 && <span className="h-px w-5 bg-gray-800" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-100">1. Conecte pelo menos uma plataforma</h2>
            <p className="mt-1 text-sm text-gray-500">Escolha suas plataformas para começar a importar conquistas.</p>
          </div>

          {/* Platform cards */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLATFORMS.map(({ id, label, blurb, iconClass, recommended }) => {
              const isConnected = connected.includes(id);
              return (
                <div
                  key={id}
                  className={`relative flex flex-col items-center rounded-2xl border p-6 text-center transition-colors ${
                    isConnected ? 'border-emerald-600/50 bg-emerald-950/10' : 'border-gray-800 bg-gray-900/60'
                  }`}
                >
                  {isConnected ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      <Check className="h-3 w-3" /> Conectado
                    </span>
                  ) : recommended ? (
                    <span className="absolute right-3 top-3 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-300">
                      Recomendado
                    </span>
                  ) : null}

                  <div className={`mb-5 flex h-20 w-20 items-center justify-center rounded-full ${iconClass}`}>
                    <img src={PLATFORM_META[id].logo} alt="" className="max-h-11 max-w-11 object-contain" />
                  </div>

                  <h3 className="text-lg font-bold text-gray-100">{label}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-gray-500">{blurb}</p>

                  <button
                    type="button"
                    onClick={() => openModal(id)}
                    className={`mt-5 w-full rounded-lg py-2.5 text-sm font-semibold transition-colors ${
                      isConnected ? 'bg-gray-800 text-gray-300 hover:bg-gray-700' : 'bg-violet-600 text-white hover:bg-violet-500'
                    }`}
                  >
                    {isConnected ? 'Reconectar' : `Conectar ${PLATFORM_META[id].short}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-900/40 px-4 py-3 text-xs text-gray-500">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            Seguro e privado · suas credenciais ficam apenas no seu dispositivo, no SQLite local.
          </div>

          {/* Footer */}
          <div className="mt-8 flex items-center justify-between">
            <a href="https://github.com/joelkalil" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 transition-colors hover:text-gray-300">
              Precisa de ajuda?
            </a>
            <button
              type="button"
              onClick={onComplete}
              disabled={!canContinue}
              className="inline-flex items-center justify-center gap-2 rounded-lg bg-violet-600 px-6 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Continuar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Moonlit hero panel */}
      <div className="relative hidden w-[34%] shrink-0 overflow-hidden border-l border-gray-800 lg:block">
        <svg viewBox="0 0 400 800" preserveAspectRatio="xMidYMid slice" className="absolute inset-0 h-full w-full">
          <defs>
            <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" stopColor="#2a1a52" />
              <stop offset="0.5" stopColor="#1a1235" />
              <stop offset="1" stopColor="#0c0a18" />
            </linearGradient>
            <radialGradient id="moon" cx="50%" cy="50%" r="50%">
              <stop offset="0" stopColor="#e9deff" />
              <stop offset="0.7" stopColor="#b59bff" />
              <stop offset="1" stopColor="#b59bff" stopOpacity="0" />
            </radialGradient>
          </defs>
          <rect width="400" height="800" fill="url(#sky)" />
          <circle cx="250" cy="240" r="150" fill="url(#moon)" opacity="0.5" />
          <circle cx="250" cy="240" r="74" fill="#f3edff" />
          <circle cx="250" cy="240" r="74" fill="#1a1235" opacity="0.06" />
          {/* stars */}
          <g fill="#fff" opacity="0.7">
            <circle cx="60" cy="120" r="1.4" /><circle cx="120" cy="80" r="1" /><circle cx="330" cy="120" r="1.2" />
            <circle cx="90" cy="300" r="1" /><circle cx="350" cy="320" r="1.3" /><circle cx="40" cy="220" r="1" />
          </g>
          {/* mountains */}
          <path d="M0 560 L90 460 L170 540 L250 430 L330 530 L400 470 L400 800 L0 800 Z" fill="#150f2c" />
          <path d="M0 640 L80 560 L180 630 L260 540 L360 620 L400 580 L400 800 L0 800 Z" fill="#0e0a20" />
          {/* lone warrior on a ledge */}
          <path d="M150 632 l60 0 l-6 14 l-48 0 Z" fill="#080610" />
          <g fill="#080610">
            <ellipse cx="180" cy="628" rx="5" ry="6" />
            <rect x="177" y="606" width="6" height="20" rx="3" />
            <path d="M183 612 l16 -26 l3 2 l-15 27 Z" />
          </g>
        </svg>
        <div className="absolute inset-0 bg-gradient-to-l from-transparent to-gray-950/40" />
        <div className="absolute bottom-0 left-0 right-0 p-8">
          <p className="text-lg font-bold text-white">Todos os seus troféus.</p>
          <p className="text-lg font-bold text-violet-300">Cada plataforma. Um só plano.</p>
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
                  <h3 className="text-base font-bold text-gray-100">Conectar {activeMeta.label}</h3>
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
                      placeholder="Cole sua Steam Web API Key"
                      className={inputClass}
                    />
                    <p className="mt-1.5 text-xs text-gray-500">
                      Obtenha a sua em{' '}
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
                      placeholder="ex. 76561198000000000"
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
                    placeholder="Cole seu token NPSSO"
                    className={`${inputClass} font-mono`}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    O NPSSO é sensível, como uma senha. Ele fica apenas no seu SQLite local.
                  </p>
                </div>
              )}

              {modal === 'retroachievements' && (
                <>
                  <div>
                    <label className={labelClass}>
                      <User className="h-3.5 w-3.5" />
                      Usuário
                    </label>
                    <input
                      type="text"
                      value={form.raUsername}
                      onChange={(e) => updateForm('raUsername', e.target.value)}
                      placeholder="Usuário do RetroAchievements"
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
                      placeholder="RA Web API Key"
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
                    Conectando e sincronizando…
                  </>
                ) : (
                  'Conectar e Sincronizar'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
