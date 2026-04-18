# Whacked

Social party game: React + Vite frontend, Supabase (Postgres + Auth + RLS + RPCs), Express API in `backend/` for privileged routes (e.g. admin test bots, Stripe stubs).

**Repo:** [github.com/TheDimeMinister/whacked-game](https://github.com/TheDimeMinister/whacked-game)

## Local dev

- **Frontend:** copy `.env.example` → `.env.local` (Vite `VITE_SUPABASE_*`), then `npm run dev`.
- **API:** copy env block for backend → `backend/.env`, then `npm run start:api` (or `npm run dev:all` for API + Vite together).

See `.env.example` for Render / Vercel notes.
