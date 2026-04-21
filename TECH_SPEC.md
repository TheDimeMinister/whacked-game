# Technical specification

High-level inventory of **what is used in this repo and what it is for**. Operational runbooks (local dev, Vercel, Render, Capacitor) stay in the root [`README.md`](README.md).

---

## Frontend (SPA)

| Technology | Role |
|------------|------|
| **React 19** | UI components, screens, and client-side state. |
| **TypeScript** | Typed source under `src/`. |
| **Vite** | Dev server, production bundler, and static asset pipeline (`public/` → `dist/`). |
| **React Router** | Client-side routing (`/welcome`, `/auth`, `/app/…`). |
| **TanStack React Query** | Server state: fetching lobbies, games, profiles, cache invalidation after mutations and realtime hints. |
| **Zod** | Validates `import.meta.env` (e.g. `VITE_SUPABASE_*`) in `src/lib/env.ts`. |
| **Framer Motion** | Optional motion/animation where used in UI. |
| **Plain CSS** | Global layout and theming in `src/index.css` (including `html[data-ui-tone]` for calm vs in-round “heat”). |

---

## Backend-as-a-service

| Technology | Role |
|------------|------|
| **Supabase (hosted)** | **Postgres** database, **Row Level Security** policies, **Auth** (email/password, reset flows), **Realtime** subscriptions for lobby/game rows, and **SQL RPCs** (`security definer`) for sensitive actions (create/join lobby, start game, whack flow, admin helpers, etc.). |
| **SQL migrations** | Schema and function definitions in `supabase/migrations/`; applied to your Supabase project (CLI or SQL editor). |
| **Supabase Auth URL config** | Production site URL and redirect allowlist for email links (confirm, password reset). |
| **OAuth (Google / Facebook / Discord)** | Enable each provider under **Authentication → Providers** in the Supabase dashboard and paste the provider client id/secret. Under **URL configuration**, add every web origin that should return to the app after OAuth (production, Vercel previews if used, `http://localhost:5173` or your Vite port). The app sends `redirectTo` `${origin}/auth` from `getAuthRedirectBase()` so the session is established on the auth route. In **Google Cloud Console**, **Discord Developer Portal**, and **Meta for Developers** (Facebook Login), register the redirect URI that Supabase shows for that provider (typically `https://<project-ref>.supabase.co/auth/v1/callback`). For Capacitor builds, add the app’s custom URL scheme redirect if you use native OAuth flows later. |
| **Email HTML templates** | Reference copies under `supabase/templates/` for pasting into the Supabase dashboard (branded transactional mail). |
| **Auth email “From” (branding)** | The visible sender (**e.g.** `The Agency <TheAgency@officeassassination.com>`) is **not** set in those HTML files. Configure **Project Settings → Authentication → SMTP** with a **Custom SMTP** provider (SendGrid, Resend, Amazon SES, etc.), then set **Sender email** and **Sender name** there. Add **SPF**, **DKIM**, and optionally **DMARC** DNS records for `officeassassination.com` so mail is not flagged as spam. Until custom SMTP is enabled, messages are sent by Supabase’s default infrastructure (“Supabase Auth” style). **Parked:** tracked as a checkbox in root [`AGENTS.md`](AGENTS.md). |

The browser talks to Supabase with the **anon key**; privileged server logic uses the **service role** only inside the Express API (never shipped to the client).

---

## Application API (Node)

| Technology | Role |
|------------|------|
| **Node.js 20+** | Runtime for the small API service. |
| **Express** | HTTP server in `backend/server.js`: CORS, JSON body, route mounting. |
| **dotenv** | Loads `backend/.env` locally. |
| **Stripe routes** | `backend/routes/stripe/*` — checkout / webhook scaffolding (MVP; extend for real payments). |
| **Admin routes** | e.g. lobby test-bot creation when enabled and authorized. |

**Why it exists:** anything that must not use only the browser anon key (webhooks, service-role calls, optional admin tools) lives here.

---

## Infrastructure & delivery

| Piece | Role |
|-------|------|
| **Vercel** (typical) | Hosts the Vite **production build** (`npm run build`). |
| **`vercel.json`** | Rewrites `/api/*` to the deployed **Express** origin (e.g. Render); SPA fallback to `index.html` for client routes. |
| **Render** (typical) | Hosts the **Express** `backend/` service; must match the URL configured in `vercel.json`. |
| **`public/`** | Static files served as-is (favicons, `site.webmanifest`, brand images). |

---

## Optional native shells

| Technology | Role |
|------------|------|
| **Capacitor** | Wraps the same web `dist/` in **iOS** / **Android** WebViews for store-style distribution if desired. |
| **`capacitor.config.ts`** | App id, web dir, native project wiring. |
| **`npm run build:cap`** | Production web build + `cap sync` into native projects. |

Capacitor is **optional**; the product is fully usable as a normal website and “Add to Home Screen” PWA-style install.

---

## Notable integration points

| Area | Implementation |
|------|------------------|
| **Auth session** | `AuthProvider` + Supabase JS client (`createClient` in `src/lib/supabase.ts`); email/password, **OAuth** (`signInWithOAuth` for Google / Facebook / Discord), password reset / update, and `getAuthRedirectBase()` for correct redirect URLs per host. |
| **Game session** | `GameSessionProvider` tracks active lobby/game ids for deep links and layout. |
| **Codename in rooms** | `profiles.display_name` is the lobby name; `create_lobby` / `join_lobby_by_invite` require it (see migrations). Join RPC is single-argument (`p_invite_code` only). |
| **Global leaderboard** | `get_global_leaderboard(p_sort, p_limit)` (`SECURITY DEFINER`) returns ranked rows for the Board tab; sorts: `kills`, `kd` (win rate), `wins`. |
| **Payments** | Stripe via Express; entitlements / packs can tie into DB when fully wired. |

---

## Version constraints

- **Node:** `>=20` (see root and `backend/package.json` `engines`).

For environment variable names and deployment notes, see **`.env.example`** and the root **README**.
