-- Fix 42P01: PL/pgSQL variables inside nested subqueries in one big SELECT are
-- parsed as relation names. Build each JSON fragment with a top-level SELECT … INTO.

create or replace function public.admin_debug_game_snapshot(p_game_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  snap_lobby_id uuid;
  v_host uuid;
  j_game jsonb;
  j_members jsonb;
  j_assignments jsonb;
  j_pending jsonb;
  j_events jsonb;
  r jsonb;
begin
  if v_admin is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select g.lobby_id, l.host_id
  into snap_lobby_id, v_host
  from public.games g
  join public.lobbies l on l.id = g.lobby_id
  where g.id = p_game_id;

  if not found then
    raise exception 'game not found';
  end if;

  if v_host <> v_admin then
    raise exception 'only lobby host can view debug snapshot';
  end if;

  select jsonb_build_object(
    'id', g.id,
    'status', g.status,
    'lobby_id', g.lobby_id,
    'ended_reason', g.ended_reason,
    'winner_user_id', g.winner_user_id,
    'created_at', g.created_at,
    'ended_at', g.ended_at
  )
  into j_game
  from public.games g
  where g.id = p_game_id;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', lm.user_id,
        'display_name', lm.display_name,
        'ready', lm.ready,
        'left_at', lm.left_at,
        'joined_at', lm.joined_at,
        'is_test_bot', p.is_test_bot,
        'bot_created_by', p.bot_created_by,
        'app_role', p.app_role
      )
      order by lm.joined_at
    ),
    '[]'::jsonb
  )
  into j_members
  from public.lobby_members lm
  join public.profiles p on p.id = lm.user_id
  where lm.lobby_id = snap_lobby_id
    and lm.left_at is null;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'user_id', a.user_id,
        'target_user_id', a.target_user_id,
        'weapon_id', a.weapon_id,
        'weapon_slug', w.slug,
        'weapon_name', w.name,
        'target_display_name', tp.display_name,
        'declarer_is_bot', dp.is_test_bot
      )
      order by a.user_id
    ),
    '[]'::jsonb
  )
  into j_assignments
  from public.assignments a
  join public.weapons w on w.id = a.weapon_id
  join public.profiles tp on tp.id = a.target_user_id
  join public.profiles dp on dp.id = a.user_id
  where a.game_id = p_game_id;

  select to_jsonb(wa.*)
  into j_pending
  from public.whack_attempts wa
  where wa.game_id = p_game_id
    and wa.status = 'pending_target'
  limit 1;

  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'id', ge.id,
        'event_type', ge.event_type,
        'payload', ge.payload,
        'created_at', ge.created_at
      )
      order by ge.created_at desc
    ),
    '[]'::jsonb
  )
  into j_events
  from (
    select id, game_id, event_type, payload, created_at
    from public.game_events
    where game_id = p_game_id
    order by created_at desc
    limit 40
  ) ge;

  r := jsonb_build_object(
    'game', j_game,
    'members', j_members,
    'assignments', j_assignments,
    'pending_whack', j_pending,
    'recent_events', j_events
  );

  return r;
end;
$$;

grant execute on function public.admin_debug_game_snapshot(uuid) to authenticated;
