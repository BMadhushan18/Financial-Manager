import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Icon } from './components/Icon';
import { RolloverSheet } from './components/RolloverSheet';
import { ErrorBox, LoadingCards } from './components/ui';
import { api } from './lib/api';
import { useApp } from './lib/context';
import { useHashRoute } from './lib/hooks';
import { Expenses } from './screens/Expenses';
import { Home } from './screens/Home';
import { Onboarding } from './screens/Onboarding';
import { Plan } from './screens/Plan';
import { Settings } from './screens/Settings';
import { Wishlist } from './screens/Wishlist';

// Reports (and Chart.js inside it) load only when opened.
const Reports = lazy(() => import('./screens/Reports'));

const TITLES: Record<string, string> = {
  home: 'MoneyMind',
  wishlist: 'Wishlist',
  expenses: 'Expenses',
  plan: 'Plan this cycle',
  reports: 'Reports',
  settings: 'Settings',
};

const NAV = [
  { route: 'home', label: 'Home', icon: 'home' },
  { route: 'wishlist', label: 'Wishlist', icon: 'heart' },
  { route: 'add', label: 'Add', icon: 'plus' },
  { route: 'expenses', label: 'Expenses', icon: 'list' },
  { route: 'reports', label: 'Reports', icon: 'chart' },
];

export function App() {
  const app = useApp();
  const route = useHashRoute();
  const [rolloverLater, setRolloverLater] = useState(false);
  const closingRef = useRef(false);
  const { cycle, boot, loadError, refresh, changed } = app;

  // Close the previous cycle quietly when there is nothing to decide.
  useEffect(() => {
    if (!cycle || cycle.rollover || cycle.previous_closed || closingRef.current) return;
    closingRef.current = true;
    api('/api/cycle/close', { method: 'POST', body: { decisions: {} } })
      .then(() => void refresh())
      .catch(() => undefined);
  }, [cycle, refresh]);

  if (loadError && !boot) {
    return (
      <main>
        <div className="stack" style={{ marginTop: 48 }}>
          <h1>MoneyMind</h1>
          <ErrorBox message={loadError} onRetry={() => void refresh()} />
        </div>
      </main>
    );
  }
  if (!boot || !cycle) {
    return (
      <main>
        <LoadingCards count={3} />
      </main>
    );
  }
  if (!boot.settings.onboarded) return <Onboarding onDone={changed} />;

  const screen = (() => {
    switch (route) {
      case 'wishlist':
        return <Wishlist />;
      case 'expenses':
        return <Expenses />;
      case 'plan':
        return <Plan />;
      case 'reports':
        return (
          <Suspense fallback={<LoadingCards count={2} />}>
            <Reports />
          </Suspense>
        );
      case 'settings':
        return <Settings />;
      default:
        return <Home />;
    }
  })();

  return (
    <div className="app">
      <header className="topbar">
        <h1>
          {route === 'home' || !TITLES[route] ? (
            <span className="brand">
              <img src="/icon.svg" alt="" /> MoneyMind
            </span>
          ) : (
            TITLES[route]
          )}
        </h1>
        <button
          className="icon-btn"
          onClick={app.togglePrivacy}
          aria-pressed={app.privacy}
          aria-label={app.privacy ? 'Show amounts' : 'Hide amounts'}
          title={app.privacy ? 'Show amounts' : 'Hide amounts'}
        >
          <Icon name={app.privacy ? 'eyeOff' : 'eye'} />
        </button>
        <a className="icon-btn" href="#/plan" aria-label="Plan this cycle" title="Plan">
          <Icon name="plan" />
        </a>
        <a className="icon-btn" href="#/settings" aria-label="Settings" title="Settings">
          <Icon name="settings" />
        </a>
      </header>

      <main id="main">{screen}</main>

      <nav className="bottom-nav" aria-label="Main">
        {NAV.map((n) =>
          n.route === 'add' ? (
            <div className="nav-add" key="add">
              <button
                onClick={() => app.openSheet({ kind: 'add-menu' })}
                aria-label="Add expense, wish or income"
              >
                <Icon name="plus" />
                <span className="hide-mobile" style={{ marginLeft: 6, fontWeight: 650 }}>
                  Add
                </span>
              </button>
            </div>
          ) : (
            <a
              key={n.route}
              className="nav-item"
              href={`#/${n.route === 'home' ? '' : n.route}`}
              aria-current={route === n.route ? 'page' : undefined}
            >
              <Icon name={n.icon} />
              {n.label}
            </a>
          ),
        )}
        <a
          className="nav-item hide-mobile"
          href="#/plan"
          aria-current={route === 'plan' ? 'page' : undefined}
        >
          <Icon name="plan" />
          Plan
        </a>
        <a
          className="nav-item hide-mobile"
          href="#/settings"
          aria-current={route === 'settings' ? 'page' : undefined}
        >
          <Icon name="settings" />
          Settings
        </a>
      </nav>

      {cycle.rollover && !rolloverLater && (
        <RolloverSheet
          items={cycle.rollover.items}
          previousEnd={cycle.rollover.previous_cycle.end}
          onLater={() => setRolloverLater(true)}
        />
      )}
    </div>
  );
}
