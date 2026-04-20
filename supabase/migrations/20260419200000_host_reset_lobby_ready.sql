-- After a game ends, host can clear everyone's Ready so the group reorganizes before the next start.
create or replace function public.host_reset_lobby_ready(p_lobby_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select host_id
  into v_host
  from public.lobbies
  where id = p_lobby_id and status = 'open';

  if v_host is null then
    raise exception 'lobby not found or closed';
  end if;

  if v_host <> auth.uid() then
    raise exception 'only the host can reset the room';
  end if;

  update public.lobby_members
  set ready = false
  where lobby_id = p_lobby_id
    and left_at is null;
end;
$$;

grant execute on function public.host_reset_lobby_ready(uuid) to authenticated;
