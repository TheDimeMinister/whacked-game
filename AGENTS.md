# Agent notes (Whacked)

Short-lived backlog and reminders for future sessions. Not a substitute for `README.md` / `TECH_SPEC.md`.

## Parked / todo

- [ ] **Custom SMTP for Supabase Auth** — When ready: Supabase Dashboard → **Project Settings → Authentication** → enable **Custom SMTP**. Set **sender name** (e.g. `The Agency`) and **sender email** (e.g. `TheAgency@officeassassination.com`), plus provider **host / port / username / password**. Add **SPF** and **DKIM** (and optionally **DMARC**) for the domain so mail is trusted. Details: [`TECH_SPEC.md`](TECH_SPEC.md) (Auth email / SMTP row). HTML under `supabase/templates/` only changes message **body**; the envelope **From** is set via SMTP, not those files.

- [ ] **Supabase Custom Domain (Auth / API hostname)** — Improves OAuth consent UX so users do not only see `*.supabase.co` (e.g. `auth.yourdomain.com`). Requires a **paid Supabase plan / Custom Domains add-on** (confirm current pricing in dashboard). Guide: [Custom Domains](https://supabase.com/docs/guides/platform/custom-domains). After activation: add the new **`https://<your-custom-host>/auth/v1/callback`** to each provider (Google, Facebook, Discord) redirect allowlists alongside the existing `*.supabase.co` callback; update app env / client URL when you cut over.

- [ ] **Facebook OAuth** — Supabase → **Authentication → Providers → Facebook**: enable, paste App ID + App Secret from [Meta for Developers](https://developers.facebook.com/) (Facebook Login product). Add **Valid OAuth Redirect URIs** in Meta to include Supabase’s callback `https://<project-ref>.supabase.co/auth/v1/callback` (and the custom-domain callback if you add one). App already has a Facebook button on [`AuthScreen.tsx`](src/routes/AuthScreen.tsx).

- [ ] **Discord OAuth** — Supabase → **Authentication → Providers → Discord**: enable, paste Client ID + Client Secret from [Discord Developer Portal](https://discord.com/developers/applications) → OAuth2. Set redirect to Supabase callback URL they show. App already has a Discord button on [`AuthScreen.tsx`](src/routes/AuthScreen.tsx).

## Done (context only)

- **Google** sign-in enabled and tested locally; UI: email form first, branded OAuth buttons in [`AuthScreen.tsx`](src/routes/AuthScreen.tsx). Facebook/Discord buttons exist but providers still need dashboard setup (see parked).
- Aesthetic teams + lobby shields, codename-required lobby join/create, global leaderboard RPC + Board tab — see [`TECH_SPEC.md`](TECH_SPEC.md) and `supabase/migrations/`.
