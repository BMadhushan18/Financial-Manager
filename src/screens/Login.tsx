import { useState } from 'react';
import { validateNewPassword } from '../../shared/password';
import { api, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';

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
    <main className="auth-page">
      <form
        className="card stack auth-card"
        onSubmit={(e) => {
          e.preventDefault();
          void submit();
        }}
        aria-labelledby="login-title"
      >
        <div className="brand" style={{ justifyContent: 'center' }}>
          <img src="/icon.svg" alt="" width={40} height={40} />
        </div>
        <div style={{ textAlign: 'center' }}>
          <h1 id="login-title" style={{ fontSize: '1.4rem', margin: 0 }}>
            Welcome to MoneyMind
          </h1>
          <p className="muted small">Sign in to see your plan.</p>
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
          <label className="row small muted" style={{ minHeight: 32 }}>
            <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} />{' '}
            Show password
          </label>
        </div>
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
    </main>
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
        <span id="pw-rules" className={`hint ${hint ? 'soft-red' : next ? 'positive' : ''}`}>
          {hint ?? (next ? '✓ Looks good' : 'At least 8 characters, with a letter and a number.')}
        </span>
      </div>
      <div className="field">
        <label htmlFor="pw-repeat">Repeat new password</label>
        <input
          id="pw-repeat"
          className="input"
          type={show ? 'text' : 'password'}
          autoComplete="new-password"
          value={repeat}
          onChange={(e) => setRepeat(e.target.value)}
        />
      </div>
      <label className="row small muted" style={{ minHeight: 32 }}>
        <input type="checkbox" checked={show} onChange={(e) => setShow(e.target.checked)} /> Show
        passwords
      </label>
      {error && (
        <p className="field-error" role="alert">
          {error}
        </p>
      )}
      <button className="btn primary block" type="submit" disabled={busy}>
        {busy ? 'Saving…' : forced ? 'Set new password' : 'Change password'}
      </button>
    </form>
  );
}

/** First sign-in with a temporary password. */
export function ForcedPasswordChange() {
  const { refresh, signOut, toast } = useApp();
  return (
    <main className="auth-page">
      <section className="card stack auth-card" aria-labelledby="fpc-title">
        <div style={{ textAlign: 'center' }}>
          <span style={{ fontSize: '2rem' }} aria-hidden="true">
            🔐
          </span>
          <h1 id="fpc-title" style={{ fontSize: '1.3rem', margin: '4px 0' }}>
            Set your own password
          </h1>
          <p className="muted small">
            You signed in with a temporary password. Choose a new one that only you know.
          </p>
        </div>
        <ChangePasswordForm
          forced
          onDone={() => {
            toast({ message: 'Password changed. Welcome!' });
            void refresh();
          }}
        />
        <button className="btn ghost block" type="button" onClick={() => void signOut()}>
          Sign out
        </button>
      </section>
    </main>
  );
}
