-- Admin app role, test-bot flags, and host-scoped admin RPCs for lobby/game QA.

alter table public.profiles
  add column if not exists app_role text not null default 'user'
    constraint profiles_app_role_check check (app_role in ('user', 'admin')),
  add column if not exists is_test_bot boolean not null default false,
  add column if not exists bot_created_by uuid references auth.users (id) on delete set null;

comment on column public.profiles.app_role is 'user | admin — set admin via SQL for your account';
comment on column public.profiles.is_test_bot is 'true for Auth users created as lobby/game test bots';
comment on column public.profiles.bot_created_by is 'admin user id that created this bot';

-- Invoker: reads own profile row only (RLS allows).
create or replace function public.is_app_admin()
returns boolean
language sql
stable
security invoker
set search_path = public
as $$
  select coalesce(
    (select p.app_role = 'admin' from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

grant execute on function public.is_app_admin() to authenticated;

create or replace function public.admin_attach_bot_to_lobby(
  p_lobby_id uuid,
  p_bot_user_id uuid,
  p_display_name text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_name text;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.lobbies l
    where l.id = p_lobby_id
      and l.host_id = auth.uid()
      and l.status = 'open'
  ) then
    raise exception 'lobby not found, closed, or not host';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_bot_user_id and p.is_test_bot
  ) then
    raise exception 'user is not a test bot';
  end if;

  v_name := coalesce(nullif(trim(p_display_name), ''), 'Bot');

  insert into public.lobby_members (lobby_id, user_id, display_name, ready)
  values (p_lobby_id, p_bot_user_id, v_name, true)
  on conflict (lobby_id, user_id) do update
    set display_name = excluded.display_name,
        left_at = null,
        ready = true,
        joined_at = now();
end;
$$;

grant execute on function public.admin_attach_bot_to_lobby(uuid, uuid, text) to authenticated;

create or replace function public.admin_remove_lobby_bot(p_lobby_id uuid, p_bot_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.lobbies l
    where l.id = p_lobby_id and l.host_id = auth.uid()
  ) then
    raise exception 'lobby not found or not host';
  end if;

  update public.lobby_members lm
  set left_at = now()
  where lm.lobby_id = p_lobby_id
    and lm.user_id = p_bot_user_id
    and lm.left_at is null;
end;
$$;

grant execute on function public.admin_remove_lobby_bot(uuid, uuid) to authenticated;

create or replace function public.admin_set_member_ready(
  p_lobby_id uuid,
  p_user_id uuid,
  p_ready boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  if not exists (
    select 1
    from public.lobbies l
    where l.id = p_lobby_id and l.host_id = auth.uid()
  ) then
    raise exception 'lobby not found or not host';
  end if;

  update public.lobby_members lm
  set ready = p_ready
  where lm.lobby_id = p_lobby_id
    and lm.user_id = p_user_id
    and lm.left_at is null;
end;
$$;

grant execute on function public.admin_set_member_ready(uuid, uuid, boolean) to authenticated;

create or replace function public.admin_bot_declare_whack(p_game_id uuid, p_bot_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  game_lobby_id uuid;
  v_status public.game_status;
  v_host uuid;
  tgt uuid;
  wpn uuid;
  v_attempt_id uuid;
begin
  if v_admin is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select g.lobby_id, g.status, l.host_id
  into game_lobby_id, v_status, v_host
  from public.games g
  join public.lobbies l on l.id = g.lobby_id
  where g.id = p_game_id;

  if not found then
    raise exception 'game not found';
  end if;

  if v_host <> v_admin then
    raise exception 'only lobby host can drive bot actions';
  end if;

  if v_status <> 'active' then
    raise exception 'game is not active';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_bot_user_id and p.is_test_bot
  ) then
    raise exception 'not a test bot';
  end if;

  if not public.is_lobby_member(game_lobby_id, p_bot_user_id) then
    raise exception 'bot is not an active lobby member';
  end if;

  select a.target_user_id, a.weapon_id
  into tgt, wpn
  from public.assignments a
  where a.game_id = p_game_id and a.user_id = p_bot_user_id;

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
  values (p_game_id, p_bot_user_id, tgt, wpn, 'pending_target')
  returning id into v_attempt_id;

  insert into public.game_events (game_id, event_type, payload)
  values (
    p_game_id,
    'whack_declared',
    jsonb_build_object('declarer_id', p_bot_user_id, 'via', 'admin_bot')
  );

  update public.player_stats
  set
    total_whack_declarations = total_whack_declarations + 1,
    updated_at = now()
  where user_id = p_bot_user_id;

  return v_attempt_id;
end;
$$;

grant execute on function public.admin_bot_declare_whack(uuid, uuid) to authenticated;

create or replace function public.admin_bot_respond_whack(
  p_attempt_id uuid,
  p_accept boolean,
  p_target_bot_user_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  rec public.whack_attempts%rowtype;
  wslug text;
  wname text;
  v_host uuid;
begin
  if v_admin is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select * into rec
  from public.whack_attempts
  where id = p_attempt_id
  for update;

  if not found then
    raise exception 'attempt not found';
  end if;

  select l.host_id into v_host
  from public.games g
  join public.lobbies l on l.id = g.lobby_id
  where g.id = rec.game_id;

  if not found or v_host <> v_admin then
    raise exception 'only lobby host can drive bot responses';
  end if;

  if rec.status <> 'pending_target' then
    raise exception 'attempt is not pending';
  end if;

  if rec.target_user_id <> p_target_bot_user_id then
    raise exception 'target bot mismatch';
  end if;

  if not exists (
    select 1 from public.profiles p where p.id = p_target_bot_user_id and p.is_test_bot
  ) then
    raise exception 'target is not a test bot';
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
        'weapon_name', wname,
        'via', 'admin_bot'
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
        'weapon_name', wname,
        'via', 'admin_bot'
      )
    );
  end if;
end;
$$;

grant execute on function public.admin_bot_respond_whack(uuid, boolean, uuid) to authenticated;

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

  -- Each fragment uses its own top-level SELECT so PL/pgSQL vars bind (nested
  -- subqueries inside one SELECT treat names like snap_lobby_id as relations).
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

create or replace function public.admin_debug_lobby_snapshot(p_lobby_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin uuid := auth.uid();
  v_host uuid;
begin
  if v_admin is null then
    raise exception 'not authenticated';
  end if;

  if not public.is_app_admin() then
    raise exception 'forbidden';
  end if;

  select l.host_id into v_host
  from public.lobbies l
  where l.id = p_lobby_id;

  if not found then
    raise exception 'lobby not found';
  end if;

  if v_host <> v_admin then
    raise exception 'only lobby host can view debug snapshot';
  end if;

  return jsonb_build_object(
    'lobby',
    (select jsonb_build_object(
      'id', l.id,
      'invite_code', l.invite_code,
      'status', l.status,
      'host_id', l.host_id,
      'weapon_pack_id', l.weapon_pack_id
    ) from public.lobbies l where l.id = p_lobby_id),
    'members',
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'user_id', lm.user_id,
            'display_name', lm.display_name,
            'ready', lm.ready,
            'left_at', lm.left_at,
            'joined_at', lm.joined_at,
            'is_test_bot', p.is_test_bot,
            'bot_created_by', p.bot_created_by
          )
          order by lm.joined_at
        )
        from public.lobby_members lm
        join public.profiles p on p.id = lm.user_id
        where lm.lobby_id = p_lobby_id
          and lm.left_at is null
      ),
      '[]'::jsonb
    )
  );
end;
$$;

grant execute on function public.admin_debug_lobby_snapshot(uuid) to authenticated;
