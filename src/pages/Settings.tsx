import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  AlertTriangle, CheckCircle2, Copy, Download, FileUp, KeyRound, Link2, Loader2, LogOut, Medal,
  RefreshCw, RotateCcw, StickyNote, Trash2, Unplug, Upload, UserRound,
} from 'lucide-react';
import type { ElementType } from 'react';
import { useSteam } from '../context/SteamContext';
import { useAuth } from '../context/AuthContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { Switch } from '../components/Switch';
import { LevelPanel, PlatformLevels } from '../components/LevelPanel';
import { useUserLevel } from '../hooks/useUserLevel';
import { PLATFORM_META } from '../lib/platforms';
import {
  authChangePassword, authUpdateProfile, clearMediaCache, deletePlatformConfig, fetchSyncRuns,
  getConfig, importPlanning, linkPlatformAccount,
  resetPlanning, syncPlatform,
  type PublicCredential, type SyncRun,
} from '../lib/api';
import type { Platform } from '../types/steam';

interface SettingsProps {
  onReset: () => void;
  onConfigured: () => void;
}

const TABS = [
  { key: 'account', label: 'Conta', hint: 'Nome, senha e sessão' },
  { key: 'level', label: 'Nível', hint: 'XP e níveis das plataformas' },
  { key: 'connections', label: 'Conexões', hint: 'Steam, PSN e RetroAchievements' },
  { key: 'sync', label: 'Sincronização', hint: 'Agendamento e histórico' },
  { key: 'export', label: 'Exportar', hint: 'Backup e importação' },
  { key: 'danger', label: 'Zona de risco', hint: 'Desconectar e apagar dados' },
] as const;
type Tab = (typeof TABS)[number]['key'];

const TAB_ICONS: Record<Tab, ElementType> = {
  account: UserRound,
  level: Medal,
  connections: Link2,
  sync: RefreshCw,
  export: Download,
  danger: AlertTriangle,
};

const PLATFORMS: Platform[] = ['steam', 'psn', 'retroachievements'];

function relativeTime(iso?: string | null): string {
  if (!iso) return 'nunca';
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60_000);
  if (min < 1) return 'agora';
  if (min < 60) return `há ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return `há ${h}h`;
  return `há ${Math.floor(h / 24)}d`;
}

function lsBool(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
}

export default function Settings({ onReset, onConfigured }: SettingsProps) {
  const { sync, scanning, overallPercent, error: syncError } = useSteam();
  const { db, refresh, exportDb } = useLocalDb();

  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.some((t) => t.key === requested) ? (requested as Tab) : 'connections';
  const setTab = useCallback((next: Tab) => {
    setParams((current) => {
      const updated = new URLSearchParams(current);
      updated.set('tab', next);
      return updated;
    }, { replace: true });
  }, [setParams]);
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [configured, setConfigured] = useState<Platform[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [latest, setLatest] = useState<Record<string, { startedAt: string; status: string; finishedAt: string | null }>>({});
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // A key da Steam (ou NPSSO da PSN) pode invalidar sem avisar — trocar a
  // senha da plataforma é a causa mais comum. Isso já fica no "Histórico de
  // Sincronizações" abaixo, mas o toast garante que o usuário vê na hora,
  // não só quem for procurar na aba Sincronização.
  useEffect(() => {
    if (syncError) flash('err', syncError);
  }, [syncError, flash]);

  function refreshConfig() {
    getConfig()
      .then((config) => {
        setConfigured(config.configured.map((e) => e.platform));
        setCredentials(config.credentials);
      })
      .catch(() => { setConfigured([]); setCredentials([]); });
    fetchSyncRuns().then((r) => { setRuns(r.runs); setLatest(r.latest); }).catch(() => {});
  }

  useEffect(() => { refreshConfig(); }, []);

  const credByPlatform = useMemo(() => {
    const map: Partial<Record<Platform, PublicCredential>> = {};
    for (const c of credentials) map[c.platform] = c;
    return map;
  }, [credentials]);

  return (
    <div className="page">
      <header className="page-head">
        <div>
          <h1 className="page-title">Ajustes</h1>
          <p className="page-desc">Gerencie conexões, sincronização e seus dados locais de planejamento.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções dos ajustes">
          {TABS.map((t) => {
            const Icon = TAB_ICONS[t.key];
            return (
              <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
                className={`settings-nav-item ${t.key === 'danger' ? 'is-danger' : ''}`}>
                <Icon className="h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block">{t.label}</span>
                  <span className="settings-nav-hint">{t.hint}</span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-w-0">
          <h2 className="mb-5 text-xl font-semibold text-gray-100">{TABS.find((t) => t.key === tab)?.label}</h2>
          {toast && (
            <p role="status" className={`mb-4 rounded-lg border px-3 py-2 text-xs ${toast.kind === 'err' ? 'border-red-800/30 bg-red-900/20 text-red-300' : 'border-emerald-800/30 bg-emerald-900/20 text-emerald-300'}`}>
              {toast.text}
            </p>
          )}
      {tab === 'account' && <AccountTab flash={flash} />}
      {tab === 'level' && <LevelTab onOpenConnections={() => setTab('connections')} />}
      {tab === 'connections' && (
        <ConnectionsTab
          configured={configured} credByPlatform={credByPlatform} latest={latest}
          onConfigured={() => { refreshConfig(); onConfigured(); }} flash={flash}
        />
      )}
      {tab === 'sync' && (
        <SyncTab configured={configured} runs={runs} latest={latest} scanning={scanning} overallPercent={overallPercent}
          onSync={() => {
            // O toast de erro (key inválida etc.) vem do efeito acima, ligado
            // ao `syncError` do contexto — aqui só confirmamos o sucesso real.
            sync().then((ok) => { if (ok) flash('ok', 'Sincronização concluída.'); });
            setTimeout(refreshConfig, 500);
          }} />
      )}
      {tab === 'export' && <ExportTab db={db} refresh={refresh} exportDb={exportDb} flash={flash} />}
      {tab === 'danger' && (
        <DangerTab configured={configured} refresh={refresh} onReset={onReset} flash={flash} />
      )}
        </div>
      </div>
    </div>
  );
}


/* ── Nível ───────────────────────────────────────────────────────────────── */

function LevelTab({ onOpenConnections }: { onOpenConnections: () => void }) {
  const { level, error } = useUserLevel();

  return (
    <div className="space-y-10">
      {level ? (
        <LevelPanel level={level} />
      ) : error ? (
        <p className="text-sm text-red-400">{error}</p>
      ) : (
        <div className="space-y-4" aria-hidden="true">
          <div className="h-4 w-28 animate-pulse rounded bg-gray-800" />
          <div className="h-12 w-40 animate-pulse rounded-md bg-gray-800" />
          <div className="h-1.5 max-w-md animate-pulse rounded-full bg-gray-800" />
        </div>
      )}
      <PlatformLevels onOpenConnections={onOpenConnections} />
    </div>
  );
}

/* ── Conta ───────────────────────────────────────────────────────────────── */

function AccountTab({ flash }: { flash: (k: 'ok' | 'err', t: string) => void }) {
  const { user, logout, setUser } = useAuth();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  const fieldClass =
    'w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none';

  async function saveName() {
    if (!displayName.trim()) return flash('err', 'O nome de exibição é obrigatório.');
    setSavingName(true);
    try {
      const res = await authUpdateProfile({ displayName: displayName.trim() });
      setUser(res.user);
      flash('ok', 'Perfil atualizado.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Falha ao atualizar o perfil.');
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) return flash('err', 'A nova senha deve ter pelo menos 6 caracteres.');
    if (newPassword !== confirmPassword) return flash('err', 'As senhas não conferem.');
    setSavingPassword(true);
    try {
      await authChangePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('ok', 'Senha alterada.');
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Falha ao alterar a senha.');
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 lg:col-span-2">
        <h2 className="flex items-center gap-2 text-sm font-bold text-gray-200">
          <UserRound className="h-4 w-4 text-violet-300" /> Perfil
        </h2>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Usuário</p>
          <input value={user?.username ?? ''} disabled className={`${fieldClass} opacity-60`} />
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Nome de exibição</p>
          <input value={displayName} onChange={(e) => setDisplayName(e.target.value)} className={fieldClass} />
        </div>
        <button onClick={saveName} disabled={savingName}
          className="flex items-center gap-2 rounded-lg accent-fill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {savingName ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar Perfil
        </button>

        <h2 className="flex items-center gap-2 border-t border-gray-800 pt-4 text-sm font-bold text-gray-200">
          <KeyRound className="h-4 w-4 text-violet-300" /> Alterar senha
        </h2>
        <div className="grid gap-2.5 sm:grid-cols-3">
          <input type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            placeholder="Senha atual" autoComplete="current-password" className={fieldClass} />
          <input type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            placeholder="Nova senha" autoComplete="new-password" className={fieldClass} />
          <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="Confirmar nova senha" autoComplete="new-password" className={fieldClass} />
        </div>
        <button onClick={savePassword} disabled={savingPassword}
          className="flex items-center gap-2 rounded-lg accent-fill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60">
          {savingPassword ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />} Alterar Senha
        </button>
      </section>

      <section className="h-fit rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-3 text-sm font-bold text-gray-200">Sessão</h2>
        <p className="mb-4 text-xs text-gray-500">
          Conectado como <span className="font-semibold text-gray-300">@{user?.username}</span>. Suas conquistas,
          backlog e contas de plataforma ficam associadas apenas a este usuário.
        </p>
        <button onClick={logout}
          className="flex w-full items-center justify-center gap-2 rounded-lg border border-red-800/40 px-4 py-2.5 text-sm font-semibold text-red-300 transition-colors hover:bg-red-900/30">
          <LogOut className="h-4 w-4" /> Sair da conta
        </button>
      </section>
    </div>
  );
}

/* ── Connections ─────────────────────────────────────────────────────────── */

const IDENTIFIER_META: Record<Platform, { label: string; placeholder: string }> = {
  steam: { label: 'SteamID64 ou URL do perfil', placeholder: 'ex. 76561198000000000 ou steamcommunity.com/id/voce' },
  psn: { label: 'Online ID (usuário PSN)', placeholder: 'ex. seu_online_id' },
  retroachievements: { label: 'Nome de usuário', placeholder: 'Usuário do RetroAchievements' },
};

function ConnectionsTab({ configured, credByPlatform, latest, onConfigured, flash }: {
  configured: Platform[];
  credByPlatform: Partial<Record<Platform, PublicCredential>>;
  latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }>;
  onConfigured: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const [selected, setSelected] = useState<Platform>('steam');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);

  function accountLabel(p: Platform) {
    const c = credByPlatform[p];
    if (!c) return 'Não conectado';
    return `Conectado · ${c.identifier}`;
  }

  async function link() {
    setBusy(true);
    try {
      await linkPlatformAccount(selected, identifier.trim());
      await syncPlatform(selected);
      flash('ok', `${PLATFORM_META[selected].label} vinculado e sincronizado.`);
      window.dispatchEvent(new Event('zenkuri-config-updated'));
      onConfigured();
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Falha ao vincular.');
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(p: Platform) {
    await deletePlatformConfig(p);
    flash('ok', `${PLATFORM_META[p].label} desconectado.`);
    window.dispatchEvent(new Event('zenkuri-config-updated'));
    onConfigured();
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5 lg:col-span-2">
        <h2 className="mb-4 text-sm font-bold text-gray-200">Plataformas Conectadas</h2>
        <div className="space-y-2.5">
          {PLATFORMS.map((p) => {
            const isConn = configured.includes(p);
            const meta = PLATFORM_META[p];
            return (
              <div key={p} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-gray-800">
                  <img src={meta.logo} alt="" className={`h-5 w-5 object-contain ${isConn ? '' : 'grayscale opacity-50'}`} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-100">{meta.label}</p>
                  <p className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`h-1.5 w-1.5 rounded-full ${isConn ? 'bg-emerald-500' : 'bg-gray-600'}`} />
                    {accountLabel(p)}
                  </p>
                </div>
                <div className="hidden text-right text-xs text-gray-500 sm:block">
                  Última sync<br /><span className="text-gray-400">{relativeTime(latest[p]?.startedAt)}</span>
                </div>
                <button
                  onClick={() => { setSelected(p); setIdentifier(''); }}
                  aria-label={isConn ? `Reconectar ${meta.label}` : credByPlatform[p] ? `Continuar vínculo com ${meta.label}` : `Vincular ${meta.label}`}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-700 px-2 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-violet-600 hover:text-violet-200 sm:px-3"
                >
                  <Link2 className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isConn ? 'Reconectar' : credByPlatform[p] ? 'Continuar' : 'Vincular'}</span>
                </button>
                {isConn && (
                  <button onClick={() => disconnect(p)} title="Desconectar"
                    className="shrink-0 rounded-lg border border-red-800/40 px-2 py-1.5 text-xs font-semibold text-red-300 transition-colors hover:bg-red-900/30">
                    <Unplug className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-gray-200"><KeyRound className="h-4 w-4 text-violet-300" /> Vincular Conta</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <div className="mb-3 flex gap-1">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => { setSelected(p); setIdentifier(''); }}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${selected === p ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
                <img src={PLATFORM_META[p].logo} alt="" className="h-3.5 w-3.5 object-contain" />{PLATFORM_META[p].short}
              </button>
            ))}
          </div>

          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">{IDENTIFIER_META[selected].label}</p>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
              placeholder={IDENTIFIER_META[selected].placeholder}
              className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            <button onClick={link} disabled={busy || !identifier.trim()}
              className="flex shrink-0 items-center justify-center gap-2 rounded-lg accent-fill px-4 py-2 text-sm font-semibold transition-colors disabled:opacity-60">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Vincular
            </button>
          </div>
          <p className="mt-2 text-xs text-gray-600">
            Só lemos dados públicos do perfil — nada de senhas, tokens ou API keys.
          </p>

        </div>
      </section>

      <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
        <h2 className="mb-4 text-sm font-bold text-gray-200">Visualização de Conta</h2>
        <div className="space-y-2.5">
          {PLATFORMS.map((p) => {
            const isConn = configured.includes(p);
            return (
              <div key={p} className="flex items-center gap-3 rounded-xl border border-gray-800 bg-gray-950/50 p-3">
                <img src={PLATFORM_META[p].logo} alt="" className={`h-5 w-5 object-contain ${isConn ? '' : 'grayscale opacity-40'}`} />
                <span className="flex-1 truncate text-sm text-gray-300">{PLATFORM_META[p].short}</span>
                {isConn ? <CheckCircle2 className="h-4 w-4 text-emerald-400" /> : <span className="text-xs text-gray-600">—</span>}
              </div>
            );
          })}
        </div>
        <p className="mt-4 rounded-lg border border-blue-800/30 bg-blue-950/20 px-3 py-2 text-xs text-blue-200">
          O Zenkuri lê apenas dados públicos dos perfis vinculados. Você nunca informa senhas, tokens ou API keys.
        </p>
      </section>
    </div>
  );
}

/* ── Sync ────────────────────────────────────────────────────────────────── */

function SyncTab({ configured, runs, latest, scanning, overallPercent, onSync }: {
  configured: Platform[];
  runs: SyncRun[];
  latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }>;
  scanning: boolean;
  overallPercent: number;
  onSync: () => void;
}) {
  const [autoSync, setAutoSync] = useState(() => lsBool('zenkuri-autosync', false));
  const [syncOnStart, setSyncOnStart] = useState(() => lsBool('zenkuri-synconstart', false));
  const [interval, setIntervalValue] = useState(() => localStorage.getItem('zenkuri-syncinterval') ?? '30');

  useEffect(() => { localStorage.setItem('zenkuri-autosync', String(autoSync)); }, [autoSync]);
  useEffect(() => { localStorage.setItem('zenkuri-synconstart', String(syncOnStart)); }, [syncOnStart]);
  useEffect(() => { localStorage.setItem('zenkuri-syncinterval', interval); }, [interval]);

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="space-y-5 rounded-2xl border border-gray-800 bg-gray-900 p-5 lg:col-span-2">
        <h2 className="text-sm font-bold text-gray-200">Configurações de Sync</h2>
        <Switch checked={autoSync} onChange={setAutoSync} label="Auto Sync" description="Sincroniza automaticamente em segundo plano" />
        <Switch checked={syncOnStart} onChange={setSyncOnStart} label="Sincronizar ao abrir o app" description="Roda uma sync assim que o app carrega" />
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-gray-200">Intervalo de sincronização</p>
            <p className="mt-0.5 text-xs text-gray-500">Com que frequência sincronizar quando o Auto Sync está ligado</p>
          </div>
          <select value={interval} onChange={(e) => setIntervalValue(e.target.value)} disabled={!autoSync}
            className="rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-sm text-gray-300 focus:border-violet-500 focus:outline-none disabled:opacity-40">
            <option value="15">A cada 15 minutos</option>
            <option value="30">A cada 30 minutos</option>
            <option value="60">A cada 1 hora</option>
            <option value="360">A cada 6 horas</option>
          </select>
        </div>

        <div className="border-t border-gray-800 pt-4">
          <p className="mb-3 text-sm font-medium text-gray-200">Sincronização manual</p>
          <button onClick={onSync} disabled={scanning}
            className="flex w-full items-center justify-center gap-2 rounded-xl accent-fill px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60">
            {scanning ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />} Sync Now
          </button>
          <div className="mt-3">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Progresso geral</span><span className="font-mono">{overallPercent}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-gray-800">
              <div className="h-full rounded-full bg-violet-500 transition-all duration-700" style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </div>
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-200">Status da Sincronização</h2>
          <div className="space-y-2.5">
            {PLATFORMS.map((p) => {
              const isConn = configured.includes(p);
              const st = latest[p];
              return (
                <div key={p} className="flex items-center gap-2.5">
                  <img src={PLATFORM_META[p].logo} alt="" className={`h-4 w-4 object-contain ${isConn ? '' : 'grayscale opacity-40'}`} />
                  <span className="flex-1 truncate text-sm text-gray-300">{PLATFORM_META[p].short}</span>
                  <span className="text-xs text-gray-500">{relativeTime(st?.startedAt)}</span>
                  <span className={`h-2 w-2 rounded-full ${!isConn ? 'bg-gray-600' : st?.status === 'error' ? 'bg-red-500' : 'bg-emerald-500'}`} />
                </div>
              );
            })}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-200">Histórico de Sincronizações</h2>
          {runs.length === 0 ? (
            <p className="text-xs text-gray-600">Nenhuma sincronização ainda.</p>
          ) : (
            <ul className="space-y-2">
              {runs.slice(0, 8).map((r) => (
                <li key={r.id} className="flex items-center gap-2 text-xs">
                  <span className={`h-1.5 w-1.5 rounded-full ${r.status === 'error' ? 'bg-red-500' : r.status === 'running' ? 'bg-amber-500' : 'bg-emerald-500'}`} />
                  <span className="w-12 shrink-0 font-medium text-gray-300">{PLATFORM_META[r.platform]?.short ?? r.platform}</span>
                  <span className="flex-1 truncate text-gray-600">{r.message ?? r.status}</span>
                  <span className="shrink-0 text-gray-600">{relativeTime(r.startedAt)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Export ──────────────────────────────────────────────────────────────── */

interface BackupEntry { name: string; date: string; size: number; }

function ExportTab({ db, refresh, exportDb, flash }: {
  db: ReturnType<typeof useLocalDb>['db'];
  refresh: () => void;
  exportDb: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const [includeNotes, setIncludeNotes] = useState(true);
  const [includeGuides, setIncludeGuides] = useState(true);
  const [backups, setBackups] = useState<BackupEntry[]>(() => {
    try { return JSON.parse(localStorage.getItem('zenkuri-backups') ?? '[]'); } catch { return []; }
  });
  const fileRef = useRef<HTMLInputElement>(null);

  const payload = useMemo(() => {
    const out: Record<string, unknown> = {
      backlog: db.backlog, pinned: db.pinned, dropped: db.dropped, effort: db.effort, schedule: db.schedule,
      collections: db.collections, collectionOf: db.collectionOf,
    };
    if (includeNotes) out.notes = db.notes;
    if (includeGuides) out.guides = db.guides;
    return out;
  }, [db, includeNotes, includeGuides]);

  const json = useMemo(() => JSON.stringify(payload, null, 2), [payload]);

  function recordBackup() {
    const entry: BackupEntry = { name: `zenkuri-planning_${new Date().toISOString().slice(0, 10)}.json`, date: new Date().toISOString(), size: new Blob([json]).size };
    const next = [entry, ...backups].slice(0, 8);
    setBackups(next);
    localStorage.setItem('zenkuri-backups', JSON.stringify(next));
  }

  function handleExport() { exportDb(); recordBackup(); flash('ok', 'Backup exportado.'); }
  function handleCopy() { navigator.clipboard.writeText(json).then(() => flash('ok', 'JSON copiado.')); }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      return importPlanning(data);
    }).then(() => { refresh(); flash('ok', 'Backup importado.'); }).catch(() => flash('err', 'Arquivo inválido.'));
    e.target.value = '';
  }

  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
      <section className="space-y-4 rounded-2xl border border-gray-800 bg-gray-900 p-5 lg:col-span-2">
        <h2 className="text-sm font-bold text-gray-200">Exportar seu planejamento</h2>
        <Switch checked={includeNotes} onChange={setIncludeNotes} label="Incluir notas pessoais" />
        <Switch checked={includeGuides} onChange={setIncludeGuides} label="Incluir links de guia" />
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-gray-500">Prévia dos dados</p>
          <pre className="max-h-64 overflow-auto rounded-xl border border-gray-800 bg-gray-950 p-3 text-xs leading-relaxed text-gray-400">{json}</pre>
        </div>
        <div className="flex gap-2">
          <button onClick={handleExport} className="flex items-center gap-2 rounded-lg accent-fill px-4 py-2 text-sm font-semibold transition-colors">
            <Download className="h-4 w-4" /> Exportar JSON
          </button>
          <button onClick={handleCopy} className="flex items-center gap-2 rounded-lg border border-gray-700 px-4 py-2 text-sm font-semibold text-gray-300 transition-colors hover:border-gray-600">
            <Copy className="h-4 w-4" /> Copiar
          </button>
        </div>
      </section>

      <div className="space-y-5">
        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-200">Importar backup</h2>
          <button onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-2 rounded-xl border border-dashed border-gray-700 bg-gray-950/50 p-6 text-center transition-colors hover:border-violet-600">
            <FileUp className="h-7 w-7 text-gray-600" />
            <span className="text-sm font-medium text-gray-300">Selecionar arquivo</span>
            <span className="text-xs text-gray-600">Substitui seu planejamento atual</span>
          </button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} />
        </section>

        <section className="rounded-2xl border border-gray-800 bg-gray-900 p-5">
          <h2 className="mb-3 text-sm font-bold text-gray-200">Histórico de backups</h2>
          {backups.length === 0 ? (
            <p className="text-xs text-gray-600">Nenhum backup ainda.</p>
          ) : (
            <ul className="space-y-2">
              {backups.map((b, i) => (
                <li key={i} className="flex items-center gap-2 text-xs">
                  <Upload className="h-3.5 w-3.5 text-gray-600" />
                  <span className="flex-1 truncate text-gray-300">{b.name}</span>
                  <span className="shrink-0 text-gray-600">{(b.size / 1024).toFixed(1)} KB</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── Danger Zone ─────────────────────────────────────────────────────────── */

function DangerTab({ configured, refresh, onReset, flash }: {
  configured: Platform[];
  refresh: () => void;
  onReset: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 rounded-xl border border-red-900/40 bg-red-950/30 px-4 py-3 text-sm text-red-300">
        <AlertTriangle className="h-5 w-5 shrink-0" />
        Atenção: ações irreversíveis. Recomendamos fazer um backup antes de continuar.
      </div>

      <DangerCard icon={RotateCcw} title="Resetar planejamento" description="Remove todo o backlog, jogos fixados, dropados, notas, esforços e agendamentos."
        keyword="RESETAR" onConfirm={async () => { await resetPlanning('all'); refresh(); flash('ok', 'Planejamento resetado.'); }} />

      <DangerCard icon={StickyNote} title="Remover notas pessoais" description="Apaga apenas as notas pessoais de todos os jogos. O resto do planejamento é mantido."
        keyword="NOTAS" onConfirm={async () => { await resetPlanning('notes'); refresh(); flash('ok', 'Notas removidas.'); }} />

      <DangerCard icon={Trash2} title="Limpar cache de sincronização" description="Apaga as imagens locais (capas, ícones, conquistas). Elas são baixadas novamente quando necessário."
        keyword="CACHE" onConfirm={async () => { await clearMediaCache(); flash('ok', 'Cache de mídia limpo.'); }} />

      <DangerCard icon={Unplug} title="Desconectar todas as plataformas" description="Remove todas as credenciais e volta para a configuração inicial."
        keyword="DESCONECTAR" onConfirm={async () => {
          await Promise.all(configured.map((p) => deletePlatformConfig(p)));
          window.dispatchEvent(new Event('zenkuri-config-updated'));
          flash('ok', 'Plataformas desconectadas.');
          onReset();
        }} />

      <p className="flex items-center gap-1.5 px-1 text-xs text-gray-600">
        <Link2 className="h-3 w-3" /> Em caso de dúvidas, exporte seus dados antes de qualquer ação destrutiva.
      </p>
    </div>
  );
}

function DangerCard({ icon: Icon, title, description, keyword, onConfirm }: {
  icon: typeof RotateCcw;
  title: string;
  description: string;
  keyword: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const armed = value.trim().toUpperCase() === keyword;
  return (
    <div className="flex flex-col gap-3 rounded-2xl border border-red-900/30 bg-red-950/15 p-4 sm:flex-row sm:items-center">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-red-900/30 text-red-300"><Icon className="h-5 w-5" /></span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-gray-100">{title}</p>
        <p className="mt-0.5 text-xs text-gray-500">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <input value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Digite ${keyword}`}
          className="w-32 rounded-lg border border-gray-800 bg-gray-950 px-3 py-2 text-xs text-gray-200 placeholder-gray-600 focus:border-red-600 focus:outline-none" />
        <button disabled={!armed} onClick={() => { onConfirm(); setValue(''); }}
          className="rounded-lg bg-red-600 px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-500 disabled:cursor-not-allowed disabled:opacity-40">
          Confirmar
        </button>
      </div>
    </div>
  );
}
