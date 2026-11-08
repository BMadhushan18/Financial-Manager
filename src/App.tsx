import {
  BarChart3,
  CalendarRange,
  Eye,
  EyeOff,
  Heart,
  LayoutDashboard,
  LogOut,
  Plus,
  Receipt,
  Settings as SettingsIcon,
  type LucideIcon,
} from 'lucide-react';
import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Logo, LogoMark } from './components/Logo';
import { QuickSearch } from './components/QuickSearch';
import { RolloverSheet } from './components/RolloverSheet';
import { ErrorBox, LoadingPanels } from './components/ui';
import { api } from './lib/api';
import { useApp } from './lib/context';
import { useHashRoute } from './lib/hooks';
import { formatShort } from './lib/labels';
import { Expenses } from './screens/Expenses';
import { Home } from './screens/Home';
import { ForcedPasswordChange, Login } from './screens/Login';
import { Onboarding } from './screens/Onboarding';
import { Plan } from './screens/Plan';
import { Settings } from './screens/Settings';
import { Wishlist } from './screens/Wishlist';

// Reports (and Chart.js inside it) load only when opened.
const Reports = lazy(() => import('./screens/Reports'));

interface NavEntry {
  route: string;
  label: string;
  icon: LucideIcon;
  title: string;
}

const NAV: { section: string; items: NavEntry[] }[] = [
  {
    section: 'Overview',
    items: [
      { route: 'home', label: 'Dashboard', icon: LayoutDashboard, title: 'Dashboard' },
      { route: 'wishlist', label: 'Wishlist', icon: Heart, title: 'Wishlist' },
      { route: 'expenses', label: 'Expenses', icon: Receipt, title: 'Expenses' },
    ],
  },
  {
    section: 'Planning',
    items: [
      { route: 'plan', label: 'Budget plan', icon: CalendarRange, title: 'Budget plan' },
      { route: 'reports', label: 'Reports', icon: BarChart3, title: 'Reports' },
    ],
  },
  {
    section: 'Account',
    items: [{ route: 'settings', label: 'Settings', icon: SettingsIcon, title: 'Settings' }],
  },
];
const ALL = NAV.flatMap((s) => s.items);
const MOBILE_NAV = ['home', 'wishlist', 'add', 'expenses', 'reports'];

const href = (route: string) => `#/${route === 'home' ? '' : route}`;

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

  if (app.auth === 'signed-out') return <Login />;
  if (app.auth === 'must-change') return <ForcedPasswordChange />;
  if (loadError && !boot) {
    return (
      <main className="auth-main">
        <div className="auth-card stack">
          <Logo />
          <ErrorBox message={loadError} onRetry={() => void refresh()} />
        </div>
      </main>
    );
  }
  if (!boot || !cycle) {
    return (
      <main className="page" style={{ maxWidth: 720 }}>
        <LoadingPanels count={3} />
      </main>
    );
  }
  if (!boot.settings.onboarded) return <Onboarding onDone={changed} />;

  const current = ALL.find((n) => n.route === route) ?? ALL[0]!;
  const displayName = boot.username ?? boot.email;
  const cycleLabel = `Cycle ${formatShort(cycle.cycle.start)} – ${formatShort(cycle.cycle.end)} · ${cycle.days_left} days left`;

  const screen = (() => {
    switch (current.route) {
      case 'wishlist':
        return <Wishlist />;
      case 'expenses':
        return <Expenses />;
      case 'plan':
        return <Plan />;
      case 'reports':
        return (
          <Suspense fallback={<LoadingPanels count={2} />}>
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
    <div className="layout">
      <aside className="sidebar" aria-label="Main navigation">
        <Logo />
        <nav>
          {NAV.map((s) => (
            <div key={s.section}>
              <div className="nav-section">{s.section}</div>
              {s.items.map((n) => (
                <a
                  key={n.route}
                  className="nav-link"
                  href={href(n.route)}
                  aria-current={current.route === n.route ? 'page' : undefined}
                >
                  <n.icon size={18} />
                  {n.label}
                </a>
              ))}
            </div>
          ))}
        </nav>
        <div className="sidebar-foot">
          <span className="avatar" aria-hidden="true">
            {displayName.slice(0, 2)}
          </span>
          <div className="grow">
            <div className="small strong ellipsis">{displayName}</div>
            <div className="tiny muted">
              {boot.settings.currency} ·{' '}
              {boot.auth_method === 'password' ? 'Signed in' : 'Cloudflare Access'}
            </div>
          </div>
          {boot.auth_method === 'password' && (
            <button
              className="icon-btn sm"
              onClick={() => void app.signOut()}
              aria-label="Sign out"
              title="Sign out"
            >
              <LogOut size={17} />
            </button>
          )}
        </div>
      </aside>

      <div className="main-col">
        <header className="topbar">
          <a href="#/" className="hide-desktop" aria-label="Dashboard">
            <LogoMark />
          </a>
          <div className="topbar-title">
            <h1>{current.title}</h1>
            <p>{cycleLabel}</p>
          </div>
          <div className="hide-mobile grow" style={{ display: 'flex', justifyContent: 'center' }}>
            <QuickSearch />
          </div>
          <button
            className="icon-btn"
            onClick={app.togglePrivacy}
            aria-pressed={app.privacy}
            aria-label={app.privacy ? 'Show amounts' : 'Hide amounts'}
            title={app.privacy ? 'Show amounts' : 'Hide amounts'}
          >
            {app.privacy ? <EyeOff size={19} /> : <Eye size={19} />}
          </button>
          <a
            className="icon-btn hide-desktop"
            href="#/plan"
            aria-label="Budget plan"
            title="Budget plan"
          >
            <CalendarRange size={19} />
          </a>
          <a
            className="icon-btn hide-desktop"
            href="#/settings"
            aria-label="Settings"
            title="Settings"
          >
            <SettingsIcon size={19} />
          </a>
          <button
            className="btn primary hide-mobile"
            onClick={() => app.openSheet({ kind: 'add-menu' })}
          >
            <Plus size={17} /> Add new
          </button>
        </header>

        <main className="page" id="main">
          {screen}
        </main>
      </div>

      <nav className="bottom-nav" aria-label="Main">
        {MOBILE_NAV.map((r) => {
          if (r === 'add') {
            return (
              <div className="bn-add" key="add">
                <button
                  onClick={() => app.openSheet({ kind: 'add-menu' })}
                  aria-label="Add expense, wishlist item or income"
                >
                  <Plus size={24} />
                </button>
              </div>
            );
          }
          const n = ALL.find((x) => x.route === r)!;
          return (
            <a
              key={r}
              className="bn-item"
              href={href(r)}
              aria-current={current.route === r ? 'page' : undefined}
            >
              <n.icon size={21} />
              {n.label === 'Dashboard' ? 'Home' : n.label}
            </a>
          );
        })}
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
