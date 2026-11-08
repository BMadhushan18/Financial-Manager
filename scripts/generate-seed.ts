// Generates seed/seed.sql: one demo user with salary, 5 bills, 3+ months of
// expenses and 15 wishlist items in every status. Dates are relative to
// today so every screen has realistic data whenever you run it.
//
//   npm run seed:gen                       (user: demo@moneymind.local)
//   SEED_EMAIL=you@example.com npm run seed:gen
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DEFAULT_CATEGORIES } from '../shared/defaults';
import { addDays, billDueDate, getCycle, localTodayISO, previousCycle } from '../shared/finance';
import type { CycleRange } from '../shared/types';

const EMAIL = (process.env.SEED_EMAIL ?? 'demo@moneymind.local').toLowerCase();
const TODAY = localTodayISO();
const SALARY_DAY = 25;
const MODE = 'salary' as const;

const q = (v: string | number | null): string =>
  v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`;
const U = `(SELECT id FROM users WHERE email = ${q(EMAIL)})`;
const cat = (name: string) =>
  `(SELECT id FROM categories WHERE user_id = ${U} AND name = ${q(name)})`;
const wish = (name: string) =>
  `(SELECT id FROM wishlist_items WHERE user_id = ${U} AND name = ${q(name)})`;
const bill = (name: string) =>
  `(SELECT id FROM fixed_bills WHERE user_id = ${U} AND name = ${q(name)})`;
const rs = (rupees: number) => Math.round(rupees * 100);

// Deterministic pseudo-random numbers so the seed is stable for a given day.
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) % 2147483648;
  return seed / 2147483648;
};
const pick = <T>(list: T[]): T => list[Math.floor(rand() * list.length)]!;

const sql: string[] = [];
const add = (s: string) => sql.push(s.trim().replace(/\s+/g, ' ') + ';');

// ---------- cycles ----------
const current = getCycle(TODAY, SALARY_DAY, MODE);
const cycles: CycleRange[] = [current];
for (let i = 0; i < 3; i++) cycles.unshift(previousCycle(cycles[0]!, SALARY_DAY, MODE));
const [c3, c2, c1] = cycles as [CycleRange, CycleRange, CycleRange, CycleRange];

// ---------- reset this user ----------
for (const t of [
  'purchase_checks',
  'bill_payments',
  'wishlist_price_history',
  'expenses',
  'wishlist_items',
  'fixed_bills',
  'income_entries',
  'savings_moves',
  'cycles',
  'categories',
  'savings_goals',
  'settings',
]) {
  add(`DELETE FROM ${t} WHERE user_id IN (SELECT id FROM users WHERE email = ${q(EMAIL)})`);
}
add(`DELETE FROM users WHERE email = ${q(EMAIL)}`);
add(`INSERT INTO users (email) VALUES (${q(EMAIL)})`);
add(`INSERT INTO settings (user_id, salary_day, cycle_mode, currency, salary_cents, last_salary_cycle, onboarded)
     VALUES (${U}, ${SALARY_DAY}, 'salary', 'LKR', ${rs(250000)}, ${q(current.start)}, 1)`);
add(
  `INSERT INTO savings_goals (user_id, mode, amount_cents, percent) VALUES (${U}, 'percent', 0, 15)`,
);
for (const c of DEFAULT_CATEGORIES) {
  add(`INSERT INTO categories (user_id, name, type, priority, icon, color, is_default)
       VALUES (${U}, ${q(c.name)}, ${q(c.type)}, ${q(c.priority)}, ${q(c.icon)}, ${q(c.color)}, 1)`);
}
add(
  `UPDATE categories SET monthly_limit_cents = ${rs(40000)} WHERE user_id = ${U} AND name = 'Food & groceries'`,
);
add(
  `UPDATE categories SET monthly_limit_cents = ${rs(12000)} WHERE user_id = ${U} AND name = 'Eating out'`,
);

// ---------- income ----------
for (const c of cycles) {
  add(`INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
       VALUES (${U}, ${q(c.start)}, 'salary', ${rs(250000)}, 'received', 'Monthly salary')`);
}
add(`INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
     VALUES (${U}, ${q(addDays(c2.start, 10))}, 'bonus', ${rs(40000)}, 'received', 'Quarterly bonus')`);
add(`INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
     VALUES (${U}, ${q(addDays(c1.start, 12))}, 'side_job', ${rs(18000)}, 'received', 'Logo design job')`);
const sideDate = addDays(
  current.start,
  Math.min(
    14,
    Math.max(0, Math.floor((Date.parse(current.end) - Date.parse(current.start)) / 864e5)),
  ),
);
add(`INSERT INTO income_entries (user_id, date, source, amount_cents, status, note)
     VALUES (${U}, ${q(sideDate)}, 'side_job', ${rs(15000)}, 'expected', 'Website fix (invoice sent)')`);

// ---------- fixed bills ----------
const BILLS = [
  { name: 'House rent', amount: 45000, due: 1, category: 'Rent & housing' },
  { name: 'Personal loan', amount: 18000, due: 5, category: 'Loans' },
  { name: 'Electricity', amount: 6500, due: 10, category: 'Utilities' },
  { name: 'Mobile & fibre', amount: 4200, due: 15, category: 'Phone & internet' },
  { name: 'Streaming plan', amount: 1600, due: 20, category: 'Subscriptions' },
];
for (const b of BILLS) {
  add(`INSERT INTO fixed_bills (user_id, name, amount_cents, due_day, category_id)
       VALUES (${U}, ${q(b.name)}, ${rs(b.amount)}, ${b.due}, ${cat(b.category)})`);
}
const catType = (name: string) => DEFAULT_CATEGORIES.find((c) => c.name === name)!.type;
function payBill(b: (typeof BILLS)[number], c: CycleRange, paidOn: string, amount = b.amount) {
  add(`INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, fixed_bill_id)
       VALUES (${U}, ${rs(amount)}, ${q(paidOn)}, ${cat(b.category)}, ${q(catType(b.category))}, 'bank_transfer', ${q(b.name)}, ${bill(b.name)})`);
  add(`INSERT INTO bill_payments (user_id, bill_id, cycle_start, amount_cents, paid_at, expense_id)
       VALUES (${U}, ${bill(b.name)}, ${q(c.start)}, ${rs(amount)}, ${q(paidOn)}, last_insert_rowid())`);
}
for (const c of [c3, c2, c1]) {
  for (const b of BILLS) {
    const amount = b.name === 'Electricity' ? 5800 + Math.round(rand() * 1500) : b.amount;
    payBill(b, c, billDueDate(c, b.due), amount);
  }
}
// Current cycle: bills due before today are paid, the rest are still unpaid.
for (const b of BILLS) {
  const due = billDueDate(current, b.due);
  if (due < TODAY && b.name !== 'Electricity') payBill(b, current, due);
}

// ---------- savings ----------
for (const c of [c3, c2, c1]) {
  add(`INSERT INTO savings_moves (user_id, date, amount_cents, note)
       VALUES (${U}, ${q(addDays(c.start, 1))}, ${rs(37500)}, 'Monthly savings')`);
}
add(`INSERT INTO savings_moves (user_id, date, amount_cents, note)
     VALUES (${U}, ${q(addDays(c2.start, 11))}, ${rs(20000)}, 'Half of bonus')`);
add(`INSERT INTO savings_moves (user_id, date, amount_cents, note)
     VALUES (${U}, ${q(addDays(c1.start, 20))}, ${rs(-8000)}, 'Dentist (from savings)')`);
if (addDays(current.start, 1) <= TODAY) {
  add(`INSERT INTO savings_moves (user_id, date, amount_cents, note)
       VALUES (${U}, ${q(addDays(current.start, 1))}, ${rs(20000)}, 'Part of this month''s savings')`);
}

// ---------- daily expenses ----------
const DAILY: {
  category: string;
  notes: string[];
  min: number;
  max: number;
  chance: number;
  method: string[];
}[] = [
  {
    category: 'Food & groceries',
    notes: ['Keells groceries', 'Vegetables', 'Rice & dhal', 'Milk powder', 'Bakery'],
    min: 800,
    max: 6500,
    chance: 0.55,
    method: ['card', 'cash'],
  },
  {
    category: 'Transport',
    notes: ['Bus fare', 'PickMe ride', 'Fuel', 'Train ticket'],
    min: 150,
    max: 4500,
    chance: 0.5,
    method: ['cash', 'card'],
  },
  {
    category: 'Eating out',
    notes: ['Lunch with team', 'Kottu dinner', 'Coffee', 'Pizza night'],
    min: 600,
    max: 4800,
    chance: 0.22,
    method: ['card', 'cash'],
  },
  {
    category: 'Entertainment',
    notes: ['Cinema', 'Cricket match ticket', 'Game top-up'],
    min: 1200,
    max: 5000,
    chance: 0.05,
    method: ['card'],
  },
  {
    category: 'Medicine & health',
    notes: ['Pharmacy', 'Vitamins', 'Doctor visit'],
    min: 500,
    max: 4500,
    chance: 0.05,
    method: ['cash'],
  },
  {
    category: 'Fashion',
    notes: ['T-shirt', 'Sandals'],
    min: 1500,
    max: 6500,
    chance: 0.03,
    method: ['card'],
  },
  {
    category: 'Gifts',
    notes: ['Birthday gift', 'Wedding gift'],
    min: 2000,
    max: 8000,
    chance: 0.02,
    method: ['cash'],
  },
  {
    category: 'Hobbies',
    notes: ['Paint set', 'Guitar strings'],
    min: 900,
    max: 4000,
    chance: 0.02,
    method: ['card'],
  },
];
const refundTargets: string[] = [];
for (let d = c3.start; d <= TODAY; d = addDays(d, 1)) {
  for (const e of DAILY) {
    if (rand() > e.chance) continue;
    const amount = Math.round((e.min + rand() * (e.max - e.min)) / 10) * 10;
    const note = pick(e.notes);
    add(`INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note)
         VALUES (${U}, ${rs(amount)}, ${q(d)}, ${cat(e.category)}, ${q(catType(e.category))}, ${q(pick(e.method))}, ${q(note)})`);
    if (e.category === 'Fashion' && refundTargets.length === 0) {
      refundTargets.push(d);
      add(`INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, refund_of)
           VALUES (${U}, ${-rs(Math.round(amount / 2))}, ${q(addDays(d, 2) <= TODAY ? addDays(d, 2) : d)}, ${cat(e.category)},
                   'WANT', ${q(pick(e.method))}, 'Refund: returned one item', last_insert_rowid())`);
    }
  }
}

// ---------- wishlist (15 items, every status) ----------
interface SeedWish {
  name: string;
  category: string;
  type: 'NEED' | 'WANT';
  priority: 'HIGH' | 'MEDIUM' | 'LOW';
  urgency: 'NOW' | 'THIS_MONTH' | 'SOMEDAY';
  price: number;
  status: 'IDEA' | 'PLANNED' | 'BOUGHT' | 'DROPPED';
  addedDaysAgo: number;
  qty?: number;
  link?: string;
  note?: string;
  target?: string;
  reminder?: string;
  boughtDaysAgo?: number;
  actual?: number;
  droppedDaysAgo?: number;
}
const WISHES: SeedWish[] = [
  {
    name: 'Noise cancelling headphones',
    category: 'Gadgets',
    type: 'WANT',
    priority: 'MEDIUM',
    urgency: 'SOMEDAY',
    price: 38000,
    status: 'IDEA',
    addedDaysAgo: 45,
    link: 'https://example.com/headphones',
  },
  {
    name: 'Ergonomic office chair',
    category: 'Other',
    type: 'NEED',
    priority: 'HIGH',
    urgency: 'THIS_MONTH',
    price: 32000,
    status: 'IDEA',
    addedDaysAgo: 12,
    note: 'Back pain from the dining chair',
  },
  {
    name: 'Smart watch',
    category: 'Gadgets',
    type: 'WANT',
    priority: 'LOW',
    urgency: 'SOMEDAY',
    price: 55000,
    status: 'IDEA',
    addedDaysAgo: 3,
  },
  {
    name: 'Weekend trip to Ella',
    category: 'Travel',
    type: 'WANT',
    priority: 'MEDIUM',
    urgency: 'SOMEDAY',
    price: 45000,
    status: 'IDEA',
    addedDaysAgo: 70,
    note: 'With friends, after the rains',
  },
  {
    name: 'New running shoes',
    category: 'Fashion',
    type: 'WANT',
    priority: 'MEDIUM',
    urgency: 'THIS_MONTH',
    price: 16500,
    status: 'IDEA',
    addedDaysAgo: 20,
    reminder: TODAY,
  },
  {
    name: 'Spectacles (new prescription)',
    category: 'Medicine & health',
    type: 'NEED',
    priority: 'HIGH',
    urgency: 'NOW',
    price: 22000,
    status: 'IDEA',
    addedDaysAgo: 6,
  },
  {
    name: 'Rice cooker',
    category: 'Food & groceries',
    type: 'NEED',
    priority: 'MEDIUM',
    urgency: 'THIS_MONTH',
    price: 12500,
    status: 'PLANNED',
    addedDaysAgo: 25,
    target: current.start,
  },
  {
    name: 'Python course',
    category: 'Education',
    type: 'NEED',
    priority: 'HIGH',
    urgency: 'THIS_MONTH',
    price: 15000,
    status: 'PLANNED',
    addedDaysAgo: 40,
    target: current.start,
  },
  {
    name: 'Birthday gift for Amma',
    category: 'Gifts',
    type: 'WANT',
    priority: 'HIGH',
    urgency: 'THIS_MONTH',
    price: 9000,
    status: 'PLANNED',
    addedDaysAgo: 15,
    target: current.start,
  },
  {
    name: 'Bookshelf',
    category: 'Other',
    type: 'WANT',
    priority: 'LOW',
    urgency: 'SOMEDAY',
    price: 14000,
    status: 'PLANNED',
    addedDaysAgo: 50,
    target: c1.start,
    note: 'Planned last cycle – shows the rollover question',
  },
  {
    name: 'Water filter',
    category: 'Utilities',
    type: 'NEED',
    priority: 'HIGH',
    urgency: 'NOW',
    price: 18000,
    status: 'BOUGHT',
    addedDaysAgo: 80,
    boughtDaysAgo: 60,
    actual: 17250,
  },
  {
    name: 'Board game',
    category: 'Hobbies',
    type: 'WANT',
    priority: 'LOW',
    urgency: 'SOMEDAY',
    price: 7500,
    status: 'BOUGHT',
    addedDaysAgo: 65,
    boughtDaysAgo: 30,
    actual: 6900,
  },
  {
    name: 'School shoes for Nimal',
    category: 'Education',
    type: 'NEED',
    priority: 'HIGH',
    urgency: 'NOW',
    price: 6000,
    status: 'BOUGHT',
    addedDaysAgo: 14,
    boughtDaysAgo: 5,
    actual: 6400,
    qty: 1,
  },
  {
    name: 'Gaming console',
    category: 'Gadgets',
    type: 'WANT',
    priority: 'LOW',
    urgency: 'SOMEDAY',
    price: 145000,
    status: 'DROPPED',
    addedDaysAgo: 90,
    droppedDaysAgo: 40,
    note: 'Decided the old laptop is enough',
  },
  {
    name: 'Designer sunglasses',
    category: 'Fashion',
    type: 'WANT',
    priority: 'LOW',
    urgency: 'SOMEDAY',
    price: 28000,
    status: 'DROPPED',
    addedDaysAgo: 35,
    droppedDaysAgo: 8,
  },
];
for (const w of WISHES) {
  const added = addDays(TODAY, -w.addedDaysAgo);
  const bought = w.boughtDaysAgo !== undefined ? addDays(TODAY, -w.boughtDaysAgo) : null;
  const dropped = w.droppedDaysAgo !== undefined ? addDays(TODAY, -w.droppedDaysAgo) : null;
  const prev = w.status === 'BOUGHT' || w.status === 'DROPPED' ? 'IDEA' : null;
  add(`INSERT INTO wishlist_items (user_id, name, category_id, type, priority, urgency, estimated_cents, quantity, link,
         note, status, prev_status, added_at, target_cycle, reminder_date, bought_at, actual_cents, payment_method, dropped_at)
       VALUES (${U}, ${q(w.name)}, ${cat(w.category)}, ${q(w.type)}, ${q(w.priority)}, ${q(w.urgency)}, ${rs(w.price)},
         ${w.qty ?? 1}, ${q(w.link ?? null)}, ${q(w.note ?? null)}, ${q(w.status)}, ${q(prev)}, ${q(added)},
         ${q(w.target ?? null)}, ${q(w.reminder ?? null)}, ${q(bought)}, ${w.actual ? rs(w.actual) : 'NULL'},
         ${bought ? "'card'" : 'NULL'}, ${q(dropped)})`);
  add(`INSERT INTO wishlist_price_history (user_id, item_id, price_cents, changed_at)
       VALUES (${U}, ${wish(w.name)}, ${rs(w.price)}, ${q(added)})`);
  if (bought && w.actual) {
    add(`INSERT INTO expenses (user_id, amount_cents, date, category_id, type, payment_method, note, wishlist_item_id)
         VALUES (${U}, ${rs(w.actual)}, ${q(bought)}, ${cat(w.category)}, ${q(w.type)}, 'card', ${q(w.name)}, ${wish(w.name)})`);
  }
}
// Price history: headphones got cheaper over time.
add(`INSERT INTO wishlist_price_history (user_id, item_id, price_cents, changed_at)
     VALUES (${U}, ${wish('Noise cancelling headphones')}, ${rs(42000)}, ${q(addDays(TODAY, -46))})`);
add(`UPDATE wishlist_price_history SET changed_at = ${q(addDays(TODAY, -20))}
     WHERE item_id = ${wish('Noise cancelling headphones')} AND price_cents = ${rs(38000)}`);

// ---------- purchase checks (for "wants you skipped") ----------
add(`INSERT INTO purchase_checks (user_id, wishlist_item_id, amount_cents, type, warnings, choice, created_at)
     VALUES (${U}, ${wish('Smart watch')}, ${rs(55000)}, 'WANT', '["WANTS_OVER","COOLING_OFF"]', 'remind', ${q(addDays(TODAY, -2) + ' 10:00:00')})`);
add(`INSERT INTO purchase_checks (user_id, wishlist_item_id, amount_cents, type, warnings, choice, created_at)
     VALUES (${U}, ${wish('Designer sunglasses')}, ${rs(28000)}, 'WANT', '["WANTS_OVER"]', 'cancel', ${q(addDays(TODAY, -9) + ' 18:30:00')})`);

// ---------- closed cycles (the previous one stays open → rollover question) ----------
for (const c of [c3, c2]) {
  add(`INSERT INTO cycles (user_id, start_date, end_date, closed_at, summary)
       VALUES (${U}, ${q(c.start)}, ${q(c.end)}, ${q(addDays(c.end, 1) + ' 08:00:00')}, NULL)`);
}

const out = resolve(dirname(fileURLToPath(import.meta.url)), '../seed/seed.sql');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(
  out,
  `-- MoneyMind seed data for ${EMAIL}, generated ${TODAY} (current cycle ${current.start} → ${current.end}).\n` +
    `-- Regenerate with: npm run seed:gen\n` +
    sql.join('\n') +
    '\n',
);
console.log(`Wrote ${sql.length} statements to ${out} for ${EMAIL}`);
