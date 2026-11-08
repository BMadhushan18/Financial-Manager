# MoneyMind – Smart Salary & Spending Manager

A calm web app that helps one person:

- plan each salary month (income, bills, savings, spending),
- track expenses in a few seconds,
- keep a **lifetime wishlist** and plan what to buy this month,
- see **“safe to spend”** at a glance,
- get a gentle warning before a “want” hurts bills, savings or needs.

It does **not** connect to banks. Everything is entered by you. MoneyMind gives guidance, not financial advice, and never blocks your choice.

**Stack:** Vite + React + TypeScript · Cloudflare Pages + Pages Functions · Cloudflare D1 · username/password sign-in (optional Cloudflare Access) · Chart.js (lazy loaded). Runs on the Cloudflare **free plan**.

---

## Folder structure

```
.
├── functions/api/[[route]].ts   # Pages Function: every /api/* request
├── server/                      # API code (router, auth, DB, handlers)
│   ├── handlers/                # core, wishlist, expenses, cycle, reports, backup
│   ├── session.ts               # password sign-in sessions (HttpOnly cookie)
│   ├── auth.ts                  # optional Cloudflare Access sign-in (JWT check)
│   ├── context.ts               # loads one pay cycle and runs the finance rules
│   ├── db.ts  http.ts  router.ts
├── shared/                      # used by browser, API and tests
│   ├── finance.ts               # ALL money + cycle rules (pure functions)
│   ├── finance.test.ts          # Vitest unit tests
│   ├── types.ts  validation.ts  defaults.ts
├── src/                         # React app
│   ├── screens/                 # Home, Wishlist, Expenses, Plan, Reports, Settings, Onboarding
│   ├── components/              # UI parts, forms (bottom sheets), dialogs
│   ├── lib/                     # api client, context, hooks, labels, actions
│   ├── App.tsx  AppProvider.tsx  main.tsx  styles.css
├── migrations/                  # D1 schema (0001 init, 0002 password sign-in)
├── scripts/create-user.ts       # create / reset a sign-in account
├── scripts/generate-seed.ts     # writes seed/seed.sql (demo data)
├── scripts/make-icons.ts        # writes the PWA PNG icons
├── public/                      # manifest, icons, service worker
└── wrangler.toml
```

### How money is handled

All money is stored as **INTEGER cents** (Rs. 1,250.50 → `125050`). Amounts typed by the user are parsed with string maths (`parseMoneyToCents`); the API rejects non-integer amounts. Floating point is never used for money.

---

## 1. Run it on your computer

You need **Node.js 20+** and a free **Cloudflare account** (only for deploying).

```bash
git clone https://github.com/<you>/Financial-Manager.git
cd Financial-Manager
npm install

cp .dev.vars.example .dev.vars        # sets DEV_USER_EMAIL for local use
npm run db:migrate:local              # create the local D1 tables
npm run db:seed:local                 # optional: demo data (demo@moneymind.local)
npm run build                         # build the app once
```

Then use two terminals:

```bash
npm run dev:api    # terminal 1: API + database on http://127.0.0.1:8788
npm run dev        # terminal 2: React with hot reload on http://localhost:5173
```

Open http://localhost:5173. (Or open http://127.0.0.1:8788 to use the built app.)

With `DEV_USER_EMAIL` in `.dev.vars`, the local API skips sign-in and uses that email. This fallback **only works on localhost**. To try the real sign-in screen locally, remove that line and create an account with `scripts/create-user.ts --local` (see [Sign-in](#5-sign-in)).

Useful commands:

| Command                           | What it does                                                               |
| --------------------------------- | -------------------------------------------------------------------------- |
| `npm test`                        | Unit tests (cycle dates, safe to spend, checks, rollover, refunds, cents…) |
| `npm run typecheck`               | TypeScript strict check (app, API, scripts)                                |
| `npm run lint` / `npm run format` | ESLint / Prettier                                                          |
| `npm run check`                   | All of the above + build                                                   |
| `npm run seed:gen`                | Regenerate `seed/seed.sql` (dates are relative to today)                   |

---

## 2. Create the GitHub repository

1. Create an empty repository on GitHub (for example `Financial-Manager`).
2. Push this code:
   ```bash
   git add .
   git commit -m "MoneyMind"
   git branch -M main
   git remote add origin https://github.com/<you>/Financial-Manager.git   # skip if already set
   git push -u origin main
   ```

---

## 3. Create the D1 database

```bash
npx wrangler login
npx wrangler d1 create moneymind
```

Copy the `database_id` it prints into `wrangler.toml`:

```toml
[[d1_databases]]
binding = "DB"
database_name = "moneymind"
database_id = "paste-your-id-here"
```

Create the tables in the real database:

```bash
npm run db:migrate:remote
```

Optional demo data for your own email (so every screen has something to show):

```bash
SEED_EMAIL=you@example.com npm run db:seed:remote
```

> Seeding **replaces** all data of that email. Do not run it on an account you already use.

Commit the `wrangler.toml` change and push.

---

## 4. Deploy to Cloudflare Pages

### Option A – deploy from your computer (how the live site is deployed)

```bash
npx wrangler pages project create moneymind --production-branch main   # first time only
npm run build
npx wrangler pages deploy dist --project-name moneymind --branch main
```

The D1 binding comes from `wrangler.toml`. To deploy automatically on every push, add two GitHub repository secrets: `CLOUDFLARE_API_TOKEN` (permissions: _Cloudflare Pages – Edit_, _D1 – Edit_) and `CLOUDFLARE_ACCOUNT_ID`. The workflow in `.github/workflows/deploy.yml` then tests, migrates and deploys every push to `main`. Without the secrets it still runs the checks and skips the deploy.

### Option B – Git integration in the dashboard (alternative)

1. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
2. Pick your repository.
3. Build settings:
   - Framework preset: **None** (or Vite)
   - Build command: `npm run build`
   - Build output directory: `dist`
   - Environment variable: `NODE_VERSION` = `20`
4. Click **Save and Deploy**.

Every push to `main` now deploys automatically. The `functions/` folder becomes the API.

### Bind D1

Pages reads the binding from `wrangler.toml`. To check: Pages project → **Settings** → **Bindings**. You should see a **D1 database** binding named `DB` → `moneymind`. If not, add it there (name must be exactly `DB`) and redeploy.

---

## 5. Sign-in

MoneyMind has its own **username + password** sign-in:

- Passwords are stored only as salted PBKDF2-SHA256 hashes (100,000 rounds).
- Sessions use a random token in an `HttpOnly; Secure; SameSite=Lax` cookie. The database stores only a SHA-256 of the token.
- After 5 wrong passwords, sign-in is paused for 15 minutes.
- A new account gets a **temporary password**. At the first sign-in the app is locked until the user chooses a new one (8+ characters, a letter and a number).
- Changing the password signs out all other devices.

### Create an account

The password is typed only on your computer and **never stored in the repository** (important: this repo is public):

```bash
# remote = the real Cloudflare database (use --local for your computer)
USER_PASSWORD='temporary-password' npx tsx scripts/create-user.ts \
  --username yourname --email you@example.com --remote
```

Running it again for the same email resets the password (temporary again) and signs out every session. Add `--permanent` to skip the forced change.

On Windows PowerShell, set the password first: `$env:USER_PASSWORD='temporary-password'`, then run the command without the `USER_PASSWORD=...` prefix.

### Optional: Cloudflare Access as an extra lock

You can also put Cloudflare Access (email one-time code) in front of the whole site. Then people need both the email code and the password.

1. Cloudflare dashboard → **Zero Trust** (free plan is fine, up to 50 users).
2. **Settings → Authentication → Login methods**: make sure **One-time PIN** is enabled.
3. **Access → Applications → Add an application → Self-hosted**.
   - Application domain: your Pages domain, e.g. `moneymind.pages.dev`.
     Add a second domain `*.moneymind.pages.dev` so preview deployments are protected too.
   - Policy: **Allow**, rule **Emails** → your email address(es).
4. Save. Opening the site now asks for your email and sends you a code.

You can also let people sign in with **Access alone** (no password). To do that, set these in Pages → **Settings → Variables and secrets**. Copy the **Application Audience (AUD) tag** from the Access application:

| Name                 | Value                           |
| -------------------- | ------------------------------- |
| `ACCESS_TEAM_DOMAIN` | `yourteam.cloudflareaccess.com` |
| `ACCESS_AUD`         | the AUD tag                     |

The API then verifies the signed `Cf-Access-Jwt-Assertion` token. (`TRUST_ACCESS_HEADER=true` trusts the plain email header instead. Only use that when Access protects every domain of the site.) Without these variables, Access identity headers are ignored, so nobody can fake them.

Every SQL query filters by the signed-in user's id, so one user can never read another user's data.

---

## 6. Install as an app (PWA)

Open the site on your phone → browser menu → **Add to Home screen**. The app shell is cached by `public/sw.js`. API data is never cached.

---

## How it works

### Pay cycle

You choose a salary day (e.g. 25th). A cycle runs from salary day to the day before the next salary day. If the day does not exist in a month (31st in April), the last day of that month is used. You can switch to calendar months in Settings.

### Safe to spend

```
safe_to_spend = income this cycle (received + expected)
              − unpaid fixed bills − paid fixed bills
              − (savings goal not yet moved + savings already moved)
              − reserved price of planned wishlist items not yet bought
              − all other expenses this cycle
per day       = safe_to_spend ÷ days left in the cycle
```

### Needs vs wants

Categories are pre-labelled NEED or WANT. A new wish gets a suggested type from its category or from simple keywords, and the app always says why. Default split is 50 / 30 / 20 (needs / wants / savings) and can be changed.

### Wishlist priority score (0–100)

NEED +40 / WANT +10 · urgency NOW +30, THIS MONTH +20 · your priority HIGH +20, MEDIUM +10 · fits safe-to-spend +10, otherwise −10 · wants waiting 30+ days +5.

### Smart warning before buying

When you mark a wish as bought, or add an expense in a WANT category, the app checks:

1. unpaid need bills, 2. wants budget going over, 3. savings goal at risk, 4. being short before salary day, 5. a big want added less than N days ago (cooling-off).

If anything matches, one calm sheet shows all points with **Buy anyway**, **Remind me later**, **Move to next month** and **Cancel**. Needs only get checks 1 and 4. Your choice is logged for the “wants you paused” stat in Reports. Warnings can be turned off in Settings.

### Wishlist ⇄ expenses

- Marking a wish **bought** creates exactly one linked expense, in a single D1 transaction. A unique index makes duplicates impossible.
- **Undo** deletes that expense and returns the item to its previous status.
- Editing the linked expense updates the item.
- At the end of a cycle, planned items that were not bought need an explicit choice: this cycle, back to ideas, or drop. Nothing moves silently.

---

## API overview

All endpoints are JSON under `/api`, check the user, validate input on the server and use prepared statements.

| Method & path                                                                                           | Purpose                                               |
| ------------------------------------------------------------------------------------------------------- | ----------------------------------------------------- |
| `GET /api/bootstrap`                                                                                    | settings, categories, bills, savings goal             |
| `PUT /api/settings`                                                                                     | update settings                                       |
| `GET/POST /api/categories`, `PUT/DELETE /api/categories/:id?move_to=`                                   | categories (delete asks to move expenses first)       |
| `GET/POST /api/income`, `PUT/DELETE /api/income/:id`                                                    | income                                                |
| `GET/POST /api/fixed-bills`, `PUT/DELETE /api/fixed-bills/:id`                                          | bills                                                 |
| `POST /api/fixed-bills/:id/pay` · `/unpay`                                                              | pay a bill (creates linked expense) / undo            |
| `GET /api/savings`, `PUT /api/savings/goal`, `POST /api/savings/moves`, `DELETE /api/savings/moves/:id` | savings                                               |
| `GET/POST /api/wishlist`, `GET/PUT/DELETE /api/wishlist/:id`                                            | wishlist (+ price history)                            |
| `POST /api/wishlist/:id/plan` · `/unplan` · `/bought` · `/drop` · `/undo` · `/readd`                    | wishlist actions                                      |
| `GET/POST /api/expenses`, `PUT/DELETE /api/expenses/:id`, `POST /api/expenses/:id/refund`               | expenses and refunds                                  |
| `POST /api/purchase-check`                                                                              | warnings for a planned purchase (saves nothing)       |
| `POST /api/purchase-checks`                                                                             | log the user's choice after a warning                 |
| `GET /api/cycle/current`                                                                                | safe to spend, progress, bills, reminders, rollover   |
| `POST /api/cycle/close`                                                                                 | close previous cycle with a decision per planned item |
| `GET /api/reports?from=&to=`                                                                            | summary, by category, last 6 cycles, money saved      |
| `GET /api/export` · `POST /api/import`                                                                  | JSON backup / restore (replace)                       |
| `DELETE /api/data`                                                                                      | delete all of the user's data                         |

---

## Staying inside the free plan

- Pages: unlimited static requests, 100,000 Function requests per day.
- D1: 5 GB storage, 5 million rows read and 100,000 rows written per day.
- Access: free for up to 50 users.

A personal finance app for one person or a family uses a tiny fraction of this.

## Wishlist

The wishlist works like a simple to-do list: type anything and tap **Add**. When you buy it, tick the circle, enter the price you paid and confirm. MoneyMind records the expense and links it to the item. The need/want label is guessed quietly from the name and can be changed in the item's details.

## Privacy

- Data lives in your own Cloudflare D1 database.
- Tap the 👁 icon to hide all amounts on screen (privacy mode).
- Export a JSON backup any time from Settings.
