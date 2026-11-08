-- MoneyMind initial schema.
-- Money is stored as INTEGER cents. Dates are TEXT 'YYYY-MM-DD'.
-- Every table carries user_id; the API filters every query by it.

CREATE TABLE users (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  email       TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE settings (
  user_id                 INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  salary_day              INTEGER NOT NULL DEFAULT 25 CHECK (salary_day BETWEEN 1 AND 31),
  cycle_mode              TEXT    NOT NULL DEFAULT 'salary' CHECK (cycle_mode IN ('salary', 'calendar')),
  currency                TEXT    NOT NULL DEFAULT 'LKR',
  salary_cents            INTEGER NOT NULL DEFAULT 0 CHECK (salary_cents >= 0),
  split_needs             INTEGER NOT NULL DEFAULT 50,
  split_wants             INTEGER NOT NULL DEFAULT 30,
  split_savings           INTEGER NOT NULL DEFAULT 20,
  warnings_enabled        INTEGER NOT NULL DEFAULT 1 CHECK (warnings_enabled IN (0, 1)),
  big_want_percent        INTEGER NOT NULL DEFAULT 10 CHECK (big_want_percent BETWEEN 1 AND 100),
  cooling_days            INTEGER NOT NULL DEFAULT 7 CHECK (cooling_days BETWEEN 0 AND 90),
  emergency_months        INTEGER NOT NULL DEFAULT 3 CHECK (emergency_months BETWEEN 0 AND 24),
  emergency_target_cents  INTEGER CHECK (emergency_target_cents IS NULL OR emergency_target_cents >= 0),
  last_salary_cycle       TEXT,
  onboarded               INTEGER NOT NULL DEFAULT 0 CHECK (onboarded IN (0, 1)),
  updated_at              TEXT    NOT NULL DEFAULT (datetime('now')),
  CHECK (split_needs >= 0 AND split_wants >= 0 AND split_savings >= 0
         AND split_needs + split_wants + split_savings = 100)
);

CREATE TABLE categories (
  id                   INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id              INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name                 TEXT    NOT NULL,
  type                 TEXT    NOT NULL CHECK (type IN ('NEED', 'WANT')),
  priority             TEXT    NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  icon                 TEXT    NOT NULL DEFAULT '🏷️',
  color                TEXT    NOT NULL DEFAULT '#94A3B8',
  monthly_limit_cents  INTEGER CHECK (monthly_limit_cents IS NULL OR monthly_limit_cents >= 0),
  is_default           INTEGER NOT NULL DEFAULT 0 CHECK (is_default IN (0, 1)),
  is_archived          INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1)),
  created_at           TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_categories_user_name ON categories (user_id, name COLLATE NOCASE);

CREATE TABLE income_entries (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  source        TEXT    NOT NULL DEFAULT 'salary'
                CHECK (source IN ('salary', 'bonus', 'side_job', 'gift', 'refund', 'other')),
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  status        TEXT    NOT NULL DEFAULT 'received' CHECK (status IN ('expected', 'received')),
  note          TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_income_user_date ON income_entries (user_id, date);

CREATE TABLE fixed_bills (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  due_day       INTEGER NOT NULL CHECK (due_day BETWEEN 1 AND 31),
  category_id   INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  is_active     INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_bills_user ON fixed_bills (user_id, is_active);

CREATE TABLE wishlist_items (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id          INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name             TEXT    NOT NULL,
  category_id      INTEGER REFERENCES categories(id) ON DELETE SET NULL,
  type             TEXT    NOT NULL DEFAULT 'WANT' CHECK (type IN ('NEED', 'WANT')),
  priority         TEXT    NOT NULL DEFAULT 'MEDIUM' CHECK (priority IN ('HIGH', 'MEDIUM', 'LOW')),
  urgency          TEXT    NOT NULL DEFAULT 'SOMEDAY' CHECK (urgency IN ('NOW', 'THIS_MONTH', 'SOMEDAY')),
  estimated_cents  INTEGER CHECK (estimated_cents IS NULL OR estimated_cents >= 0),
  quantity         INTEGER NOT NULL DEFAULT 1 CHECK (quantity >= 1),
  link             TEXT,
  note             TEXT,
  status           TEXT    NOT NULL DEFAULT 'IDEA' CHECK (status IN ('IDEA', 'PLANNED', 'BOUGHT', 'DROPPED')),
  prev_status      TEXT    CHECK (prev_status IS NULL OR prev_status IN ('IDEA', 'PLANNED', 'BOUGHT', 'DROPPED')),
  added_at         TEXT    NOT NULL,
  target_cycle     TEXT,
  reminder_date    TEXT,
  bought_at        TEXT,
  actual_cents     INTEGER CHECK (actual_cents IS NULL OR actual_cents >= 0),
  payment_method   TEXT    CHECK (payment_method IS NULL OR payment_method IN ('cash', 'card', 'bank_transfer', 'other')),
  dropped_at       TEXT,
  repeat_of        INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
  updated_at       TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_wishlist_user_status ON wishlist_items (user_id, status);
CREATE INDEX idx_wishlist_user_added ON wishlist_items (user_id, added_at);
CREATE INDEX idx_wishlist_user_reminder ON wishlist_items (user_id, reminder_date);

CREATE TABLE wishlist_price_history (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  item_id      INTEGER NOT NULL REFERENCES wishlist_items(id) ON DELETE CASCADE,
  price_cents  INTEGER NOT NULL CHECK (price_cents >= 0),
  changed_at   TEXT    NOT NULL
);
CREATE INDEX idx_price_history_item ON wishlist_price_history (item_id, changed_at);

CREATE TABLE expenses (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  amount_cents      INTEGER NOT NULL CHECK (amount_cents <> 0),
  date              TEXT    NOT NULL,
  category_id       INTEGER REFERENCES categories(id) ON DELETE RESTRICT,
  type              TEXT    NOT NULL CHECK (type IN ('NEED', 'WANT')),
  payment_method    TEXT    NOT NULL DEFAULT 'cash'
                    CHECK (payment_method IN ('cash', 'card', 'bank_transfer', 'other')),
  note              TEXT,
  wishlist_item_id  INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
  fixed_bill_id     INTEGER REFERENCES fixed_bills(id) ON DELETE SET NULL,
  refund_of         INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  created_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at        TEXT    NOT NULL DEFAULT (datetime('now')),
  -- refunds are negative and linked; normal expenses are positive
  CHECK ((refund_of IS NULL AND amount_cents > 0) OR (refund_of IS NOT NULL AND amount_cents < 0))
);
CREATE INDEX idx_expenses_user_date ON expenses (user_id, date);
CREATE INDEX idx_expenses_user_category ON expenses (user_id, category_id);
CREATE INDEX idx_expenses_refund ON expenses (refund_of);
CREATE INDEX idx_expenses_bill ON expenses (fixed_bill_id);
-- one wishlist item can never have more than one expense
CREATE UNIQUE INDEX idx_expenses_wishlist ON expenses (wishlist_item_id) WHERE wishlist_item_id IS NOT NULL;

CREATE TABLE bill_payments (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  bill_id       INTEGER NOT NULL REFERENCES fixed_bills(id) ON DELETE CASCADE,
  cycle_start   TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents > 0),
  paid_at       TEXT    NOT NULL,
  expense_id    INTEGER REFERENCES expenses(id) ON DELETE CASCADE,
  UNIQUE (bill_id, cycle_start)
);
CREATE INDEX idx_bill_payments_user_cycle ON bill_payments (user_id, cycle_start);

CREATE TABLE savings_goals (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  mode          TEXT    NOT NULL DEFAULT 'percent' CHECK (mode IN ('amount', 'percent')),
  amount_cents  INTEGER NOT NULL DEFAULT 0 CHECK (amount_cents >= 0),
  percent       INTEGER NOT NULL DEFAULT 20 CHECK (percent BETWEEN 0 AND 100),
  updated_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE savings_moves (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  amount_cents  INTEGER NOT NULL CHECK (amount_cents <> 0), -- negative = taken out of savings
  note          TEXT,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_savings_moves_user_date ON savings_moves (user_id, date);

CREATE TABLE purchase_checks (
  id                INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id           INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  wishlist_item_id  INTEGER REFERENCES wishlist_items(id) ON DELETE SET NULL,
  amount_cents      INTEGER NOT NULL,
  type              TEXT    NOT NULL CHECK (type IN ('NEED', 'WANT')),
  warnings          TEXT    NOT NULL DEFAULT '[]', -- JSON array of warning codes
  choice            TEXT    NOT NULL CHECK (choice IN ('buy', 'remind', 'next_month', 'cancel')),
  created_at        TEXT    NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_purchase_checks_user_date ON purchase_checks (user_id, created_at);

CREATE TABLE cycles (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  start_date  TEXT    NOT NULL,
  end_date    TEXT    NOT NULL,
  closed_at   TEXT,
  summary     TEXT, -- JSON CycleSummary
  UNIQUE (user_id, start_date)
);
