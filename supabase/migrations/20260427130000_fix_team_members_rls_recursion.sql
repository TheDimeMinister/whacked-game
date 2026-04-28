-- team_members SELECT policies queried team_members again → infinite RLS recursion (42P17).
-- teams SELECT first branch did the same while resolving team_members visibility.
-- Use a SECURITY DEFINER helper so membership checks bypass RLS.

create or replace function public.auth_user_team_ids()
returns uuid[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(
    array_agg(tm.team_id),
    array[]::uuid[]
  )
  from public.team_members tm
  where tm.user_id = auth.uid();
$$;

revoke all on function public.auth_user_team_ids() from public;
grant execute on function public.auth_user_team_ids() to authenticated;
grant execute on function public.auth_user_team_ids() to service_role;

drop policy if exists teams_select_lobby_or_member on public.teams;
create policy teams_select_lobby_or_member
  on public.teams for select
  to authenticated
  using (
    teams.id = any (public.auth_user_team_ids())
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

drop policy if exists team_members_select_teammate on public.team_members;
create policy team_members_select_teammate
  on public.team_members for select
  to authenticated
  using (team_members.team_id = any (public.auth_user_team_ids()));
