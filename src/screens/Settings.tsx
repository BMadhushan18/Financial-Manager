import { useRef, useState } from 'react';
import { CURRENCIES } from '../../shared/defaults';
import { centsToInput, parseMoneyToCents } from '../../shared/finance';
import type { Category, CycleMode, EntryType, Settings as SettingsT } from '../../shared/types';
import { Icon } from '../components/Icon';
import { MoneyField, Segmented, Sheet, TypeTag } from '../components/ui';
import { api, ApiError, errorMessage } from '../lib/api';
import { useApp } from '../lib/context';
import { useBusy } from '../lib/hooks';
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
      if (splitTotal !== 100)
        return setError(`Needs + wants + savings must add up to 100% (now ${splitTotal}%).`);
      const target = form.emergency_target.trim() ? parseMoneyToCents(form.emergency_target) : null;
      if (form.emergency_target.trim() && (target === null || target < 0))
        return setError('Please check the emergency fund target.');
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
        message: 'That file is not valid JSON. Pick a MoneyMind backup file.',
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
      message: 'This removes every expense, wish, bill, income and setting. It cannot be undone.',
      confirmLabel: 'Continue',
      danger: true,
    });
    if (!first) return;
    const second = await confirm({
      title: 'Are you completely sure?',
      message: 'Last step. Your data will be gone for good.',
      confirmLabel: 'Delete everything',
      danger: true,
      typeToConfirm: 'DELETE',
    });
    if (!second) return;
    try {
      await api('/api/data', { method: 'DELETE', body: { confirm: 'DELETE' } });
      toast({ message: 'All data deleted. Starting fresh.' });
      changed();
    } catch (e) {
      toast({ message: errorMessage(e), tone: 'error' });
    }
  };

  return (
    <div className="stack">
      <form
        className="stack"
        onSubmit={(e) => {
          e.preventDefault();
          void save();
        }}
      >
        <section className="card stack">
          <h2>Pay cycle</h2>
          <MoneyField
            label="Monthly salary"
            value={form.salary}
            onChange={(v) => set('salary', v)}
            hint="Added as expected income at the start of each cycle."
          />
          <Segmented<CycleMode>
            label="My month runs"
            value={form.cycle_mode}
            options={[
              { value: 'salary', label: 'Salary day to salary day' },
              { value: 'calendar', label: 'Calendar month' },
            ]}
            onChange={(v) => set('cycle_mode', v)}
          />
          <div className="grid-2">
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
          <p className="hint">
            If the day does not exist in a month (like the 31st), the last day of that month is
            used.
          </p>
        </section>

        <section className="card stack">
          <h2>Budget split</h2>
          <div className="grid-2" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
            <div className="field">
              <label htmlFor="sp-n">● Needs %</label>
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
              <label htmlFor="sp-w">★ Wants %</label>
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
              <label htmlFor="sp-s">🌱 Savings %</label>
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
          <p className={`hint ${splitTotal !== 100 ? 'soft-red' : ''}`}>
            Total {splitTotal}%{splitTotal !== 100 ? ' – must be 100%' : ''}. The 50/30/20 rule is a
            good start.
          </p>
        </section>

        <section className="card stack">
          <h2>Smart warnings</h2>
          <label className="switch">
            <span>Show a calm check before buying wants</span>
            <input
              type="checkbox"
              checked={form.warnings_enabled}
              onChange={(e) => set('warnings_enabled', e.target.checked)}
            />
          </label>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="set-big">"Big want" is over (% of income)</label>
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
              <label htmlFor="set-cool">Cooling-off days</label>
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
          </div>
        </section>

        <section className="card stack">
          <h2>Emergency fund</h2>
          <div className="grid-2">
            <div className="field">
              <label htmlFor="set-em">Months of needs</label>
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
              label="Or a fixed target"
              value={form.emergency_target}
              onChange={(v) => set('emergency_target', v)}
              hint="Leave empty to use months."
            />
          </div>
        </section>

        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          {busy ? 'Saving…' : 'Save settings'}
        </button>
      </form>

      <section className="card">
        <div className="card-head">
          <h2>Categories</h2>
          <button className="btn small" onClick={() => setCatSheet('new')}>
            Add
          </button>
        </div>
        <ul className="list">
          {app.categories.map((c) => (
            <li key={c.id}>
              <button className="list-btn" onClick={() => setCatSheet(c)}>
                <span className="icon-dot" aria-hidden="true">
                  {c.icon}
                </span>
                <span className="grow">
                  {c.name}
                  {c.is_archived && (
                    <span className="tag neutral" style={{ marginLeft: 6 }}>
                      Hidden
                    </span>
                  )}
                </span>
                <TypeTag type={c.type} />
              </button>
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>Fixed bills</h2>
          <button className="btn small" onClick={() => setBillSheet('new')}>
            Add
          </button>
        </div>
        {boot!.bills.length === 0 ? (
          <p className="muted small">No bills yet.</p>
        ) : (
          <ul className="list">
            {boot!.bills.map((b) => (
              <li key={b.id}>
                <button className="list-btn" onClick={() => setBillSheet(b.id)}>
                  <span className="grow">
                    {b.name}{' '}
                    <span className="tiny muted">
                      · day {b.due_day}
                      {!b.is_active && ' · paused'}
                    </span>
                  </span>
                  <span className="amount">{app.fmt(b.amount_cents)}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="card stack">
        <h2>Backup</h2>
        <button className="btn block" onClick={() => void exportJson()}>
          <Icon name="download" /> Export JSON backup
        </button>
        <button className="btn block" onClick={() => fileRef.current?.click()}>
          <Icon name="upload" /> Import JSON backup
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
      </section>

      <section className="card stack">
        <h2>Account</h2>
        <p className="small">
          Signed in as <strong>{boot!.email}</strong>
        </p>
        <a className="btn block" href="/cdn-cgi/access/logout">
          Sign out
        </a>
        <button className="btn block soft-red" onClick={() => void deleteAll()}>
          Delete all my data
        </button>
      </section>

      <p className="tiny muted" style={{ textAlign: 'center' }}>
        MoneyMind gives guidance, not financial advice. Your data stays in your own Cloudflare
        account.
      </p>

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

const ICONS = [
  '🏷️',
  '🛒',
  '🏠',
  '🚌',
  '💊',
  '💡',
  '📚',
  '📶',
  '🛡️',
  '🏦',
  '🍜',
  '🎬',
  '📺',
  '🎧',
  '👕',
  '🎨',
  '🎁',
  '✈️',
  '🐶',
  '👶',
  '💇',
  '🏋️',
  '⛽',
  '🧹',
];

function CategorySheet({ category, onClose }: { category: Category | null; onClose: () => void }) {
  const { toast, changed, confirm, categories } = useApp();
  const [name, setName] = useState(category?.name ?? '');
  const [type, setType] = useState<EntryType>(category?.type ?? 'WANT');
  const [icon, setIcon] = useState(category?.icon ?? '🏷️');
  const [archived, setArchived] = useState(category?.is_archived ?? false);
  const [moveTo, setMoveTo] = useState<string>('');
  const [needsMove, setNeedsMove] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const { busy, run } = useBusy();

  const save = () =>
    run(async () => {
      if (!name.trim()) return setError('Please name the category.');
      const body = { name: name.trim(), type, icon, is_archived: archived };
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
        <div className="field">
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
        <Segmented
          label="Need or want?"
          value={type}
          options={[
            { value: 'NEED', label: '● Need' },
            { value: 'WANT', label: '★ Want' },
          ]}
          onChange={setType}
        />
        <div className="field">
          <span className="label">Icon</span>
          <div className="row wrap" role="group" aria-label="Icon">
            {ICONS.map((i) => (
              <button
                key={i}
                type="button"
                className="chip"
                style={{ minHeight: 44, width: 48 }}
                aria-pressed={icon === i}
                aria-label={`Icon ${i}`}
                onClick={() => setIcon(i)}
              >
                <span className="emoji">{i}</span>
              </button>
            ))}
          </div>
        </div>
        {category && (
          <label className="switch">
            <span>Hide from lists (keeps history)</span>
            <input
              type="checkbox"
              checked={archived}
              onChange={(e) => setArchived(e.target.checked)}
            />
          </label>
        )}
        {error && (
          <p className="field-error" role="alert">
            {error}
          </p>
        )}
        <button className="btn primary block" type="submit" disabled={busy}>
          Save
        </button>
        {category && (
          <div className="card flat stack" style={{ gap: 8 }}>
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
                        {c.icon} {c.name}
                      </option>
                    ))}
                </select>
              </div>
            )}
            <button
              type="button"
              className="btn ghost block soft-red"
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
