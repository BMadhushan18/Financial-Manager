import {
  CalendarCog,
  Database,
  Download,
  KeyRound,
  LogOut,
  PieChart,
  Plus,
  ReceiptText,
  ShieldAlert,
  Tags,
  Trash2,
  Upload,
  UserRound,
} from 'lucide-react';
import { useRef, useState } from 'react';
import { CURRENCIES } from '../../shared/defaults';
import { centsToInput, parseMoneyToCents } from '../../shared/finance';
import type { Category, CycleMode, EntryType, Settings as SettingsT } from '../../shared/types';
import { CATEGORY_ICONS, CategoryIcon, categoryIconKey } from '../components/CategoryIcon';
import {
  Badge,
  MoneyField,
  PanelHead,
  Segmented,
  Sheet,
  Toggle,
  TypeBadge,
} from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';
import { ChangePasswordForm } from './Login';
import { BillSheet } from './Plan';

export function Settings() {
  const app = useApp();
  const { boot, toast, changed, confirm } = app;
  const s = boot!.settings;
  const [form, setForm] = useState({
    salary: centsToInput(s.salary_cents),
    salary_day: String(s.salary_day),
    cycle_mode: s.cycle_mode,
    currency: s.currency,
    needs: String(s.split_needs),
    wants: String(s.split_wants),
    savings: String(s.split_savings),
    warnings_enabled: s.warnings_enabled,
    big_want_percent: String(s.big_want_percent),
    cooling_days: String(s.cooling_days),
    emergency_months: String(s.emergency_months),
    emergency_target: centsToInput(s.emergency_target_cents),
  });
  const [error, setError] = useState<string | null>(null);
  const [pwSheet, setPwSheet] = useState(false);
  const [catSheet, setCatSheet] = useState<Category | 'new' | null>(null);
  const [billSheet, setBillSheet] = useState<number | 'new' | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { busy, run } = useBusy();
  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) =>
    setForm((f) => ({ ...f, [k]: v }));
  const splitTotal = Number(form.needs) + Number(form.wants) + Number(form.savings);

  const save = () =>
    run(async () => {
      const salary = parseMoneyToCents(form.salary || '0');
      if (salary === null || salary < 0) return setError('Please check the salary amount.');
      if (splitTotal !== 100) {
        return setError(`Needs, wants and savings must add up to 100% (currently ${splitTotal}%).`);
      }
      const target = form.emergency_target.trim() ? parseMoneyToCents(form.emergency_target) : null;
      if (form.emergency_target.trim() && (target === null || target < 0)) {
        return setError('Please check the emergency fund target.');
      }
      const body: Partial<Record<keyof SettingsT, unknown>> = {
        salary_cents: salary,
        salary_day: Number(form.salary_day),
        cycle_mode: form.cycle_mode,
        currency: form.currency,
        split_needs: Number(form.needs),
        split_wants: Number(form.wants),
        split_savings: Number(form.savings),
        warnings_enabled: form.warnings_enabled,
        big_want_percent: Number(form.big_want_percent),
        cooling_days: Number(form.cooling_days),
        emergency_months: Number(form.emergency_months),
        emergency_target_cents: target,
      };
      try {
        await api('/api/settings', { method: 'PUT', body });
        setError(null);
        toast({ message: 'Settings saved.' });
        changed();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const exportJson = async () => {
    try {
      const data = await api<unknown>('/api/export');
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `moneymind-backup-${app.today}.json`;
      a.click();
      URL.revokeObjectURL(a.href);
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };

  const importJson = async (file: File) => {
    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(await file.text());
    } catch {
      toast({
        message: 'That file is not valid JSON. Choose a MoneyMind backup file.',
        tone: 'error',
      });
      return;
    }
    const ok = await confirm({
      title: 'Replace all data with this backup?',
      message:
        'Everything currently in MoneyMind will be replaced. Export a backup first if you are not sure.',
      confirmLabel: 'Replace my data',
      danger: true,
      typeToConfirm: 'REPLACE',
    });
    if (!ok) return;
    try {
      await api('/api/import', { method: 'POST', body: { ...parsed, confirm: 'REPLACE' } });
      toast({ message: 'Backup restored.' });
      changed();
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };

  const deleteAll = async () => {
    const first = await confirm({
      title: 'Delete all your data?',
      message:
        'This removes every expense, wishlist item, bill, income entry and setting. It cannot be undone.',
      confirmLabel: 'Continue',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Are you completely sure?',
      message: 'This is the last step. Your data will be permanently deleted.',
      confirmLabel: 'Delete everything',
      danger: true,
      typeToConfirm: 'DELETE',
    });
    if (!second) return;
    try {
      await api('/api/data', { method: 'DELETE', body: { confirm: 'DELETE' } });
      toast({ message: 'All data deleted.' });
      changed();
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };

  return (
    <div className="stack" style={{ maxWidth: 880 }}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className="panel">
          <PanelHead
            title="Pay cycle"
            icon={CalendarCog}
            subtitle="Defines what “this month” means across the app"
          />
          <div className="panel-body stack">
            <div className="form-grid">
              <MoneyField
                label="Monthly salary"
                value={form.salary}
                onChange={(v) => set('salary', v)}
                hint="Added as expected income each cycle"
              />
              <div className="field">
                <label htmlFor="set-cur">Currency</label>
                <select
                  id="set-cur"
                  className="input"
                  value={form.currency}
                  onChange={(e) => set('currency', e.target.value)}
                >
                  {CURRENCIES.map((c) => (
                    <option key={c.code} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="form-grid">
              <Segmented<CycleMode>
                label="Cycle type"
                value={form.cycle_mode}
                options={[
                  { value: 'salary', label: 'Salary to salary' },
                  { value: 'calendar', label: 'Calendar month' },
                ]}
                onChange={(v) => set('cycle_mode', v)}
              />
              <div className="field">
                <label htmlFor="set-day">Salary day</label>
                <input
                  id="set-day"
                  className="input"
                  type="number"
                  min={1}
                  max={31}
                  inputMode="numeric"
                  value={form.salary_day}
                  onChange={(e) => set('salary_day', e.target.value)}
                />
              </div>
            </div>
            <p className="hint">
              If the salary day does not exist in a month (for example the 31st), the last day of
              that month is used.
            </p>
          </div>
        </section>

        <section className="panel">
          <PanelHead
            title="Budget split"
            icon={PieChart}
            subtitle="How income is divided. The 50/30/20 rule is a good starting point."
          />
          <div className="panel-body stack-sm">
            <div className="form-grid three">
              <div className="field">
                <label htmlFor="sp-n">Needs %</label>
                <input
                  id="sp-n"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={form.needs}
                  onChange={(e) => set('needs', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sp-w">Wants %</label>
                <input
                  id="sp-w"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={form.wants}
                  onChange={(e) => set('wants', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="sp-s">Savings %</label>
                <input
                  id="sp-s"
                  className="input"
                  type="number"
                  min={0}
                  max={100}
                  inputMode="numeric"
                  value={form.savings}
                  onChange={(e) => set('savings', e.target.value)}
                />
              </div>
            </div>
            <div className="split-bar" aria-hidden="true">
              <div style={{ width: `${Number(form.needs) || 0}%`, background: 'var(--needs)' }} />
              <div style={{ width: `${Number(form.wants) || 0}%`, background: 'var(--wants)' }} />
              <div
                style={{ width: `${Number(form.savings) || 0}%`, background: 'var(--savings)' }}
              />
            </div>
            <p className={`hint ${splitTotal !== 100 ? 'neg' : ''}`}>
              Total {splitTotal}%{splitTotal !== 100 ? ' – must equal 100%' : ''}
            </p>
          </div>
        </section>

        <section className="panel">
          <PanelHead
            title="Purchase warnings"
            icon={ShieldAlert}
            subtitle="A calm check before buying wants. It never blocks you."
          />
          <div className="panel-body stack">
            <Toggle
              label="Show a check before buying wants"
              description="Covers unpaid bills, wants budget, savings and big recent wants"
              checked={form.warnings_enabled}
              onChange={(v) => set('warnings_enabled', v)}
            />
            <div className="form-grid">
              <div className="field">
                <label htmlFor="set-big">Big want threshold (% of income)</label>
                <input
                  id="set-big"
                  className="input"
                  type="number"
                  min={1}
                  max={100}
                  inputMode="numeric"
                  value={form.big_want_percent}
                  onChange={(e) => set('big_want_percent', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="set-cool">Cooling-off period (days)</label>
                <input
                  id="set-cool"
                  className="input"
                  type="number"
                  min={0}
                  max={90}
                  inputMode="numeric"
                  value={form.cooling_days}
                  onChange={(e) => set('cooling_days', e.target.value)}
                />
              </div>
              <div className="field">
                <label htmlFor="set-em">Emergency fund (months of needs)</label>
                <input
                  id="set-em"
                  className="input"
                  type="number"
                  min={0}
                  max={24}
                  inputMode="numeric"
                  value={form.emergency_months}
                  onChange={(e) => set('emergency_months', e.target.value)}
                />
              </div>
              <MoneyField
                label="Or a fixed emergency target"
                value={form.emergency_target}
                onChange={(v) => set('emergency_target', v)}
                hint="Leave empty to use months"
              />
            </div>
          </div>
        </section>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <div className="row" style={{ justifyContent: 'flex-end' }}>
          <button className="btn primary lg" type="submit" disabled={busy}>
            {busy ? 'Saving…' : 'Save settings'}
          </button>
        </div>
      </form>

      <section className="panel">
        <PanelHead
          title="Categories"
          icon={Tags}
          subtitle="Each category is labelled as a need or a want"
          action={
            <button className="btn sm" onClick={() => setCatSheet('new')}>
              <Plus size={15} /> Add
            </button>
          }
        />
        <ul className="rows">
          {app.categories.map((c) => (
            <li key={c.id}>
              <button className="item" onClick={() => setCatSheet(c)}>
                <CategoryIcon icon={c.icon} name={c.name} color={c.color} size="sm" />
                <span className="grow item-title">{c.name}</span>
                {c.is_archived && <Badge tone="outline">Hidden</Badge>}
                <TypeBadge type={c.type} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="panel">
        <PanelHead
          title="Fixed bills"
          icon={ReceiptText}
          action={
            <button className="btn sm" onClick={() => setBillSheet('new')}>
              <Plus size={15} /> Add
            </button>
          }
        />
        {boot!.bills.length === 0 ? (
          <p className="panel-body muted small">No fixed bills yet.</p>
        ) : (
          <ul className="rows">
            {boot!.bills.map((b) => {
              const cat = app.categoryById(b.category_id);
              return (
                <li key={b.id}>
                  <button className="item" onClick={() => setBillSheet(b.id)}>
                    <CategoryIcon
                      icon={cat?.icon}
                      name={cat?.name ?? b.name}
                      color={cat?.color}
                      size="sm"
                    />
                    <span className="grow">
                      <span className="item-title" style={{ display: 'block' }}>
                        {b.name}
                      </span>
                      <span className="item-meta">
                        Due on day {b.due_day}
                        {!b.is_active && ' · paused'}
                      </span>
                    </span>
                    <span className="item-amount">{app.fmt(b.amount_cents)}</span>
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <div className="grid grid-2">
        <section className="panel">
          <PanelHead
            title="Data and backup"
            icon={Database}
            subtitle="A JSON file with everything"
          />
          <div className="panel-body stack-sm">
            <button className="btn block" onClick={() => void exportJson()}>
              <Download size={16} /> Export backup
            </button>
            <button className="btn block" onClick={() => fileRef.current?.click()}>
              <Upload size={16} /> Restore from backup
            </button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                const f = e.target.files?.[0];
                e.target.value = '';
                if (f) void importJson(f);
              }}
            />
          </div>
        </section>

        <section className="panel">
          <PanelHead
            title="Account"
            icon={UserRound}
            subtitle={`Signed in as ${boot!.username ?? boot!.email}`}
          />
          <div className="panel-body stack-sm">
            {boot!.auth_method === 'password' ? (
              <>
                <button className="btn block" onClick={() => setPwSheet(true)}>
                  <KeyRound size={16} /> Change password
                </button>
                <button className="btn block" onClick={() => void app.signOut()}>
                  <LogOut size={16} /> Sign out
                </button>
              </>
            ) : (
              <a className="btn block" href="/cdn-cgi/access/logout">
                <LogOut size={16} /> Sign out
              </a>
            )}
            <button className="btn danger-ghost block" onClick={() => void deleteAll()}>
              <Trash2 size={16} /> Delete all my data
            </button>
          </div>
        </section>
      </div>

      <p className="disclaimer">
        MoneyMind provides guidance, not financial advice. Your data is stored in your own
        Cloudflare account.
      </p>

      {pwSheet && (
        <Sheet
          title="Change password"
          subtitle="Other devices will be signed out"
          onClose={() => setPwSheet(false)}
        >
          <ChangePasswordForm
            username={boot!.username}
            onDone={() => {
              setPwSheet(false);
              toast({ message: 'Password changed. Other devices were signed out.' });
            }}
          />
        </Sheet>
      )}
      {catSheet && (
        <CategorySheet
          category={catSheet === 'new' ? null : catSheet}
          onClose={() => setCatSheet(null)}
        />
      )}
      {billSheet && (
        <BillSheet
          bill={billSheet === 'new' ? null : (boot!.bills.find((b) => b.id === billSheet) ?? null)}
          onClose={() => setBillSheet(null)}
        />
      )}
    </div>
  );
}

const COLORS = [
  '#0EA5E9',
  '#0284C7',
  '#14B8A6',
  '#16A34A',
  '#6366F1',
  '#8B5CF6',
  '#EC4899',
  '#F43F5E',
  '#F59E0B',
  '#F97316',
  '#64748B',
  '#94A3B8',
];

function CategorySheet({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { toast, changed, confirm, categories } = useApp();
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<EntryType>(category?.type ?? 'WANT');
  const [icon, setIcon] = useState(categoryIconKey(category?.icon, category?.name));
  const [color, setColor] = useState(category?.color ?? '#6366F1');
  const [archived, setArchived] = useState(category?.is_archived ?? false);
  const [moveTo, setMoveTo] = useState<string>('');
  const [needsMove, setNeedsMove] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const save = () =>
    run(async () => {
      if (!name.trim()) return setError('Please name the category.');
      const body = {
        name: name.trim(),
        type,
        icon,
        color: color.toUpperCase(),
        is_archived: archived,
      };
      try {
        if (category) await api(`/api/categories/${category.id}`, { method: 'PUT', body });
        else await api('/api/categories', { method: 'POST', body });
        toast({ message: 'Category saved.' });
        changed();
        onClose();
      } catch (e) {
        setError(errorMessage(e));
      }
    });

  const remove = () =>
    run(async () => {
      if (!category) return;
      if (needsMove === null) {
        const ok = await confirm({
          title: `Delete ${category.name}?`,
          message: 'This cannot be undone.',
          confirmLabel: 'Delete',
          danger: true,
        });
        if (!ok) return;
      }
      try {
        const q = moveTo ? `?move_to=${moveTo}` : '';
        await api(`/api/categories/${category.id}${q}`, { method: 'DELETE' });
        toast({ message: 'Category deleted.' });
        changed();
        onClose();
      } catch (e) {
        if (e instanceof ApiError && e.code === 'HAS_EXPENSES') {
          setNeedsMove(Number(e.details?.count ?? 0));
          setError(null);
          return;
        }
        setError(errorMessage(e));
      }
    });

  return (
    <Sheet title={category ? 'Edit category' : 'New category'} onClose={onClose}>
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <div className="row" style={{ gap: 12 }}>
          <CategoryIcon icon={icon} name={name} color={color} />
          <div className="field grow">
            <label htmlFor="cat-name">Name</label>
            <input
              id="cat-name"
              className="input"
              value={name}
              maxLength={40}
              autoFocus
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <Segmented
          label="Need or want"
          value={type}
          options={[
            { value: 'NEED', label: 'Need' },
            { value: 'WANT', label: 'Want' },
          ]}
          onChange={setType}
        />
        <div className="field">
          <span className="label">Icon</span>
          <div className="row wrap" role="group" aria-label="Icon">
            {Object.entries(CATEGORY_ICONS).map(([key, Icon]) => (
              <button
                key={key}
                type="button"
                className="icon-btn"
                style={
                  icon === key
                    ? {
                        background: 'var(--brand-soft)',
                        color: 'var(--brand)',
                        boxShadow: '0 0 0 1px var(--brand)',
                      }
                    : { border: '1px solid var(--border)' }
                }
                aria-pressed={icon === key}
                aria-label={`Icon ${key}`}
                onClick={() => setIcon(key)}
              >
                <Icon size={18} />
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <span className="label">Colour</span>
          <div className="row wrap" role="group" aria-label="Colour">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Colour ${c}`}
                aria-pressed={color.toUpperCase() === c}
                onClick={() => setColor(c)}
                style={{
                  width: 32,
                  height: 32,
                  borderRadius: 8,
                  border: '2px solid var(--surface)',
                  background: c,
                  cursor: 'pointer',
                  boxShadow: color.toUpperCase() === c ? `0 0 0 2px ${c}` : 'none',
                }}
              />
            ))}
          </div>
        </div>
        {category && (
          <Toggle
            label="Hide from lists"
            description="Keeps its history"
            checked={archived}
            onChange={setArchived}
          />
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary lg block" type="submit" disabled={busy}>
          Save category
        </button>
        {category && (
          <div className="stack-sm">
            {needsMove !== null && (
              <div className="field">
                <label htmlFor="cat-move">
                  {needsMove} expense(s) use this category. Move them to:
                </label>
                <select
                  id="cat-move"
                  className="input"
                  value={moveTo}
                  onChange={(e) => setMoveTo(e.target.value)}
                >
                  <option value="">Choose a category…</option>
                  {categories
                    .filter((c) => c.id !== category.id)
                    .map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button
              type="button"
              className="btn danger-ghost block"
              disabled={busy || (needsMove !== null && !moveTo)}
              onClick={() => void remove()}
            >
              {needsMove !== null ? 'Move expenses and delete' : 'Delete category'}
            </button>
          </div>
        )}
      </form>
    </Sheet>
  );
}
