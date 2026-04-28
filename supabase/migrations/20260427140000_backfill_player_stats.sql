-- Profiles without player_stats (legacy signups, failed trigger runs, etc.) break .single() reads
-- and leave nothing for game RPCs to update.
insert into public.player_stats (user_id)
select p.id
from public.profiles p
where not exists (
  select 1 from public.player_stats s where s.user_id = p.id
)
on conflict (user_id) do nothing;
