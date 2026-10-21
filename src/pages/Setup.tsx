import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import {
  linkPlatformAccount,
  syncPlatform,
} from '../lib/api';
import type { Platform } from '../types/steam';
import { PLATFORM_META } from '../lib/platforms';
import { Logo } from '../components/Logo';
import '../styles/login.css';

interface SetupProps {
  onComplete: () => void;
}

const PLATFORMS: {
  id: Platform;
  label: string;
  blurb: string;
  recommended?: boolean;
  inputLabel: string;
  placeholder: string;
}[] = [
  {
    id: 'steam',
    label: 'Steam',
    blurb: 'Importe suas conquistas da Steam.',
    recommended: true,
    inputLabel: 'SteamID64 ou URL do perfil',
    placeholder: 'ex. 76561198000000000 ou steamcommunity.com/id/voce',
  },
  {
    id: 'psn',
    label: 'PlayStation',
    blurb: 'Importe seus troféus da PlayStation Network.',
    inputLabel: 'Online ID (usuário PSN)',
    placeholder: 'ex. seu_online_id',
  },
  {
    id: 'retroachievements',
    label: 'RetroAchievements',
    blurb: 'Importe suas conquistas retrô.',
    inputLabel: 'Nome de usuário',
    placeholder: 'Usuário do RetroAchievements',
  },
];

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

  const [skipped, setSkipped] = useState<Platform[]>([]);

  useEffect(() => {
    if (!modal) return undefined;
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') closeModal();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  return (
    <div className="auth-screen">
      <div className="auth-card auth-wide">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <Logo size={36} />
          <p className="num text-sm text-gray-400" aria-live="polite">
            <span className="text-gray-100">{connected.length}</span> de {PLATFORMS.length} conectadas
          </p>
        </div>

        <h1 className="mt-8 font-display text-3xl font-bold text-gray-50">Bem-vindo ao Zenkuri</h1>
        <p className="lede mt-2 max-w-2xl">
          Conecte pelo menos uma plataforma para começar. Informe apenas o identificador público do seu perfil:
          nenhuma senha, token ou API key é necessária.
        </p>

        <div className="mt-8">
          {PLATFORMS.map(({ id, label, blurb, recommended }, index) => {
            const isConnected = connected.includes(id);
            const isSkipped = skipped.includes(id);
            return (
              <div key={id} className="su-step">
                <span className="su-num">{String(index + 1).padStart(2, '0')}</span>
                <div className="flex min-w-0 items-center gap-3">
                  <img src={PLATFORM_META[id].logo} alt="" className="h-6 w-6 shrink-0 object-contain" />
                  <div className="min-w-0">
                    <h2 className="su-title">
                      {label}
                      {recommended && !isConnected && <span className="badge ml-2 align-middle" data-tone="accent">Recomendado</span>}
                    </h2>
                    <p className="text-sm text-gray-500">{blurb}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  {isConnected ? <span className="su-state" data-on="true">Conectado</span> : isSkipped ? <span className="su-state">Pulado</span> : null}
                  {!isConnected && !isSkipped && (
                    <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSkipped((current) => [...current, id])}>
                      Pular<span className="sr-only"> {label}</span>
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => openModal(id)}
                    className={`btn btn-sm ${isConnected ? 'btn-secondary' : recommended ? 'btn-primary' : 'btn-secondary'}`}
                  >
                    {isConnected ? 'Reconectar' : 'Conectar'}<span className="sr-only"> {label}</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-8 flex items-center justify-between gap-4">
          <a href="https://github.com/joelkalil" target="_blank" rel="noopener noreferrer" className="text-sm text-gray-500 transition-colors hover:text-gray-200">
            Precisa de ajuda?
          </a>
          <button
            type="button"
            onClick={onComplete}
            disabled={!canContinue}
            className="btn btn-primary btn-lg"
          >
            Continuar
          </button>
        </div>
      </div>

      {modal && activeMeta && (
        <div className="su-dialog-backdrop" onClick={closeModal}>
          <div
            role="dialog" aria-modal="true" aria-labelledby="su-dialog-title"
            className="su-dialog"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <img src={PLATFORM_META[modal].logo} alt="" className="h-7 w-7 object-contain" />
                <div>
                  <h2 id="su-dialog-title" className="font-display text-lg font-bold text-gray-100">Conectar {activeMeta.label}</h2>
                  <p className="text-xs text-gray-500">{activeMeta.blurb}</p>
                </div>
              </div>
              <button type="button" onClick={closeModal} className="btn btn-ghost btn-sm">Fechar</button>
            </div>

            <form
              className="space-y-4"
              onSubmit={(event) => { event.preventDefault(); handleLink(); }}
            >
              <div>
                <label htmlFor="su-identifier" className="auth-label">{activeMeta.inputLabel}</label>
                <input
                  id="su-identifier"
                  type="text"
                  autoFocus
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder={activeMeta.placeholder}
                  className="field"
                />
                <p className="mt-1.5 text-xs text-gray-500">
                  Só lemos dados públicos do perfil, nada de senhas ou tokens.
                </p>
              </div>

              {error && <p role="alert" className="auth-error">{error}</p>}

              <button type="submit" disabled={busy} className="btn btn-primary btn-lg w-full">
                {busy ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Localizando perfil…
                  </>
                ) : (
                  'Vincular perfil'
                )}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
