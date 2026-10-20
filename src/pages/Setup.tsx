import { useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  Loader2,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';
import {
  linkPlatformAccount,
  syncPlatform,
} from '../lib/api';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';
import { Logo } from '../components/Logo';

interface SetupProps {
  onComplete: () => void;
}

const STEPS = ['Plataformas', 'Perfil', 'Finalizar'] as const;

const PLATFORMS: {
  id: Platform;
  label: string;
  blurb: string;
  recommended?: boolean;
  /** circular logo container background + ring */
  iconClass: string;
  inputLabel: string;
  placeholder: string;
}[] = [
  {
    id: 'steam',
    label: 'Steam',
    blurb: 'Importe suas conquistas da Steam',
    recommended: true,
    iconClass: 'bg-gradient-to-b from-slate-700 to-slate-900 ring-1 ring-slate-600/50',
    inputLabel: 'SteamID64 ou URL do perfil',
    placeholder: 'ex. 76561198000000000 ou steamcommunity.com/id/voce',
  },
  {
    id: 'psn',
    label: 'PlayStation Network',
    blurb: 'Importe seus troféus da PSN',
    iconClass: 'bg-gradient-to-b from-blue-500 to-blue-700 ring-1 ring-blue-400/40',
    inputLabel: 'Online ID (usuário PSN)',
    placeholder: 'ex. seu_online_id',
  },
  {
    id: 'retroachievements',
    label: 'RetroAchievements',
    blurb: 'Importe suas conquistas retrô',
    iconClass: 'bg-gray-950 ring-1 ring-amber-500/50',
    inputLabel: 'Nome de usuário',
    placeholder: 'Usuário do RetroAchievements',
  },
];

const inputClass = 'field h-11 px-3.5 text-sm';
const labelClass = 'mb-2 flex items-center gap-2 text-sm font-medium text-gray-300';

export default function Setup({ onComplete }: SetupProps) {
  const [connected, setConnected] = useState<Platform[]>([]);
  const [modal, setModal] = useState<Platform | null>(null);
  const [identifier, setIdentifier] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const canContinue = connected.length > 0;
  const activeMeta = useMemo(
    () => (modal ? PLATFORMS.find((item) => item.id === modal) ?? null : null),
    [modal],
  );

  function openModal(platform: Platform) {
    setError('');
    setIdentifier('');
    setModal(platform);
  }

  function closeModal() {
    if (busy) return;
    setModal(null);
    setError('');
  }

  async function handleLink() {
    if (!modal) return;
    if (!identifier.trim()) return setError('Informe o identificador do seu perfil.');
    setBusy(true);
    setError('');
    try {
      await linkPlatformAccount(modal, identifier.trim());
      await syncPlatform(modal);
      setConnected((current) => (current.includes(modal) ? current : [...current, modal]));
      setModal(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Falha ao vincular a conta.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-card auth-wide">
          <Logo size={34} />

          <div className="mt-8 flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <h1 className="heading-editorial text-3xl font-semibold text-gray-100">Bem-vindo ao Zenkuri</h1>
              <p className="mt-2 text-gray-500">Vamos configurar sua jornada de conquistas em poucos passos.</p>
            </div>
            {/* Stepper */}
            <div className="flex shrink-0 items-center gap-2">
              {STEPS.map((step, index) => {
                const isActive = index === 0;
                return (
                  <div key={step} className="flex items-center gap-2">
                    <span className={`flex h-7 w-7 items-center justify-center rounded-full border text-xs font-semibold ${
                      isActive ? 'accent-fill border-transparent' : 'border-gray-700 text-gray-500'
                    }`}>
                      {index + 1}
                    </span>
                    <span className={`text-xs font-medium ${isActive ? 'text-gray-100' : 'text-gray-500'}`}>{step}</span>
                    {index < STEPS.length - 1 && <span className="h-px w-5 bg-gray-800" />}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mt-10">
            <h2 className="text-lg font-bold text-gray-100">1. Conecte pelo menos uma plataforma</h2>
            <p className="mt-1 text-sm text-gray-500">
              Informe apenas o identificador público do seu perfil — nenhuma senha, token ou API key é necessária.
            </p>
          </div>

          {/* Platform cards */}
          <div className="mt-5 grid grid-cols-1 gap-4 sm:grid-cols-3">
            {PLATFORMS.map(({ id, label, blurb, iconClass, recommended }) => {
              const isConnected = connected.includes(id);
              return (
                <div
                  key={id}
                  className={`relative flex flex-col items-center rounded-xl border p-6 text-center transition-colors ${
                    isConnected ? 'border-emerald-600/50 bg-emerald-950/10' : 'border-gray-800 bg-gray-950 hover:border-gray-700'
                  }`}
                >
                  {isConnected ? (
                    <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-300">
                      <Check className="h-3 w-3" /> Conectado
                    </span>
                  ) : recommended ? (
                    <span className="absolute right-3 top-3 rounded-full bg-violet-500/15 px-2 py-0.5 text-xs font-medium text-violet-400">
                      Recomendado
                    </span>
                  ) : null}

                  <div className={`mb-5 flex h-16 w-16 items-center justify-center rounded-full ${iconClass}`}>
                    <img src={PLATFORM_META[id].logo} alt="" className="max-h-9 max-w-9 object-contain" />
                  </div>

                  <h3 className="text-base font-semibold text-gray-100">{label}</h3>
                  <p className="mt-1.5 text-sm leading-snug text-gray-500">{blurb}</p>

                  <button
                    type="button"
                    onClick={() => openModal(id)}
                    className={`btn mt-5 w-full ${isConnected ? 'btn-secondary' : 'btn-primary'}`}
                  >
                    {isConnected ? 'Reconectar' : `Conectar ${PLATFORM_META[id].short}`}
                  </button>
                </div>
              );
            })}
          </div>

          <div className="mt-5 flex items-center gap-2 rounded-xl border border-gray-800 bg-gray-950 px-4 py-3 text-xs text-gray-400">
            <ShieldCheck className="h-4 w-4 shrink-0 text-emerald-400" />
            Seguro por padrão · lemos apenas dados públicos do seu perfil. Você nunca informa senhas ou tokens.
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
              className="btn btn-primary btn-lg disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span>Continuar</span>
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Link modal */}
      {modal && activeMeta && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          onClick={closeModal}
        >
          <div
            role="dialog" aria-modal="true" aria-label={`Conectar ${activeMeta.label}`}
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
                aria-label="Fechar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-4">
                <div>
                  <label className={labelClass}>
                    <User className="h-3.5 w-3.5" />
                    {activeMeta.inputLabel}
                  </label>
                  <input
                    type="text"
                    value={identifier}
                    onChange={(e) => setIdentifier(e.target.value)}
                    placeholder={activeMeta.placeholder}
                    className={inputClass}
                  />
                  <p className="mt-1.5 text-xs text-gray-500">
                    Só lemos dados públicos do perfil — nada de senhas ou tokens.
                  </p>
                </div>

                {error && (
                  <p className="rounded-lg border border-red-800/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
                    {error}
                  </p>
                )}

                <button
                  type="button"
                  onClick={handleLink}
                  disabled={busy}
                  className="btn btn-primary btn-lg w-full disabled:opacity-60"

                >
                  {busy ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Localizando perfil…
                    </>
                  ) : (
                    'Vincular perfil'
                  )}
                </button>
              </div>
          </div>
        </div>
      )}
    </div>
  );
}
