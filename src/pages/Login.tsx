import { useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { Logo } from '../components/Logo';

const inputClass = 'field h-12 px-4 text-sm';
const labelClass = 'mb-2 block text-sm font-medium text-gray-300';

type Mode = 'login' | 'register';

export default function Login() {
  const { login, register } = useAuth();
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

    if (!username.trim()) return setError('Informe seu nome de usuário.');
    if (!password) return setError('Informe sua senha.');
    if (mode === 'register') {
      if (password.length < 6) return setError('A senha deve ter pelo menos 6 caracteres.');
      if (password !== confirm) return setError('As senhas não conferem.');
    }

    setBusy(true);
    try {
      if (mode === 'login') {
        await login(username.trim(), password);
      } else {
        await register(username.trim(), password, displayName.trim() || undefined);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível autenticar.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-card">
        <div className="flex justify-center"><Logo size={44} withWordmark={false} /></div>

        <h1 className="mt-6 text-center text-2xl font-bold tracking-tight text-gray-50">
          {mode === 'login' ? 'Entrar no Zenkuri' : 'Criar sua conta'}
        </h1>
        <p className="mt-2 text-center text-sm text-gray-400">
          {mode === 'login'
            ? 'Acompanhe suas platinas e 100% em todas as plataformas.'
            : 'Comece a registrar suas conquistas em um só lugar.'}
        </p>

        <div className="subtabs mt-6 justify-center border-b border-gray-800" role="tablist" aria-label="Entrar ou criar conta">
          {([['login', 'Entrar'], ['register', 'Criar conta']] as const).map(([value, label]) => (
            <button key={value} type="button" role="tab" aria-selected={mode === value} onClick={() => switchMode(value)} className="subtab px-2">
              {label}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label className={labelClass} htmlFor="auth-username">Usuário</label>
            <input id="auth-username" type="text" value={username} onChange={(e) => setUsername(e.target.value)}
              placeholder="ex. joel" autoComplete="username" className={inputClass} />
          </div>

          {mode === 'register' && (
            <div>
              <label className={labelClass} htmlFor="auth-display">
                Nome de exibição <span className="font-normal text-gray-500">(opcional)</span>
              </label>
              <input id="auth-display" type="text" value={displayName} onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Como quer aparecer no app" className={inputClass} />
            </div>
          )}

          <div>
            <label className={labelClass} htmlFor="auth-password">Senha</label>
            <input id="auth-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)}
              placeholder={mode === 'register' ? 'Mínimo de 6 caracteres' : 'Sua senha'}
              autoComplete={mode === 'login' ? 'current-password' : 'new-password'} className={inputClass} />
          </div>

          {mode === 'register' && (
            <div>
              <label className={labelClass} htmlFor="auth-confirm">Confirmar senha</label>
              <input id="auth-confirm" type="password" value={confirm} onChange={(e) => setConfirm(e.target.value)}
                placeholder="Repita a senha" autoComplete="new-password" className={inputClass} />
            </div>
          )}

          {error && (
            <p role="alert" className="rounded-lg border border-red-800/30 bg-red-900/20 px-3 py-2 text-xs text-red-300">
              {error}
            </p>
          )}

          <button type="submit" disabled={busy} className="btn btn-primary btn-lg mt-2 w-full disabled:opacity-60">
            {busy ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {mode === 'login' ? 'Entrando…' : 'Criando conta…'}
              </>
            ) : mode === 'login' ? 'Entrar' : 'Criar conta'}
          </button>
        </form>

        <p className="mt-6 text-center text-xs leading-relaxed text-gray-500">
          Depois de entrar, conecte suas contas Steam, PSN e RetroAchievements.
        </p>
      </div>
    </div>
  );
}

