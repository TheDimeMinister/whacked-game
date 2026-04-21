# Whacked

Social party game: React + Vite frontend, Supabase (Postgres + Auth + RLS + RPCs), Express API in `backend/` for privileged routes (e.g. admin test bots, Stripe stubs).

**Tech stack (detailed):** see [`TECH_SPEC.md`](TECH_SPEC.md).

**AI / parked tasks:** see [`AGENTS.md`](AGENTS.md) (e.g. custom SMTP when you pick a provider).

**Repo:** [github.com/TheDimeMinister/whacked-game](https://github.com/TheDimeMinister/whacked-game)

## Local dev

- **Frontend:** copy `.env.example` → `.env.local` (Vite `VITE_SUPABASE_*`), then `npm run dev`.
- **API:** copy env block for backend → `backend/.env`, then `npm run start:api` (or `npm run dev:all` for API + Vite together).

See `.env.example` for Render / Vercel notes.

**Branded auth email:** transactional “From” (e.g. `TheAgency@officeassassination.com`) is configured in the Supabase dashboard under **Authentication → SMTP** (custom SMTP + DNS), not in repo HTML — see [`TECH_SPEC.md`](TECH_SPEC.md).

## Production (Vercel + Render)

- **Vercel** (`vercel.json`) proxies `/api/*` to your Render Web Service. The destination host must match the **exact** `.onrender.com` URL shown in the Render dashboard for the service that runs `backend/` (see **Settings → Name / URL**).
- **If some `https://….onrender.com` URL is “Not Found”:** check whether it is your service at all. `curl -sI <url>/api/health` — **`x-render-routing: no-server`** means Render has no Web Service on that hostname. A working Express deploy shows headers like **`x-powered-by: Express`**.
- **Renaming the service in the dashboard often does not change the default `*.onrender.com` URL.** That hostname is tied to how the service was **first** created (the initial slug). Your app can keep using the long URL forever; `vercel.json` only needs to match whatever Render shows for that service.
- **If you want a short, stable public URL:** add a **custom domain** on that Web Service (Render **Settings → Custom Domains**), e.g. `api.yourdomain.com`, then point `vercel.json` at `https://api.yourdomain.com/api/:path*`. Alternatively, create a **new** Web Service whose name from day one is `whacked-api` (copy env/build/start from the old one), verify health, update `vercel.json`, then delete the old service.
- Optional: [`render.yaml`](render.yaml) documents the same service for Blueprints / new installs; env vars stay in the Render dashboard.

## Mobile (Capacitor)

Native shells load the same Vite build as the website (`webDir`: `dist`). App id: `app.whacked.game` (change in [`capacitor.config.ts`](capacitor.config.ts) before store submission if you use a different bundle id).

**Store release checklist:** [docs/MOBILE_STORE_DEPLOYMENT.md](docs/MOBILE_STORE_DEPLOYMENT.md)

**Prerequisites**

- Node 20+ (see `engines` in `package.json`).
- **Android:** Android Studio + SDK. **iOS:** macOS + Xcode + [CocoaPods](https://capacitorjs.com/docs/getting-started/environment-setup#ios-requirements) (Capacitor docs).

**Workflow**

1. Set `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in the environment (same as web), then:
2. `npm run build:cap` — runs `tsc` + Vite build, then `cap sync` to copy `dist/` into the native projects.

**Open in IDEs**

- Android: `npm run cap:open:android`
- iOS: add the platform once on a Mac (`npx cap add ios`), then `npm run cap:open:ios`

**Store binaries (not done by npm)**

- **Google Play:** build a signed **Android App Bundle (`.aab`)** from Android Studio (or Gradle) and upload in Play Console.
- **App Store:** **Archive → Distribute App** from Xcode to App Store Connect.

This repo currently includes the **Android** project. **iOS** must be generated on a machine with CocoaPods: `npx cap add ios` then `npm run build:cap`.
