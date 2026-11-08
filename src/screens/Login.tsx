import { CheckCircle2, KeyRound, LockKeyhole, PiggyBank, ShieldCheck, Wallet } from 'lucide-react';
import { useState, type ReactNode } from 'react';
import { validateNewPassword } from '../../shared/password';
import { Logo } from '../components/Logo';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';

/** Split layout used by sign-in screens: brand panel (desktop) + form. */
function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="auth">
      <aside className="auth-aside">
        <Logo />
        <div>
          <h2>Plan your salary. Spend with confidence.</h2>
          <ul>
            <li>
              <Wallet size={18} /> Know exactly what is safe to spend until payday
            </li>
            <li>
              <PiggyBank size={18} /> Pay yourself first with a savings goal
            </li>
            <li>
              <ShieldCheck size={18} /> Gentle checks before big purchases
            </li>
          </ul>
        </div>
        <p style={{ fontSize: '0.8rem', color: '#a5b4fc' }}>
          Your data is private and stored in your own Cloudflare account.
        </p>
      </aside>
      <main className="auth-main">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  );
}

/** Username + password sign-in. */
export function Login() {
  const { refresh } = useApp();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const submit = () =>
    run(async () => {
      if (!username.trim() || !password) {
        setError('Please enter your username and password.');
        return;
      }
      setError(null);
      try {
        await api('/api/auth/login', {
          method: 'POST',
          body: { username: username.trim(), password },
        });
        setPassword('');
        await refresh(); // shows the app, or the "set a new password" screen
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <AuthLayout>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        aria-labelledby="login-title"
      >
        <div className="hide-desktop" style={{ marginBottom: 8 }}>
          <Logo />
        </div>
        <div>
          <h1 id="login-title">Sign in</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            Welcome back. Enter your details to continue.
          </p>
        </div>
        <div className="field">
          <label htmlFor="login-user">Username</label>
          <input
            id="login-user"
            className="input"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            autoFocus
            value={username}
            onChange={(e) => setUsername(e.target.value)}
          />
        </div>
        <div className="field">
          <label htmlFor="login-pass">Password</label>
          <input
            id="login-pass"
            className="input"
            type={show ? 'text' : 'password'}
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>
        <label className="check">
          <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show
          password
        </label>
        {error && (
          <div className="callout danger" role="alert">
            <LockKeyhole size={16} />
            <span>{error}</span>
          </div>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
        <p className="hint center">Forgot your password? Ask the account owner to reset it.</p>
      </form>
    </AuthLayout>
  );
}

/**
 * Change password. `forced` = first sign-in with a temporary password:
 * the rest of the app stays locked until this is done.
 */
export function ChangePasswordForm({
  forced,
  username,
  onDone,
}: {
  forced?: boolean;
  username?: string | null;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [repeat, setRepeat] = useState('');
  const [show, setShow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();
  const hint = next ? validateNewPassword(next, { username, current }) : null;

  const submit = () =>
    run(async () => {
      if (!current)
        return setError(forced ? 'Enter the temporary password.' : 'Enter your current password.');
      const problem = validateNewPassword(next, { username, current });
      if (problem) return setError(problem);
      if (next !== repeat) return setError('The two new passwords do not match.');
      setError(null);
      try {
        await api('/api/auth/change-password', {
          method: 'POST',
          body: { current_password: current, new_password: next },
        });
        setCurrent('');
        setNext('');
        setRepeat('');
        onDone();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  return (
    <form
      className="stack"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <div className="field">
        <label htmlFor="pw-current">{forced ? 'Temporary password' : 'Current password'}</label>
        <input
          id="pw-current"
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete="current-password"
          autoFocus
          value={current}
          onChange={(e) => setCurrent(e.target.value)}
        />
      </div>
      <div className="field">
        <label htmlFor="pw-new">New password</label>
        <input
          id="pw-new"
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={next}
          aria-describedby="pw-rules"
          onChange={(e) => setNext(e.target.value)}
        />
        <span id="pw-rules" className={`hint row ${hint ? 'neg' : next ? 'pos' : ''}`}>
          {!hint && next && <CheckCircle2 size={14} />}
          {hint ??
            (next ? 'Strong enough' : 'At least 8 characters, including a letter and a number.')}
        </span>
      </div>
      <div className="field">
        <label htmlFor="pw-repeat">Confirm new password</label>
        <input
          id="pw-repeat"
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
      <label className="check">
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show
        passwords
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary lg block" type="submit" disabled={busy}>
        {busy ? 'Saving…' : forced ? 'Set new password' : 'Update password'}
      </button>
    </form>
  );
}

/** First sign-in with a temporary password. */
export function ForcedPasswordChange() {
  const { refresh, signOut, toast } = useApp();
  return (
    <AuthLayout>
      <div className="stack">
        <div className="hide-desktop">
          <Logo />
        </div>
        <span
          className="tile"
          style={{ background: 'var(--brand-soft)', color: 'var(--brand)', width: 44, height: 44 }}
        >
          <KeyRound size={20} />
        </span>
        <div>
          <h1>Set your password</h1>
          <p className="muted small" style={{ marginTop: 4 }}>
            You signed in with a temporary password. Choose a new one that only you know to
            continue.
          </p>
        </div>
        <ChangePasswordForm
          forced
          onDone={() => {
            toast({ message: 'Password updated. Welcome to MoneyMind.' });
            void refresh();
          }}
        />
        <button className="btn ghost block" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </div>
    </AuthLayout>
  );
}
