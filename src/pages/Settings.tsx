import { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlertTriangle, CheckCircle2, Copy, Download, FileUp, KeyRound, Link2, Loader2,
  RefreshCw, RotateCcw, StickyNote, Trash2, Unplug, Upload,
} from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useLocalDb } from '../hooks/useLocalDb';
import { Switch } from '../components/Switch';
import { PLATFORM_META } from '../lib/platforms';
import {
  clearMediaCache, deletePlatformConfig, fetchSyncRuns, getConfig, importPlanning,
  resetPlanning, savePsnConfig, saveRetroAchievementsConfig, saveSteamConfig, syncPlatform,
  type PublicCredential, type SyncRun,
} from '../lib/api';
import type { Platform } from '../types/steam';

interface SettingsProps {
  onReset: () => void;
  onConfigured: () => void;
}

const TABS = [
  { key: 'connections', label: 'Connections' },
  { key: 'sync', label: 'Sync' },
  { key: 'export', label: 'Export' },
  { key: 'danger', label: 'Danger Zone' },
] as const;
type Tab = (typeof TABS)[number]['key'];

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
  const { sync, scanning, overallPercent } = useSteam();
  const { db, refresh, exportDb } = useLocalDb();

  const [tab, setTab] = useState<Tab>('connections');
  const [credentials, setCredentials] = useState<PublicCredential[]>([]);
  const [configured, setConfigured] = useState<Platform[]>([]);
  const [runs, setRuns] = useState<SyncRun[]>([]);
  const [latest, setLatest] = useState<Record<string, { startedAt: string; status: string; finishedAt: string | null }>>({});
  const [toast, setToast] = useState<{ kind: 'ok' | 'err'; text: string } | null>(null);

  function flash(kind: 'ok' | 'err', text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }

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
    <div className="p-6 lg:p-8 max-w-[1400px] mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-100">Settings</h1>
        <p className="mt-1 text-sm text-gray-500">Gerencie conexões, sincronização e seus dados locais de planejamento</p>
      </div>

      <div className="mb-6 flex gap-1 border-b border-gray-800">
        {TABS.map((t) => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`relative px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t.key ? 'text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
            {t.label}
            {tab === t.key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-violet-400" />}
          </button>
        ))}
      </div>

      {toast && (
        <p className={`mb-4 rounded-lg border px-3 py-2 text-xs ${toast.kind === 'err' ? 'border-red-800/30 bg-red-900/20 text-red-300' : 'border-emerald-800/30 bg-emerald-900/20 text-emerald-300'}`}>
          {toast.text}
        </p>
      )}

      {tab === 'connections' && (
        <ConnectionsTab
          configured={configured} credByPlatform={credByPlatform} latest={latest}
          onConfigured={() => { refreshConfig(); onConfigured(); }} flash={flash}
        />
      )}
      {tab === 'sync' && (
        <SyncTab configured={configured} runs={runs} latest={latest} scanning={scanning} overallPercent={overallPercent}
          onSync={() => { sync(); flash('ok', 'Sincronização iniciada.'); setTimeout(refreshConfig, 1500); }} />
      )}
      {tab === 'export' && <ExportTab db={db} refresh={refresh} exportDb={exportDb} flash={flash} />}
      {tab === 'danger' && (
        <DangerTab configured={configured} refresh={refresh} onReset={onReset} flash={flash} />
      )}
    </div>
  );
}

/* ── Connections ─────────────────────────────────────────────────────────── */

function ConnectionsTab({ configured, credByPlatform, latest, onConfigured, flash }: {
  configured: Platform[];
  credByPlatform: Partial<Record<Platform, PublicCredential>>;
  latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }>;
  onConfigured: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const [selected, setSelected] = useState<Platform>('steam');
  const [steamKey, setSteamKey] = useState('');
  const [steamId, setSteamId] = useState('');
  const [raUsername, setRaUsername] = useState('');
  const [raKey, setRaKey] = useState('');
  const [npsso, setNpsso] = useState('');
  const [busy, setBusy] = useState(false);

  function accountLabel(p: Platform) {
    const c = credByPlatform[p];
    if (!c) return 'Não conectado';
    if (p === 'steam') return `Conectado · ${c.steamid ?? ''}`;
    if (p === 'retroachievements') return `Conectado como ${c.username ?? ''}`;
    return 'Conectado';
  }

  async function save() {
    setBusy(true);
    try {
      if (selected === 'steam') {
        if (!steamKey.trim()) throw new Error('A API Key da Steam é obrigatória.');
        if (!/^\d{17}$/.test(steamId.trim())) throw new Error('O Steam ID deve ter 17 dígitos.');
        await saveSteamConfig({ key: steamKey.trim(), steamid: steamId.trim() });
      } else if (selected === 'retroachievements') {
        await saveRetroAchievementsConfig({ username: raUsername.trim(), webApiKey: raKey.trim() });
      } else {
        await savePsnConfig({ npsso: npsso.trim() });
      }
      await syncPlatform(selected);
      flash('ok', `${PLATFORM_META[selected].label} salvo e sincronizado.`);
      window.dispatchEvent(new Event('zenkuri-config-updated'));
      onConfigured();
    } catch (err) {
      flash('err', err instanceof Error ? err.message : 'Falha ao salvar.');
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
                <button onClick={() => { setSelected(p); }}
                  className="shrink-0 rounded-lg border border-gray-700 px-3 py-1.5 text-xs font-semibold text-gray-300 transition-colors hover:border-violet-600 hover:text-violet-200">
                  Reconectar
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

        <h2 className="mb-3 mt-6 flex items-center gap-2 text-sm font-bold text-gray-200"><KeyRound className="h-4 w-4 text-violet-300" /> Credenciais de API</h2>
        <div className="rounded-xl border border-gray-800 bg-gray-950/50 p-4">
          <div className="mb-3 flex gap-1">
            {PLATFORMS.map((p) => (
              <button key={p} onClick={() => setSelected(p)}
                className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors ${selected === p ? 'bg-violet-600/25 text-violet-200' : 'text-gray-500 hover:text-gray-300'}`}>
                <img src={PLATFORM_META[p].logo} alt="" className="h-3.5 w-3.5 object-contain" />{PLATFORM_META[p].short}
              </button>
            ))}
          </div>
          {selected === 'steam' && (
            <div className="space-y-2.5">
              <input type="password" value={steamKey} onChange={(e) => setSteamKey(e.target.value)} placeholder="Steam Web API Key"
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
              <input type="text" value={steamId} onChange={(e) => setSteamId(e.target.value)} placeholder="Steam ID (17 dígitos)"
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
          )}
          {selected === 'retroachievements' && (
            <div className="grid gap-2.5 sm:grid-cols-2">
              <input type="text" value={raUsername} onChange={(e) => setRaUsername(e.target.value)} placeholder="Usuário RA"
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
              <input type="password" value={raKey} onChange={(e) => setRaKey(e.target.value)} placeholder="RA Web API Key"
                className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
            </div>
          )}
          {selected === 'psn' && (
            <input type="password" value={npsso} onChange={(e) => setNpsso(e.target.value)} placeholder="Token NPSSO"
              className="w-full rounded-lg border border-gray-800 bg-gray-950 px-3 py-2.5 font-mono text-sm text-gray-200 placeholder-gray-600 focus:border-violet-500 focus:outline-none" />
          )}
          <button onClick={save} disabled={busy}
            className="mt-3 flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60">
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />} Salvar Chave
          </button>
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
          Suas credenciais ficam apenas no seu SQLite local e são usadas só pelo backend local.
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
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-violet-500 disabled:opacity-60">
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
          <button onClick={handleExport} className="flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-violet-500">
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
