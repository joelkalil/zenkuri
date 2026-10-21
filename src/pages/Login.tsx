import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useI18n } from '../i18n';
import { useErrorMessage } from '../i18n/useErrorMessage';
import '../styles/login.css';

const inputClass = 'field';
const labelClass = 'auth-label';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
  const { t } = useI18n();
  const describe = useErrorMessage();
  const [mode, setMode] = useState<Mode>('login');
  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  function switchMode(next: Mode) {
    setMode(next);
    setError('');
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError('');

    if (!username.trim()) return setError(t('auth.errors.usernameRequired'));
    if (!password) return setError(t('auth.errors.passwordRequired'));
    if (mode === 'register') {
      if (password.length < 6) return setError(t('auth.errors.passwordTooShort'));
      if (password !== confirm) return setError(t('auth.errors.passwordMismatch'));
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, displayName.trim() || undefined);
      }
    } catch (err) {
      setError(describe(err, 'auth.errors.generic'));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="auth-head">
          <Logo size={44} tagline={t('shell.logo.tagline')} />
          <h1 className="mt-6 text-2xl font-bold text-gray-50">
            {mode === 'login' ? t('auth.login.title') : t('auth.login.registerTitle')}
          </h1>
          <p className="auth-lede">
            {mode === 'login'
              ? t('auth.login.lede')
              : t('auth.login.registerLede')}
          </p>
        </div>

        <div className="subtabs mt-6 justify-center border-b border-gray-800" role="tablist" aria-label={t('auth.login.modeLabel')}>
          {([['login', t('auth.login.tabLogin')], ['register', t('auth.login.tabRegister')]] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => switchMode(value)} className="subtab px-2">
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass} htmlFor="auth-username">{t('auth.login.username')}</label>
            <input id="auth-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder={t('auth.login.usernamePlaceholder')} autoComplete="username" className={inputClass} />
          </div>

          {mode === 'register' && (
            <div>
              <label className={labelClass} htmlFor="auth-display">
                {t('auth.login.displayName')} <span className="font-normal text-gray-500">{t('auth.login.optional')}</span>
              </label>
              <input id="auth-display" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('auth.login.displayNamePlaceholder')} className={inputClass} />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="auth-password">{t('auth.login.password')}</label>
            <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? t('auth.login.passwordNewPlaceholder') : t('auth.login.passwordPlaceholder')}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} />
          </div>

          {mode === 'register' && (
            <div>
              <label className={labelClass} htmlFor="auth-confirm">{t('auth.login.confirm')}</label>
              <input id="auth-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder={t('auth.login.confirmPlaceholder')} autoComplete="new-password" className={inputClass} />
            </div>
          )}

          {error && (
            <p role="alert" className="auth-error">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg mt-2 w-full">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                {mode === 'login' ? t('auth.login.busyLogin') : t('auth.login.busyRegister')}
              </>
            ) : mode === 'login' ? t('auth.login.submitLogin') : t('auth.login.submitRegister')}
          </button>
        </form>

        <p className="auth-foot">
          {t('auth.login.footer')}
        </p>
        <div className="mt-4 flex justify-center">
          <LanguageSwitcher />
        </div>
      </div>
    </div>
  );
}

