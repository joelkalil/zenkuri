import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useSteam } from '../context/SteamContext';
import { useAuth } from '../context/AuthContext';
import { THEMES, useTheme } from '../context/ThemeContext';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { THEME_KEYS } from '../components/themeLabels';
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

const TABS = ['account', 'level', 'connections', 'sync', 'export', 'danger'] as const;
type Tab = (typeof TABS)[number];

/** Sheet row: label on the left, control on the right. */
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

/** Relative time of an ISO timestamp ("5 min ago"), or "never" when missing. */
function useRelativeTime() {
  const { t, formatRelative } = useI18n();
  return (iso?: string | null): string => (iso ? formatRelative(new Date(iso).getTime()) : t('settings.time.never'));
}

function lsBool(key: string, fallback: boolean) {
  const raw = localStorage.getItem(key);
  return raw === null ? fallback : raw === 'true';
}

export default function Settings({ onReset, onConfigured }: SettingsProps) {
  const { sync, scanning, overallPercent, error: syncError } = useSteam();
  const { t } = useI18n();
  const { db, refresh, exportDb } = useLocalDb();

  const [params, setParams] = useSearchParams();
  const requested = params.get('tab');
  const tab: Tab = TABS.find((key) => key === requested) ?? 'connections';
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

  const toastRef = useRef<HTMLParagraphElement>(null);

  // On small screens the toast sits above the fold when a form far down the page fails.
  useEffect(() => {
    if (toast) toastRef.current?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [toast]);

  const flash = useCallback((kind: 'ok' | 'err', text: string) => {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 3500);
  }, []);

  // The Steam key (or PSN NPSSO) can become invalid without notice; changing
  // the platform password is the most common cause. It already shows in the
  // sync history below, but the toast makes sure the user sees it right away,
  // not only whoever opens the Sync tab.
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
          <h1 className="page-title">{t('settings.title')}</h1>
          <p className="page-desc">{t('settings.description')}</p>
        </div>
      </header>

      <div className="settings-layout">
        <nav className="settings-nav" aria-label={t('settings.navLabel')}>
          {TABS.map((key) => (
            <button key={key} onClick={() => setTab(key)} aria-current={tab === key ? 'page' : undefined}
              className={`settings-nav-item ${key === 'danger' ? 'is-danger' : ''}`}>
              {t(`settings.tabs.${key}.label`)}
              <span className="settings-nav-hint">{t(`settings.tabs.${key}.hint`)}</span>
            </button>
          ))}
        </nav>

        <div className="min-w-0">
          <h2 className="mb-5 font-display text-2xl font-bold text-gray-100">{t(`settings.tabs.${tab}.label`)}</h2>
          {toast && <p ref={toastRef} role="status" className="aj-toast" data-kind={toast.kind}>{toast.text}</p>}
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
                // The error toast (invalid key etc.) comes from the effect above, tied
                // to the context's `syncError`; here we only confirm real success.
                sync().then((ok) => { if (ok) flash('ok', t('settings.sync.done')); });
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

/* ── Level ───────────────────────────────────────────────────────────────── */

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

/* ── Account ───────────────────────────────────────────────────────────────── */

function AccountTab({ flash }: { flash: (k: 'ok' | 'err', t: string) => void }) {
  const { user, logout, setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const { t } = useI18n();
  const describe = useErrorMessage();
  const [displayName, setDisplayName] = useState(user?.displayName ?? '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [savingName, setSavingName] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  async function saveName() {
    if (!displayName.trim()) return flash('err', t('settings.account.displayNameRequired'));
    setSavingName(true);
    try {
      const res = await authUpdateProfile({ displayName: displayName.trim() });
      setUser(res.user);
      flash('ok', t('settings.account.profileUpdated'));
    } catch (err) {
      flash('err', describe(err, 'settings.account.profileFailed'));
    } finally {
      setSavingName(false);
    }
  }

  async function savePassword() {
    if (newPassword.length < 6) return flash('err', t('settings.account.passwordTooShort'));
    if (newPassword !== confirmPassword) return flash('err', t('settings.account.passwordMismatch'));
    setSavingPassword(true);
    try {
      await authChangePassword({ currentPassword, newPassword });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      flash('ok', t('settings.account.passwordChanged'));
    } catch (err) {
      flash('err', describe(err, 'settings.account.passwordFailed'));
    } finally {
      setSavingPassword(false);
    }
  }

  return (
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title={t('settings.account.profile')} />
        <Row label={t('settings.account.username')} htmlFor="aj-username">
          <input id="aj-username" value={user?.username ?? ''} disabled className="field opacity-60" />
        </Row>
        <Row label={t('settings.account.displayName')} htmlFor="aj-display">
          <input id="aj-display" value={displayName} onChange={(e) => setDisplayName(e.target.value)} className="field" />
          <button onClick={saveName} disabled={savingName} className="btn btn-primary btn-sm">
            <Busy busy={savingName} /> {t('settings.account.saveProfile')}
          </button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title={t('settings.account.appearance')} />
        <Row label={t('settings.account.theme')} hint={t('settings.account.themeHint')}>
          <div role="radiogroup" aria-label={t('settings.account.theme')} className="flex flex-wrap gap-x-6 gap-y-1">
            {THEMES.map((item) => (
              <label key={item.id} className="radio-row">
                <input type="radio" name="theme" value={item.id} checked={theme === item.id} onChange={() => setTheme(item.id)} />
                <span>
                  {t(THEME_KEYS[item.id].label)}
                  <span className="ml-2 text-xs text-gray-500">{t(THEME_KEYS[item.id].description)}</span>
                </span>
              </label>
            ))}
          </div>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title={t('settings.account.language')} />
        <Row label={t('settings.account.language')} hint={t('common.language.hint')}>
          <LanguageSwitcher />
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="04" title={t('settings.account.changePassword')} />
        <Row label={t('settings.account.currentPassword')} htmlFor="aj-pw-current">
          <input id="aj-pw-current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)}
            autoComplete="current-password" className="field" />
        </Row>
        <Row label={t('settings.account.newPassword')} hint={t('settings.account.newPasswordHint')} htmlFor="aj-pw-new">
          <input id="aj-pw-new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)}
            autoComplete="new-password" className="field" />
        </Row>
        <Row label={t('settings.account.confirmPassword')} htmlFor="aj-pw-confirm">
          <input id="aj-pw-confirm" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password" className="field" />
          <button onClick={savePassword} disabled={savingPassword} className="btn btn-primary btn-sm">
            <Busy busy={savingPassword} /> {t('settings.account.changePassword')}
          </button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="05" title={t('settings.account.session')} />
        <Row label={t('settings.account.signedInAs')} hint={t('settings.account.signedInHint')}>
          <span className="num text-sm text-gray-200">@{user?.username}</span>
          <button onClick={logout} className="btn btn-secondary btn-sm">{t('settings.account.logout')}</button>
        </Row>
      </section>
    </>
  );
}

/* ── Connections ────────────────────────────────────────────────────────────── */

function ConnectionsTab({ configured, credByPlatform, latest, onConfigured, flash }: {
  configured: Platform[];
  credByPlatform: Partial<Record<Platform, PublicCredential>>;
  latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }>;
  onConfigured: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const { t } = useI18n();
  const describe = useErrorMessage();
  const relativeTime = useRelativeTime();
  const [selected, setSelected] = useState<Platform>('steam');
  const [identifier, setIdentifier] = useState('');
  const [busy, setBusy] = useState(false);

  async function link() {
    setBusy(true);
    try {
      await linkPlatformAccount(selected, identifier.trim());
      await syncPlatform(selected);
      flash('ok', t('settings.connections.linked', { platform: PLATFORM_META[selected].label }));
      window.dispatchEvent(new Event('zenkuri-config-updated'));
      onConfigured();
    } catch (err) {
      flash('err', describe(err, 'settings.connections.linkFailed'));
    } finally {
      setBusy(false);
    }
  }

  async function disconnect(p: Platform) {
    await deletePlatformConfig(p);
    flash('ok', t('settings.connections.disconnected', { platform: PLATFORM_META[p].label }));
    window.dispatchEvent(new Event('zenkuri-config-updated'));
    onConfigured();
  }

  return (
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title={t('settings.connections.platforms')}
          action={<Link to="/tutoriais" className="btn btn-ghost btn-sm">{t('settings.connections.tutorialsIndex')}</Link>} />
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
                    {cred ? `${isConn ? t('settings.connections.connected') : t('settings.connections.incomplete')} · ${cred.identifier}` : t('settings.connections.notConnected')}
                  </p>
                  <p className="aj-hint">{t('settings.connections.lastSync')} <span className="num">{relativeTime(latest[p]?.startedAt)}</span></p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => { setSelected(p); setIdentifier(''); }}
                    className="btn btn-secondary btn-sm"
                  >
                    {isConn ? t('settings.connections.reconnect') : cred ? t('settings.connections.continue') : t('settings.connections.link')}
                    <span className="sr-only"> {meta.label}</span>
                  </button>
                  {isConn && (
                    <button onClick={() => disconnect(p)} className="btn btn-danger btn-sm">
                      {t('settings.connections.disconnect')}<span className="sr-only"> {meta.label}</span>
                    </button>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title={t('settings.connections.linkAccount')} />
        <Row label={t('settings.connections.platform')}>
          <div className="segmented" role="group" aria-label={t('settings.connections.platformToLink')}>
            {PLATFORMS.map((p) => (
              <button key={p} aria-pressed={selected === p} onClick={() => { setSelected(p); setIdentifier(''); }}>
                <img src={PLATFORM_META[p].logo} alt="" className="h-3.5 w-3.5 object-contain" />{PLATFORM_META[p].short}
              </button>
            ))}
          </div>
        </Row>
        <Row label={t(`settings.connections.identifiers.${selected}.label`)} hint={t('settings.connections.publicOnly')} htmlFor="aj-identifier">
          <input id="aj-identifier" type="text" value={identifier} onChange={(e) => setIdentifier(e.target.value)}
            placeholder={t(`settings.connections.identifiers.${selected}.placeholder`)} className="field" />
          <button onClick={link} disabled={busy || !identifier.trim()} className="btn btn-primary btn-sm">
            <Busy busy={busy} /> {t('settings.connections.link')}
          </button>
          <Link to={`/tutoriais#${selected}`} className="btn btn-ghost btn-sm">
            {t('settings.connections.tutorialLink', { platform: PLATFORM_META[selected].short })}
          </Link>
        </Row>
      </section>
    </>
  );
}

/* ── Sync ───────────────────────────────────────────────────────── */

function SyncTab({ configured, runs, latest, scanning, overallPercent, onSync }: {
  configured: Platform[];
  runs: SyncRun[];
  latest: Record<string, { startedAt: string; status: string; finishedAt: string | null }>;
  scanning: boolean;
  overallPercent: number;
  onSync: () => void;
}) {
  const { t } = useI18n();
  const relativeTime = useRelativeTime();
  const [autoSync, setAutoSync] = useState(() => lsBool('zenkuri-autosync', false));
  const [syncOnStart, setSyncOnStart] = useState(() => lsBool('zenkuri-synconstart', false));
  const [interval, setIntervalValue] = useState(() => localStorage.getItem('zenkuri-syncinterval') ?? '30');

  useEffect(() => { localStorage.setItem('zenkuri-autosync', String(autoSync)); }, [autoSync]);
  useEffect(() => { localStorage.setItem('zenkuri-synconstart', String(syncOnStart)); }, [syncOnStart]);
  useEffect(() => { localStorage.setItem('zenkuri-syncinterval', interval); }, [interval]);

  return (
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title={t('settings.sync.schedule')} />
        <Row label={t('settings.sync.auto')} hint={t('settings.sync.autoHint')}>
          <Switch checked={autoSync} onChange={setAutoSync} />
        </Row>
        <Row label={t('settings.sync.onStart')} hint={t('settings.sync.onStartHint')}>
          <Switch checked={syncOnStart} onChange={setSyncOnStart} />
        </Row>
        <Row label={t('settings.sync.interval')} hint={t('settings.sync.intervalHint')} htmlFor="aj-interval">
          <select id="aj-interval" value={interval} onChange={(e) => setIntervalValue(e.target.value)} disabled={!autoSync} className="field disabled:opacity-40">
            <option value="15">{t('settings.sync.every15')}</option>
            <option value="30">{t('settings.sync.every30')}</option>
            <option value="60">{t('settings.sync.every60')}</option>
            <option value="360">{t('settings.sync.every360')}</option>
          </select>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title={t('settings.sync.manual')} />
        <Row label={t('settings.sync.syncNow')} hint={t('settings.sync.syncNowHint')}>
          <button onClick={onSync} disabled={scanning} className="btn btn-primary btn-sm">
            <Busy busy={scanning} /> {scanning ? t('settings.sync.syncing') : t('settings.sync.syncNow')}
          </button>
          <div className="w-full max-w-sm">
            <div className="mb-1 flex justify-between text-xs text-gray-500">
              <span>{t('settings.sync.overallProgress')}</span><span className="num">{overallPercent}%</span>
            </div>
            <div className="aj-progress" role="progressbar" aria-label={t('settings.sync.overallProgressLabel')} aria-valuenow={overallPercent} aria-valuemin={0} aria-valuemax={100}>
              <div style={{ width: `${overallPercent}%` }} />
            </div>
          </div>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title={t('settings.sync.status')} />
        <table className="aj-table">
          <thead className="sr-only"><tr><th>{t('settings.sync.colPlatform')}</th><th>{t('settings.sync.colLastSync')}</th><th>{t('settings.sync.colState')}</th></tr></thead>
          <tbody>
            {PLATFORMS.map((p) => {
              const isConn = configured.includes(p);
              const st = latest[p];
              const state = !isConn ? t('settings.sync.stateDisconnected') : st?.status === 'error' ? t('settings.sync.stateError') : t('settings.sync.stateOk');
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
        <SectionHead className="sh-wrap" number="04" title={t('settings.sync.history')} />
        {runs.length === 0 ? (
          <p className="text-sm text-gray-500">{t('settings.sync.historyEmpty')}</p>
        ) : (
          <table className="aj-table">
            <thead className="sr-only"><tr><th>{t('settings.sync.colState')}</th><th>{t('settings.sync.colPlatform')}</th><th>{t('settings.sync.colMessage')}</th><th>{t('settings.sync.colWhen')}</th></tr></thead>
            <tbody>
              {runs.slice(0, 8).map((r) => (
                <tr key={r.id}>
                  <td className="w-6"><span className="aj-status-dot inline-block" data-tone={r.status === 'error' ? 'error' : r.status === 'running' ? 'run' : 'ok'} title={r.status === 'error' ? t('settings.sync.stateError') : r.status === 'running' ? t('settings.sync.syncing') : t('settings.sync.stateOk')} /></td>
                  <td className="w-20 font-medium text-gray-200">{PLATFORM_META[r.platform]?.short ?? r.platform}</td>
                  <td className="text-gray-500" title={r.message ?? undefined}>{r.status === 'error' ? t('settings.sync.stateError') : r.status === 'running' ? t('settings.sync.syncing') : t('settings.sync.stateOk')}</td>
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

/* ── Export ────────────────────────────────────────────────────────────── */

interface BackupEntry { name: string; date: string; size: number; }

function ExportTab({ db, refresh, exportDb, flash }: {
  db: ReturnType<typeof useLocalDb>['db'];
  refresh: () => void;
  exportDb: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const { t, formatNumber } = useI18n();
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

  function handleExport() { exportDb(); recordBackup(); flash('ok', t('settings.export.exported')); }
  function handleCopy() { navigator.clipboard.writeText(json).then(() => flash('ok', t('settings.export.copied'))); }

  function handleImport(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    file.text().then((text) => {
      const data = JSON.parse(text);
      return importPlanning(data);
    }).then(() => { refresh(); flash('ok', t('settings.export.imported')); }).catch(() => flash('err', t('settings.export.invalidFile')));
    e.target.value = '';
  }

  return (
    <>
      <section className="aj-section">
        <SectionHead className="sh-wrap" number="01" title={t('settings.export.exportTitle')} />
        <Row label={t('settings.export.notes')}><Switch checked={includeNotes} onChange={setIncludeNotes} /><span className="text-sm text-gray-400">{includeNotes ? t('settings.export.included') : t('settings.export.excluded')}</span></Row>
        <Row label={t('settings.export.guides')}><Switch checked={includeGuides} onChange={setIncludeGuides} /><span className="text-sm text-gray-400">{includeGuides ? t('settings.export.includedPlural') : t('settings.export.excluded')}</span></Row>
        <Row label={t('settings.export.preview')}>
          <pre className="max-h-64 w-full overflow-auto rounded border border-gray-800 bg-gray-900 p-3 font-mono text-xs leading-relaxed text-gray-400">{json}</pre>
        </Row>
        <Row label={t('settings.export.download')}>
          <button onClick={handleExport} className="btn btn-primary btn-sm">{t('settings.export.exportJson')}</button>
          <button onClick={handleCopy} className="btn btn-secondary btn-sm">{t('settings.export.copy')}</button>
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="02" title={t('settings.export.importTitle')} />
        <Row label={t('settings.export.file')} hint={t('settings.export.fileHint')}>
          <button onClick={() => fileRef.current?.click()} className="btn btn-secondary btn-sm">{t('settings.export.chooseFile')}</button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden" onChange={handleImport} aria-label={t('settings.export.fileLabel')} />
        </Row>
      </section>

      <section className="aj-section">
        <SectionHead className="sh-wrap" number="03" title={t('settings.export.historyTitle')} />
        {backups.length === 0 ? (
          <p className="text-sm text-gray-500">{t('settings.export.historyEmpty')}</p>
        ) : (
          <table className="aj-table">
            <thead className="sr-only"><tr><th>{t('settings.export.colFile')}</th><th>{t('settings.export.colSize')}</th></tr></thead>
            <tbody>
              {backups.map((b, i) => (
                <tr key={i}>
                  <td className="num text-gray-200">{b.name}</td>
                  <td className="num text-right text-gray-500">{formatNumber(b.size / 1024, { minimumFractionDigits: 1, maximumFractionDigits: 1 })} KB</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </>
  );
}

/* ── Danger zone ───────────────────────────────────────────────────────── */

function DangerTab({ configured, refresh, onReset, flash }: {
  configured: Platform[];
  refresh: () => void;
  onReset: () => void;
  flash: (k: 'ok' | 'err', t: string) => void;
}) {
  const { t } = useI18n();

  return (
    <section className="aj-section aj-danger">
      <p className="text-sm text-zk-danger">
        <strong>{t('settings.danger.warning')}</strong> {t('settings.danger.warningText')}
      </p>

      <DangerCard title={t('settings.danger.reset.title')} description={t('settings.danger.reset.description')}
        keyword={t('settings.danger.reset.keyword')} onConfirm={async () => { await resetPlanning('all'); refresh(); flash('ok', t('settings.danger.reset.done')); }} />

      <DangerCard title={t('settings.danger.notes.title')} description={t('settings.danger.notes.description')}
        keyword={t('settings.danger.notes.keyword')} onConfirm={async () => { await resetPlanning('notes'); refresh(); flash('ok', t('settings.danger.notes.done')); }} />

      <DangerCard title={t('settings.danger.cache.title')} description={t('settings.danger.cache.description')}
        keyword={t('settings.danger.cache.keyword')} onConfirm={async () => { await clearMediaCache(); flash('ok', t('settings.danger.cache.done')); }} />

      <DangerCard title={t('settings.danger.disconnectAll.title')} description={t('settings.danger.disconnectAll.description')}
        keyword={t('settings.danger.disconnectAll.keyword')} onConfirm={async () => {
          await Promise.all(configured.map((p) => deletePlatformConfig(p)));
          window.dispatchEvent(new Event('zenkuri-config-updated'));
          flash('ok', t('settings.danger.disconnectAll.done'));
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
  const { t } = useI18n();
  const [value, setValue] = useState('');
  const armed = value.trim().toUpperCase() === keyword.toUpperCase();
  const inputId = `danger-${keyword}`;
  return (
    <div className="aj-danger-row">
      <div className="min-w-0">
        <p className="aj-label">{title}</p>
        <p className="aj-hint">{description}</p>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <label htmlFor={inputId} className="sr-only">{t('settings.danger.typeToConfirm', { keyword })}</label>
        <input id={inputId} value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('settings.danger.typePlaceholder', { keyword })} className="field w-40" />
        <button disabled={!armed} onClick={() => { onConfirm(); setValue(''); }} className="btn btn-danger btn-sm">
          {t('settings.danger.confirm')}
        </button>
      </div>
    </div>
  );
}
