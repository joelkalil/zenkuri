import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useAuth } from '../context/AuthContext';
import { THEMES, useTheme } from '../context/ThemeContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { Switch } from '../components/Switch';
import { SectionHead } from '../components/SectionHead';
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
import '../styles/ajustes.css';

interface SettingsProps {
  onReset: () => void;
  onConfigured: () => void;
}

const TABS = [
  { key: 'account', label: 'Conta', hint: 'Nome, aparência, senha e sessão' },
  { key: 'level', label: 'Nível', hint: 'XP e níveis das plataformas' },
  { key: 'connections', label: 'Conexões', hint: 'Steam, PSN e RetroAchievements' },
  { key: 'sync', label: 'Sincronização', hint: 'Agendamento e histórico' },
  { key: 'export', label: 'Exportar', hint: 'Backup e importação' },
  { key: 'danger', label: 'Zona de risco', hint: 'Desconectar e apagar dados' },
] as const;
type Tab = (typeof TABS)[number]['key'];

/** Linha de ficha: rótulo à esquerda, controle à direita. */
function Row({ label, hint, htmlFor, children }: { label: string; hint?: string; htmlFor?: string; children: ReactNode }) {
  return (
    <div className="aj-row">
      <div>
        {htmlFor ? <label htmlFor={htmlFor} className="aj-label">{label}</label> : <p className="aj-label">{label}</p>}
        {hint && <p className="aj-hint">{hint}</p>}
      </div>
      <div className="aj-control">{children}</div>
    </div>
  );
}

function Busy({ busy }: { busy: boolean }) {
  return busy ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null;
}

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
          <p className="page-desc">Conexões, sincronização e seus dados locais de planejamento.</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label="Seções dos ajustes">
          {TABS.map((t) => (
            <button key={t.key} onClick={() => setTab(t.key)} aria-current={tab === t.key ? 'page' : undefined}
              className={`settings-nav-item ${t.key === 'danger' ? 'is-danger' : ''}`}>
              {t.label}
              <span className="settings-nav-hint">{t.hint}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <h2 className="mb-5 font-display text-2xl font-bold text-gray-100">{TABS.find((t) => t.key === tab)?.label}</h2>
          {toast && <p role="status" className="aj-toast" data-kind={toast.kind}>{toast.text}</p>}
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
                // ao `syncError` do contexto; aqui só confirmamos o sucesso real.
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
        <p className="text-sm text-zk-danger">{error}</p>
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
  const { theme, setTheme } = useTheme();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

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
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title="Perfil" />
        <Row label="Usuário" htmlFor="aj-username">
          <input id="aj-username" value={user?.username ?? ''} disabled className="field opacity-60" />
        </Row>
        <Row label="Nome de exibição" htmlFor="aj-display">
          <input id="aj-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field" />
          <button onClick={saveName} disabled={savingName} className="btn btn-primary btn-sm">
            <Busy busy={savingName} /> Salvar perfil
          </button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title="Aparência" />
        <Row label="Tema" hint="Também disponível no menu do perfil.">
          <div role="radiogroup" aria-label="Tema" className="flex flex-wrap gap-x-6 gap-y-1">
            {THEMES.map((item) => (
              <label key={item.id} className="radio-row">
                <input type="radio" name="theme" value={item.id} checked={theme === item.id} onChange={() => setTheme(item.id)} />
                <span>
                  {item.label}
                  <span className="ml-2 text-xs text-gray-500">{item.description}</span>
                </span>
              </label>
            ))}
          </div>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title="Alterar senha" />
        <Row label="Senha atual" htmlFor="aj-pw-current">
          <input id="aj-pw-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password" className="field" />
        </Row>
        <Row label="Nova senha" hint="Mínimo de 6 caracteres." htmlFor="aj-pw-new">
          <input id="aj-pw-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password" className="field" />
        </Row>
        <Row label="Confirmar nova senha" htmlFor="aj-pw-confirm">
          <input id="aj-pw-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password" className="field" />
          <button onClick={savePassword} disabled={savingPassword} className="btn btn-primary btn-sm">
            <Busy busy={savingPassword} /> Alterar senha
          </button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="04" title="Sessão" />
        <Row label="Conectado como" hint="Conquistas, fila e contas de plataforma ficam associadas apenas a este usuário.">
          <span className="num text-sm text-gray-200">@{user?.username}</span>
          <button onClick={logout} className="btn btn-secondary btn-sm">Sair da conta</button>
        </Row>
      </section>
    </>
  );
}

/* ── Conexões ────────────────────────────────────────────────────────────── */

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
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title="Plataformas" />
        {PLATFORMS.map((p) => {
          const isConn = configured.includes(p);
          const meta = PLATFORM_META[p];
          const cred = credByPlatform[p];
          return (
            <div key={p} className="aj-row">
              <div className="flex items-center gap-3">
                <img src={meta.logo} alt="" className={`h-5 w-5 object-contain ${isConn ? '' : 'opacity-50 grayscale'}`} />
                <p className="aj-label">{meta.label}</p>
              </div>
              <div className="aj-control justify-between">
                <div>
                  <p className="aj-status">
                    <span className="aj-status-dot" data-tone={isConn ? 'ok' : undefined} aria-hidden="true" />
                    {cred ? `${isConn ? 'Conectado' : 'Vínculo incompleto'} · ${cred.identifier}` : 'Não conectado'}
                  </p>
                  <p className="aj-hint">Última sync: <span className="num">{relativeTime(latest[p]?.startedAt)}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelected(p); setIdentifier(''); }}
                    className="btn btn-secondary btn-sm"
                  >
                    {isConn ? 'Reconectar' : cred ? 'Continuar' : 'Vincular'}
                    <span className="sr-only"> {meta.label}</span>
                  </button>
                  {isConn && (
                    <button onClick={() => disconnect(p)} className="btn btn-danger btn-sm">
                      Desconectar<span className="sr-only"> {meta.label}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title="Vincular conta" />
        <Row label="Plataforma">
          <div className="segmented" role="group" aria-label="Plataforma a vincular">
            {PLATFORMS.map((p) => (
              <button key={p} aria-pressed={selected === p} onClick={() => { setSelected(p); setIdentifier(''); }}>
                <img src={PLATFORM_META[p].logo} alt="" className="h-3.5 w-3.5 object-contain" />{PLATFORM_META[p].short}
              </button>
            ))}
          </div>
        </Row>
        <Row label={IDENTIFIER_META[selected].label} hint="Só lemos dados públicos do perfil, nunca senhas, tokens ou API keys." htmlFor="aj-identifier">
          <input id="aj-identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            placeholder={IDENTIFIER_META[selected].placeholder} className="field" />
          <button onClick={link} disabled={busy || !identifier.trim()} className="btn btn-primary btn-sm">
            <Busy busy={busy} /> Vincular
          </button>
        </Row>
      </section>
    </>
  );
}

/* ── Sincronização ───────────────────────────────────────────────────────── */

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
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title="Agendamento" />
        <Row label="Sincronização automática" hint="Sincroniza em segundo plano.">
          <Switch checked={autoSync} onChange={setAutoSync} />
        </Row>
        <Row label="Sincronizar ao abrir o app" hint="Roda uma sync assim que o app carrega.">
          <Switch checked={syncOnStart} onChange={setSyncOnStart} />
        </Row>
        <Row label="Intervalo" hint="Vale quando a sincronização automática está ligada." htmlFor="aj-interval">
          <select id="aj-interval" value={interval} onChange={(e) => setIntervalValue(e.target.value)} disabled={!autoSync} className="field disabled:opacity-40">
            <option value="15">A cada 15 minutos</option>
            <option value="30">A cada 30 minutos</option>
            <option value="60">A cada 1 hora</option>
            <option value="360">A cada 6 horas</option>
          </select>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title="Sincronização manual" />
        <Row label="Sincronizar agora" hint="Todas as plataformas conectadas.">
          <button onClick={onSync} disabled={scanning} className="btn btn-primary btn-sm">
            <Busy busy={scanning} /> {scanning ? 'Sincronizando…' : 'Sincronizar agora'}
          </button>
          <div className="w-full max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>Progresso geral</span><span className="num">{overallPercent}%</span>
            </div>
            <div className="aj-progress" role="progressbar" aria-label="Progresso geral da sincronização" aria-valuenow={overallPercent} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title="Status por plataforma" />
        <table className="aj-table">
          <thead className="sr-only"><tr><th>Plataforma</th><th>Última sync</th><th>Estado</th></tr></thead>
          <tbody>
            {PLATFORMS.map((p) => {
              const isConn = configured.includes(p);
              const st = latest[p];
              const state = !isConn ? 'não conectada' : st?.status === 'error' ? 'com erro' : 'ok';
              return (
                <tr key={p}>
                  <td className="w-8"><img src={PLATFORM_META[p].logo} alt="" className={`h-4 w-4 object-contain ${isConn ? '' : 'opacity-40 grayscale'}`} /></td>
                  <td className="text-gray-200">{PLATFORM_META[p].label}</td>
                  <td className="num text-gray-500">{relativeTime(st?.startedAt)}</td>
                  <td className="text-right">
                    <span className="aj-status"><span className="aj-status-dot" data-tone={!isConn ? undefined : st?.status === 'error' ? 'error' : 'ok'} aria-hidden="true" />{state}</span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="04" title="Histórico" />
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhuma sincronização ainda.</p>
        ) : (
          <table className="aj-table">
            <thead className="sr-only"><tr><th>Estado</th><th>Plataforma</th><th>Mensagem</th><th>Quando</th></tr></thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className="w-6"><span className="aj-status-dot inline-block" data-tone={r.status === 'error' ? 'error' : r.status === 'running' ? 'run' : 'ok'} title={r.status} /></td>
                  <td className="w-20 font-medium text-gray-200">{PLATFORM_META[r.platform]?.short ?? r.platform}</td>
                  <td className="text-gray-500">{r.message ?? r.status}</td>
                  <td className="num whitespace-nowrap text-right text-xs text-gray-500">{relativeTime(r.startedAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ── Exportar ────────────────────────────────────────────────────────────── */

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
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title="Exportar seu planejamento" />
        <Row label="Notas pessoais"><Switch checked={includeNotes} onChange={setIncludeNotes} /><span className="text-sm text-gray-400">{includeNotes ? 'Incluídas' : 'Fora do backup'}</span></Row>
        <Row label="Links de guia"><Switch checked={includeGuides} onChange={setIncludeGuides} /><span className="text-sm text-gray-400">{includeGuides ? 'Incluídos' : 'Fora do backup'}</span></Row>
        <Row label="Prévia dos dados">
          <pre className="max-h-64 w-full overflow-auto rounded border border-gray-800 bg-gray-900 p-3 font-mono text-xs leading-relaxed text-gray-400">{json}</pre>
        </Row>
        <Row label="Baixar">
          <button onClick={handleExport} className="btn btn-primary btn-sm">Exportar JSON</button>
          <button onClick={handleCopy} className="btn btn-secondary btn-sm">Copiar</button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title="Importar backup" />
        <Row label="Arquivo" hint="Substitui seu planejamento atual.">
          <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm">Selecionar arquivo</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} aria-label="Arquivo de backup" />
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title="Histórico de backups" />
        {backups.length === 0 ? (
          <p className="text-sm text-gray-500">Nenhum backup ainda.</p>
        ) : (
          <table className="aj-table">
            <thead className="sr-only"><tr><th>Arquivo</th><th>Tamanho</th></tr></thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={i}>
                  <td className="num text-gray-200">{b.name}</td>
                  <td className="num text-right text-gray-500">{(b.size / 1024).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ── Zona de risco ───────────────────────────────────────────────────────── */

function DangerTab({ configured, refresh, onReset, flash }: {
  configured: Platform[];
  refresh: () => void;
  onReset: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  return (
    <section className="aj-section aj-danger">
      <p className="text-sm text-zk-danger">
        <strong>Atenção:</strong> ações irreversíveis. Exporte um backup antes de continuar.
      </p>

      <DangerCard title="Resetar planejamento" description="Remove toda a fila, jogos fixados, abandonados, notas, esforços e agendamentos."
        keyword="RESETAR" onConfirm={async () => { await resetPlanning('all'); refresh(); flash('ok', 'Planejamento resetado.'); }} />

      <DangerCard title="Remover notas pessoais" description="Apaga apenas as notas pessoais de todos os jogos. O resto do planejamento é mantido."
        keyword="NOTAS" onConfirm={async () => { await resetPlanning('notes'); refresh(); flash('ok', 'Notas removidas.'); }} />

      <DangerCard title="Limpar cache de sincronização" description="Apaga as imagens locais (capas, ícones, conquistas). Elas são baixadas novamente quando necessário."
        keyword="CACHE" onConfirm={async () => { await clearMediaCache(); flash('ok', 'Cache de mídia limpo.'); }} />

      <DangerCard title="Desconectar todas as plataformas" description="Remove todas as credenciais e volta para a configuração inicial."
        keyword="DESCONECTAR" onConfirm={async () => {
          await Promise.all(configured.map((p) => deletePlatformConfig(p)));
          window.dispatchEvent(new Event('zenkuri-config-updated'));
          flash('ok', 'Plataformas desconectadas.');
          onReset();
        }} />
    </section>
  );
}

function DangerCard({ title, description, keyword, onConfirm }: {
  title: string;
  description: string;
  keyword: string;
  onConfirm: () => void | Promise<void>;
}) {
  const [value, setValue] = useState('');
  const armed = value.trim().toUpperCase() === keyword;
  const inputId = `danger-${keyword}`;
  return (
    <div className="aj-danger-row">
      <div className="min-w-0">
        <p className="aj-label">{title}</p>
        <p className="aj-hint">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label htmlFor={inputId} className="sr-only">Digite {keyword} para confirmar</label>
        <input id={inputId} value={value} onChange={(e) => setValue(e.target.value)} placeholder={`Digite ${keyword}`} className="field w-40" />
        <button disabled={!armed} onClick={() => { onConfirm(); setValue(''); }} className="btn btn-danger btn-sm">
          Confirmar
        </button>
      </div>
    </div>
  );
}
