-- Codename required for lobby create/join; single-arg join RPC; global leaderboard RPC

-- ---------------------------------------------------------------------------
-- create_lobby: require non-blank profile.display_name (codename)
-- ---------------------------------------------------------------------------
create or replace function public.create_lobby(p_weapon_pack_id uuid default null)
returns public.lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pack uuid;
  v_dn text;
  r public.lobbies%rowtype;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select coalesce(
    p_weapon_pack_id,
    (select id from public.weapon_packs where slug = 'default' limit 1)
  ) into v_pack;

  if v_pack is null then
    raise exception 'weapon pack not found';
  end if;

  v_dn := nullif(trim((select display_name from public.profiles where id = v_uid)), '');
  if v_dn is null then
    raise exception 'Set your codename on Profile before creating a room.';
  end if;

  insert into public.lobbies (host_id, weapon_pack_id, status)
  values (v_uid, v_pack, 'open')
  returning * into r;

  insert into public.lobby_members (lobby_id, user_id, display_name, ready)
  values (r.id, v_uid, v_dn, false);

  return r;
end;
$$;

-- ---------------------------------------------------------------------------
-- join_lobby_by_invite: codename from profile only (drop display_name param)
-- ---------------------------------------------------------------------------
drop function if exists public.join_lobby_by_invite(text, text);

create or replace function public.join_lobby_by_invite(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lobby_id uuid;
  v_name text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select id into v_lobby_id
  from public.lobbies
  where upper(trim(p_invite_code)) = upper(trim(invite_code))
    and status = 'open'
  limit 1;

  if v_lobby_id is null then
    raise exception 'lobby not found';
  end if;

  v_name := nullif(trim((select display_name from public.profiles where id = v_uid)), '');
  if v_name is null then
    raise exception 'Set your codename on Profile before joining a room.';
  end if;

  insert into public.lobby_members (lobby_id, user_id, display_name, ready)
  values (v_lobby_id, v_uid, v_name, false)
  on conflict (lobby_id, user_id) do update
    set display_name = excluded.display_name,
        left_at = null,
        ready = false,
        joined_at = now();

  return v_lobby_id;
end;
$$;

grant execute on function public.join_lobby_by_invite(text) to authenticated;

-- ---------------------------------------------------------------------------
-- Global leaderboard (SECURITY DEFINER — bypasses peer-only RLS for read)
-- ---------------------------------------------------------------------------
create or replace function public.get_global_leaderboard(
  p_sort text default 'kills',
  p_limit int default 100
)
returns table (
  rank bigint,
  user_id uuid,
  codename text,
  avatar_key text,
  equipped_title_id text,
  wins int,
  losses int,
  kills int,
  kd double precision,
  favourite_weapon_name text,
  office_name text,
  office_shield_key text
)
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if p_limit < 1 or p_limit > 500 then
    raise exception 'invalid limit';
  end if;
  if lower(trim(p_sort)) not in ('kills', 'kd', 'wins') then
    raise exception 'invalid sort (use kills, kd, or wins)';
  end if;

  return query
  with base as (
    select
      ps.user_id,
      trim(p.display_name) as dname,
      p.avatar_key,
      p.equipped_title_id,
      ps.wins,
      ps.losses,
      ps.successful_whacks as kills,
      case when ps.wins + ps.losses > 0
        then ps.wins::double precision / (ps.wins + ps.losses)
        else 0::double precision
      end as kd,
      (
        select w.name
        from jsonb_each_text(coalesce(ps.weapon_counts, '{}'::jsonb)) as kv(k, v)
        inner join public.weapons w on w.id::text = kv.k
        where kv.k ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
        order by coalesce(nullif(trim(kv.v), '')::numeric, 0::numeric) desc, kv.k asc
        limit 1
      ) as fav_w,
      t.name as office_n,
      t.shield_key as office_s
    from public.player_stats ps
    inner join public.profiles p on p.id = ps.user_id
    left join public.team_members tm on tm.user_id = ps.user_id
    left join public.teams t on t.id = tm.team_id
    where coalesce(nullif(trim(p.display_name), ''), '') <> ''
  ),
  ranked as (
    select
      b.*,
      row_number() over (
        order by
          case lower(trim(p_sort))
            when 'wins' then b.wins::numeric
            when 'kd' then b.kd::numeric
            else b.kills::numeric
          end desc nulls last,
          case lower(trim(p_sort))
            when 'wins' then b.kills::numeric
            when 'kd' then b.wins::numeric
            else b.kd::numeric
          end desc nulls last,
          case lower(trim(p_sort))
            when 'wins' then b.kd::numeric
            when 'kd' then b.kills::numeric
            else b.wins::numeric
          end desc nulls last,
          b.user_id asc
      ) as rn
    from base b
  )
  select
    r.rn::bigint,
    r.user_id,
    r.dname::text,
    r.avatar_key::text,
    r.equipped_title_id::text,
    r.wins,
    r.losses,
    r.kills,
    r.kd,
    r.fav_w::text,
    r.office_n::text,
    r.office_s::text
  from ranked r
  where r.rn <= p_limit
  order by r.rn;
end;
$$;

grant execute on function public.get_global_leaderboard(text, int) to authenticated;
