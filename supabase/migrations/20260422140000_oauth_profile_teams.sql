-- OAuth-friendly profile bootstrap + aesthetic teams (lobby badges)

-- ---------------------------------------------------------------------------
-- handle_new_user: richer display_name from OAuth metadata
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_display text;
begin
  v_display := coalesce(
    nullif(trim(new.raw_user_meta_data->>'display_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'full_name'), ''),
    nullif(trim(new.raw_user_meta_data->>'name'), ''),
    nullif(trim(new.raw_user_meta_data->>'preferred_username'), ''),
    nullif(trim(new.raw_user_meta_data->>'user_name'), ''),
    split_part(coalesce(new.email, 'player'), '@', 1)
  );

  insert into public.profiles (id, display_name, avatar_key)
  values (
    new.id,
    v_display,
    nullif(trim(new.raw_user_meta_data->>'avatar_key'), '')
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Teams (cosmetic; visibility to lobby peers + teammates)
-- ---------------------------------------------------------------------------
create type public.team_member_role as enum ('owner', 'member');

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  invite_code text not null unique,
  name text not null,
  shield_key text not null,
  owner_user_id uuid not null references auth.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  constraint teams_name_len check (char_length(trim(name)) between 1 and 48),
  constraint teams_shield_key_check check (
    shield_key in ('vault', 'blade', 'skull', 'scope', 'crown', 'serpent')
  )
);

create table public.team_members (
  team_id uuid not null references public.teams (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.team_member_role not null default 'member',
  joined_at timestamptz not null default now(),
  primary key (team_id, user_id)
);

create unique index team_members_one_user on public.team_members (user_id);

create or replace function public.set_team_invite_code()
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

create trigger trg_teams_invite_code
  before insert on public.teams
  for each row
  execute function public.set_team_invite_code();

alter table public.teams enable row level security;
alter table public.team_members enable row level security;

-- Members always see their office; lobby peers see teams of anyone in the same room (badges).
create policy teams_select_lobby_or_member
  on public.teams for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = teams.id
        and tm.user_id = auth.uid()
    )
    or exists (
      select 1
      from public.team_members tm
      join public.lobby_members lm_peer
        on lm_peer.user_id = tm.user_id
       and lm_peer.left_at is null
      join public.lobby_members lm_me
        on lm_me.lobby_id = lm_peer.lobby_id
       and lm_me.left_at is null
       and lm_me.user_id = auth.uid()
      where tm.team_id = teams.id
    )
  );

-- Roster: teammates see each other; lobby peers see members' rows for badge resolution.
create policy team_members_select_teammate
  on public.team_members for select
  to authenticated
  using (
    exists (
      select 1
      from public.team_members tm
      where tm.team_id = team_members.team_id
        and tm.user_id = auth.uid()
    )
  );

create policy team_members_select_lobby_peer
  on public.team_members for select
  to authenticated
  using (
    exists (
      select 1
      from public.lobby_members lm_peer
      join public.lobby_members lm_me
        on lm_me.lobby_id = lm_peer.lobby_id
       and lm_peer.left_at is null
       and lm_me.left_at is null
       and lm_me.user_id = auth.uid()
      where lm_peer.user_id = team_members.user_id
    )
  );

-- ---------------------------------------------------------------------------
-- RPCs (only path to mutate teams / membership)
-- ---------------------------------------------------------------------------
create or replace function public.create_team(p_name text, p_shield_key text)
returns table (out_team_id uuid, out_invite_code text)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_name text := trim(p_name);
  v_shield text := trim(p_shield_key);
  r public.teams%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  if v_name is null or v_name = '' then
    raise exception 'team name required';
  end if;

  if v_shield is null
     or v_shield not in ('vault', 'blade', 'skull', 'scope', 'crown', 'serpent') then
    raise exception 'invalid shield';
  end if;

  with removed as (
    delete from public.team_members where user_id = v_uid returning team_id
  )
  delete from public.teams t
  where t.id in (select distinct team_id from removed)
    and not exists (select 1 from public.team_members m where m.team_id = t.id);

  insert into public.teams (name, shield_key, owner_user_id, invite_code)
  values (v_name, v_shield, v_uid, null)
  returning * into r;

  insert into public.team_members (team_id, user_id, role)
  values (r.id, v_uid, 'owner');

  out_team_id := r.id;
  out_invite_code := r.invite_code;
  return next;
end;
$$;

create or replace function public.join_team_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select t.id into v_team_id
  from public.teams t
  where upper(trim(t.invite_code)) = upper(trim(p_invite_code))
  limit 1;

  if v_team_id is null then
    raise exception 'team not found';
  end if;

  if exists (
    select 1 from public.team_members m
    where m.team_id = v_team_id and m.user_id = v_uid
  ) then
    return v_team_id;
  end if;

  with removed as (
    delete from public.team_members where user_id = v_uid returning team_id
  )
  delete from public.teams t
  where t.id in (select distinct team_id from removed)
    and not exists (select 1 from public.team_members m where m.team_id = t.id);

  insert into public.team_members (team_id, user_id, role)
  values (v_team_id, v_uid, 'member');

  return v_team_id;
end;
$$;

create or replace function public.leave_team()
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_team_id uuid;
  v_role public.team_member_role;
  v_cnt int;
  v_next uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select team_id, role into v_team_id, v_role
  from public.team_members
  where user_id = v_uid
  limit 1;

  if v_team_id is null then
    return;
  end if;

  select count(*)::int into v_cnt from public.team_members where team_id = v_team_id;

  if v_role = 'owner' and v_cnt = 1 then
    delete from public.teams where id = v_team_id;
    return;
  end if;

  delete from public.team_members where team_id = v_team_id and user_id = v_uid;

  if v_role = 'owner' and v_cnt > 1 then
    select m.user_id into v_next
    from public.team_members m
    where m.team_id = v_team_id
    order by m.joined_at asc, m.user_id asc
    limit 1;

    if v_next is not null then
      update public.teams set owner_user_id = v_next where id = v_team_id;
      update public.team_members set role = 'member' where team_id = v_team_id;
      update public.team_members set role = 'owner' where team_id = v_team_id and user_id = v_next;
    end if;
  end if;

  delete from public.teams t
  where t.id = v_team_id
    and not exists (select 1 from public.team_members m where m.team_id = t.id);
end;
$$;

grant execute on function public.create_team(text, text) to authenticated;
grant execute on function public.join_team_by_invite(text) to authenticated;
grant execute on function public.leave_team() to authenticated;
