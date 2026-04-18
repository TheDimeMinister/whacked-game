-- Authoritative game RPCs (SECURITY DEFINER)

create or replace function public.create_lobby(p_weapon_pack_id uuid default null)
returns public.lobbies
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_pack uuid;
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

  insert into public.lobbies (host_id, weapon_pack_id, status)
  values (v_uid, v_pack, 'open')
  returning * into r;

  insert into public.lobby_members (lobby_id, user_id, display_name, ready)
  values (
    r.id,
    v_uid,
    coalesce((select display_name from public.profiles where id = v_uid), 'Host'),
    false
  );

  return r;
end;
$$;

grant execute on function public.create_lobby(uuid) to authenticated;

create or replace function public.join_lobby_by_invite(
  p_invite_code text,
  p_display_name text
)
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

  v_name := nullif(trim(p_display_name), '');
  if v_name is null then
    v_name := coalesce((select display_name from public.profiles where id = v_uid), 'Player');
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

grant execute on function public.join_lobby_by_invite(text, text) to authenticated;

create or replace function public.start_game(p_lobby_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_host uuid;
  v_pack uuid;
  v_order uuid[];
  n int;
  v_game_id uuid;
  v_weapons uuid[];
  i int;
  tgt uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select host_id, weapon_pack_id
  into v_host, v_pack
  from public.lobbies
  where id = p_lobby_id and status = 'open';

  if v_host is null then
    raise exception 'lobby not found or closed';
  end if;

  if v_host <> v_uid then
    raise exception 'only host can start the game';
  end if;

  if exists (
    select 1 from public.games g
    where g.lobby_id = p_lobby_id and g.status = 'active'
  ) then
    raise exception 'a game is already active for this lobby';
  end if;

  select coalesce(array_agg(user_id order by random()), '{}')
  into v_order
  from public.lobby_members
  where lobby_id = p_lobby_id
    and left_at is null
    and ready = true;

  n := coalesce(array_length(v_order, 1), 0);
  if n < 4 then
    raise exception 'need at least 4 ready players';
  end if;

  select coalesce(array_agg(id order by random()), '{}')
  into v_weapons
  from public.weapons
  where pack_id = v_pack;

  if coalesce(array_length(v_weapons, 1), 0) < n then
    raise exception 'not enough weapons in selected pack';
  end if;

  insert into public.games (lobby_id, status)
  values (p_lobby_id, 'active')
  returning id into v_game_id;

  for i in 1..n loop
    tgt := v_order[((i % n) + 1)];
    insert into public.assignments (game_id, user_id, target_user_id, weapon_id)
    values (v_game_id, v_order[i], tgt, v_weapons[i]);
  end loop;

  insert into public.game_events (game_id, event_type, payload)
  values (
    v_game_id,
    'game_started',
    jsonb_build_object('player_count', n)
  );

  return v_game_id;
end;
$$;

grant execute on function public.start_game(uuid) to authenticated;

create or replace function public.declare_whack(p_game_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_lobby uuid;
  v_status public.game_status;
  tgt uuid;
  wpn uuid;
  v_attempt_id uuid;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select g.lobby_id, g.status
  into v_lobby, v_status
  from public.games g
  where g.id = p_game_id;

  if not found then
    raise exception 'game not found';
  end if;

  if v_status <> 'active' then
    raise exception 'game is not active';
  end if;

  if not public.is_lobby_member(v_lobby, v_uid) then
    raise exception 'not a lobby member';
  end if;

  select a.target_user_id, a.weapon_id
  into tgt, wpn
  from public.assignments a
  where a.game_id = p_game_id and a.user_id = v_uid;

  if not found then
    raise exception 'no assignment for this game';
  end if;

  if exists (
    select 1 from public.whack_attempts wa
    where wa.game_id = p_game_id and wa.status = 'pending_target'
  ) then
    raise exception 'a whack is already pending';
  end if;

  insert into public.whack_attempts (
    game_id, declarer_id, target_user_id, weapon_id, status
  )
  values (p_game_id, v_uid, tgt, wpn, 'pending_target')
  returning id into v_attempt_id;

  insert into public.game_events (game_id, event_type, payload)
  values (p_game_id, 'whack_declared', '{}'::jsonb);

  update public.player_stats
  set
    total_whack_declarations = total_whack_declarations + 1,
    updated_at = now()
  where user_id = v_uid;

  return v_attempt_id;
end;
$$;

grant execute on function public.declare_whack(uuid) to authenticated;

create or replace function public.respond_whack(p_attempt_id uuid, p_accept boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  rec public.whack_attempts%rowtype;
  wslug text;
  wname text;
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  select * into rec
  from public.whack_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt not found';
  end if;

  if rec.status <> 'pending_target' then
    raise exception 'attempt is not pending';
  end if;

  if rec.target_user_id <> v_uid then
    raise exception 'only the target can respond';
  end if;

  select slug, name into wslug, wname
  from public.weapons
  where id = rec.weapon_id;

  if p_accept then
    update public.whack_attempts
    set status = 'accepted', resolved_at = now()
    where id = p_attempt_id;

    update public.games
    set
      status = 'ended',
      winner_user_id = rec.declarer_id,
      ended_reason = 'whack_accepted',
      ended_at = now()
    where id = rec.game_id;

    insert into public.game_events (game_id, event_type, payload)
    values (
      rec.game_id,
      'whack_accepted',
      jsonb_build_object(
        'whacker_id', rec.declarer_id,
        'victim_id', rec.target_user_id,
        'weapon_id', rec.weapon_id,
        'weapon_slug', wslug,
        'weapon_name', wname
      )
    );

    update public.player_stats
    set
      wins = wins + 1,
      successful_whacks = successful_whacks + 1,
      weapon_counts = jsonb_set(
        coalesce(weapon_counts, '{}'::jsonb),
        array[rec.weapon_id::text],
        to_jsonb(
          coalesce((weapon_counts->>rec.weapon_id::text)::int, 0) + 1
        ),
        true
      ),
      updated_at = now()
    where user_id = rec.declarer_id;

    update public.player_stats
    set
      losses = losses + 1,
      updated_at = now()
    where user_id = rec.target_user_id;
  else
    update public.whack_attempts
    set status = 'declined', resolved_at = now()
    where id = p_attempt_id;

    insert into public.game_events (game_id, event_type, payload)
    values (
      rec.game_id,
      'whack_declined',
      jsonb_build_object(
        'weapon_id', rec.weapon_id,
        'weapon_slug', wslug,
        'weapon_name', wname
      )
    );
  end if;
end;
$$;

grant execute on function public.respond_whack(uuid, boolean) to authenticated;

create or replace function public.close_lobby(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not authenticated';
  end if;

  update public.lobbies
  set status = 'closed'
  where id = p_lobby_id and host_id = v_uid;

  if not FOUND then
    raise exception 'lobby not found or not host';
  end if;

  update public.games
  set
    status = 'cancelled',
    ended_reason = 'lobby_closed',
    ended_at = now()
  where lobby_id = p_lobby_id and status = 'active';
end;
$$;

grant execute on function public.close_lobby(uuid) to authenticated;
