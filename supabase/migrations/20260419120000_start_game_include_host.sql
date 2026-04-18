-- Host could press "Start game" without clicking Ready; they were excluded from
-- lobby_members aggregation (ready = true only), so they got no assignment.

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
    and (ready = true or user_id = v_host);

  n := coalesce(array_length(v_order, 1), 0);
  if n < 4 then
    raise exception 'need at least 4 players (ready members plus host)';
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
