# Whacked

Social party game: React + Vite frontend, Supabase (Postgres + Auth + RLS + RPCs), Express API in `backend/` for privileged routes (e.g. admin test bots, Stripe stubs).

**Repo:** [github.com/TheDimeMinister/whacked-game](https://github.com/TheDimeMinister/whacked-game)

## Local dev

- **Frontend:** copy `.env.example` → `.env.local` (Vite `VITE_SUPABASE_*`), then `npm run dev`.
- **API:** copy env block for backend → `backend/.env`, then `npm run start:api` (or `npm run dev:all` for API + Vite together).

See `.env.example` for Render / Vercel notes.

## Production (Vercel + Render)

- **Vercel** (`vercel.json`) proxies `/api/*` to your Render Web Service. The destination host must match the **exact** `.onrender.com` URL shown in the Render dashboard for the service that runs `backend/` (see **Settings → Name / URL**).
- **If `https://whacked-api.onrender.com/api/health` is “Not Found”:** that usually means **no Web Service uses that hostname yet**. A quick check: `curl -sI https://whacked-api.onrender.com/api/health` — if you see **`x-render-routing: no-server`**, Render is not routing to any app on that subdomain (not an Express route bug). Your live API is still on whatever URL Render lists for the service you actually deploy (for example the longer default hostname until you rename it).
- **Shorter URL:** open the **same** Web Service that already deploys this repo’s `backend/` → **Settings** → set **Name** to **`whacked-api`** → save, then wait for the dashboard URL to show `https://whacked-api.onrender.com`. Confirm `GET /api/health` returns `{"ok":true}` on that host, then update `vercel.json` `destination` to `https://whacked-api.onrender.com/api/:path*` and redeploy Vercel. Avoid creating a second empty service named `whacked-api`; rename the existing API service instead.
- Optional: [`render.yaml`](render.yaml) documents the same service for Blueprints / new installs; env vars stay in the Render dashboard.
