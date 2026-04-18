-- Whacked! core schema, RLS, seeds (run on Supabase Postgres)

-- Extensions
create extension if not exists "pgcrypto";

-- Enums
create type public.lobby_status as enum ('open', 'closed');
create type public.target_mode as enum ('random', 'inheritance');
create type public.game_status as enum ('active', 'ended', 'cancelled');
create type public.ended_reason as enum (
  'whack_accepted',
  'cancelled',
  'lobby_closed'
);
create type public.whack_attempt_status as enum (
  'pending_target',
  'accepted',
  'declined',
  'expired'
);
create type public.entitlement_status as enum ('pending', 'active', 'refunded');

-- Profiles (1:1 auth.users)
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  avatar_key text,
  equipped_title_id text,
  stripe_customer_id text,
  notification_prefs jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.player_stats (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  wins int not null default 0,
  losses int not null default 0,
  total_whack_declarations int not null default 0,
  successful_whacks int not null default 0,
  weapon_counts jsonb not null default '{}'::jsonb,
  badges jsonb not null default '[]'::jsonb,
  updated_at timestamptz not null default now()
);

create table public.weapon_packs (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  description text,
  is_premium boolean not null default false,
  stripe_price_id text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);

create table public.weapons (
  id uuid primary key default gen_random_uuid(),
  pack_id uuid not null references public.weapon_packs (id) on delete cascade,
  slug text not null,
  name text not null,
  unique (pack_id, slug)
);

create table public.lobbies (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  host_id uuid not null references auth.users (id) on delete restrict,
  weapon_pack_id uuid not null references public.weapon_packs (id),
  target_mode public.target_mode not null default 'random',
  status public.lobby_status not null default 'open',
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table public.lobby_members (
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  display_name text not null,
  ready boolean not null default false,
  joined_at timestamptz not null default now(),
  left_at timestamptz,
  primary key (lobby_id, user_id)
);

create index lobby_members_active_idx
  on public.lobby_members (lobby_id)
  where left_at is null;

create table public.games (
  id uuid primary key default gen_random_uuid(),
  lobby_id uuid not null references public.lobbies (id) on delete cascade,
  status public.game_status not null default 'active',
  winner_user_id uuid references auth.users (id),
  ended_reason public.ended_reason,
  created_at timestamptz not null default now(),
  ended_at timestamptz
);

create index games_lobby_active_idx
  on public.games (lobby_id)
  where status = 'active';

create table public.assignments (
  game_id uuid not null references public.games (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete restrict,
  weapon_id uuid not null references public.weapons (id) on delete restrict,
  primary key (game_id, user_id),
  unique (game_id, weapon_id)
);

create table public.whack_attempts (
  id uuid primary key default gen_random_uuid(),
  game_id uuid not null references public.games (id) on delete cascade,
  declarer_id uuid not null references auth.users (id) on delete cascade,
  target_user_id uuid not null references auth.users (id) on delete cascade,
  weapon_id uuid not null references public.weapons (id) on delete restrict,
  status public.whack_attempt_status not null default 'pending_target',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create unique index whack_attempts_one_pending_per_game
  on public.whack_attempts (game_id)
  where status = 'pending_target';

create table public.game_events (
  id bigserial primary key,
  game_id uuid not null references public.games (id) on delete cascade,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index game_events_game_created_idx
  on public.game_events (game_id, created_at desc);

create table public.entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  pack_id uuid not null references public.weapon_packs (id) on delete cascade,
  stripe_checkout_session_id text unique,
  status public.entitlement_status not null default 'pending',
  created_at timestamptz not null default now(),
  unique (user_id, pack_id)
);

-- Invite code generator (6 uppercase alphanumeric)
-- Include `extensions` so gen_random_bytes (pgcrypto) resolves when callers use
-- search_path = public only (e.g. SECURITY DEFINER RPCs on Supabase).
create or replace function public.generate_invite_code()
returns text
language sql
set search_path = public, extensions
as $$
  select upper(
    substring(
      translate(encode(gen_random_bytes(5), 'base64'), '+/', 'AZ')
      from 1 for 6
    )
  );
$$;

create or replace function public.set_lobby_invite_code()
returns trigger
language plpgsql
as $$
begin
  if new.invite_code is null or new.invite_code = '' then
    new.invite_code := public.generate_invite_code();
  end if;
  return new;
end;
$$;

create trigger trg_lobbies_invite_code
  before insert on public.lobbies
  for each row
  execute function public.set_lobby_invite_code();

create or replace function public.touch_profile_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_profiles_updated
  before update on public.profiles
  for each row
  execute function public.touch_profile_updated_at();

-- New user bootstrap
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'player'), '@', 1)
    )
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();

-- Seed default pack + weapons (>= 8 for small games headroom)
insert into public.weapon_packs (slug, name, description, is_premium, sort_order)
values (
  'default',
  'Standard Issue',
  'Everyday harmless objects. Free for everyone.',
  false,
  0
);

insert into public.weapons (pack_id, slug, name)
select id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('pen', 'Ballpoint Pen'),
    ('coin', 'Coin'),
    ('sticky_note', 'Sticky Note'),
    ('paperclip', 'Paperclip'),
    ('usb', 'USB Drive'),
    ('highlighter', 'Highlighter'),
    ('rubber_band', 'Rubber Band'),
    ('keycard', 'Keycard'),
    ('coffee_mug', 'Coffee Mug'),
    ('lanyard', 'Lanyard')
) as v(slug, name)
where p.slug = 'default';

insert into public.weapon_packs (slug, name, description, is_premium, stripe_price_id, sort_order)
values
  ('office_chaos', 'Office Chaos', 'Themed cosmetic pack — unlock via Stripe later.', true, null, 1),
  ('funny', 'Comedy Arsenal', 'Humorous props — cosmetic only.', true, null, 2);

-- RLS
alter table public.profiles enable row level security;
alter table public.player_stats enable row level security;
alter table public.weapon_packs enable row level security;
alter table public.weapons enable row level security;
alter table public.lobbies enable row level security;
alter table public.lobby_members enable row level security;
alter table public.games enable row level security;
alter table public.assignments enable row level security;
alter table public.whack_attempts enable row level security;
alter table public.game_events enable row level security;
alter table public.entitlements enable row level security;

-- Helper: is active member of lobby
create or replace function public.is_lobby_member(p_lobby_id uuid, p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.lobby_members lm
    where lm.lobby_id = p_lobby_id
      and lm.user_id = p_user
      and lm.left_at is null
  );
$$;

grant execute on function public.is_lobby_member(uuid, uuid) to authenticated;

-- profiles
create policy profiles_select_own
  on public.profiles for select
  using (auth.uid() = id);

create policy profiles_select_lobby_peers
  on public.profiles for select
  using (
    exists (
      select 1
      from public.lobby_members lm1
      join public.lobby_members lm2
        on lm1.lobby_id = lm2.lobby_id
       and lm1.left_at is null
       and lm2.left_at is null
      where lm1.user_id = auth.uid()
        and lm2.user_id = profiles.id
    )
  );

create policy profiles_update_own
  on public.profiles for update
  using (auth.uid() = id)
  with check (auth.uid() = id);

-- player_stats: self + lobby peers (for future leaderboards in lobby)
create policy player_stats_select_own
  on public.player_stats for select
  using (auth.uid() = user_id);

create policy player_stats_select_peers
  on public.player_stats for select
  using (
    exists (
      select 1
      from public.lobby_members lm1
      join public.lobby_members lm2
        on lm1.lobby_id = lm2.lobby_id
       and lm1.left_at is null
       and lm2.left_at is null
      where lm1.user_id = auth.uid()
        and lm2.user_id = player_stats.user_id
    )
  );

-- catalog
create policy weapon_packs_read
  on public.weapon_packs for select
  to authenticated
  using (true);

create policy weapons_read
  on public.weapons for select
  to authenticated
  using (true);

-- lobbies
create policy lobbies_select_member
  on public.lobbies for select
  using (public.is_lobby_member(id, auth.uid()));

create policy lobbies_insert_host
  on public.lobbies for insert
  with check (auth.uid() = host_id);

create policy lobbies_update_host
  on public.lobbies for update
  using (auth.uid() = host_id)
  with check (auth.uid() = host_id);

-- lobby_members
create policy lobby_members_select_same_lobby
  on public.lobby_members for select
  using (public.is_lobby_member(lobby_id, auth.uid()));

create policy lobby_members_insert_self_open
  on public.lobby_members for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from public.lobbies l
      where l.id = lobby_id and l.status = 'open'
    )
  );

create policy lobby_members_update_self
  on public.lobby_members for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- games
create policy games_select_member
  on public.games for select
  using (public.is_lobby_member(lobby_id, auth.uid()));

-- assignments: only own row
create policy assignments_select_own
  on public.assignments for select
  using (auth.uid() = user_id);

-- whack_attempts: declarer or target only
create policy whack_attempts_select_parties
  on public.whack_attempts for select
  using (auth.uid() = declarer_id or auth.uid() = target_user_id);

-- game_events: lobby members
create policy game_events_select_member
  on public.game_events for select
  using (
    exists (
      select 1 from public.games g
      where g.id = game_id
        and public.is_lobby_member(g.lobby_id, auth.uid())
    )
  );

-- entitlements: own rows only
create policy entitlements_select_own
  on public.entitlements for select
  using (auth.uid() = user_id);

-- Realtime
alter publication supabase_realtime add table public.lobby_members;
alter publication supabase_realtime add table public.lobbies;
alter publication supabase_realtime add table public.games;
alter publication supabase_realtime add table public.whack_attempts;
alter publication supabase_realtime add table public.game_events;
