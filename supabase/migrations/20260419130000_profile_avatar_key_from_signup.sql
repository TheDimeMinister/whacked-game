-- Carry preset portrait slug from auth.signUp({ options: { data: { avatar_key }}}) into profiles
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, display_name, avatar_key)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data->>'display_name',
      split_part(coalesce(new.email, 'player'), '@', 1)
    ),
    nullif(trim(new.raw_user_meta_data->>'avatar_key'), '')
  )
  on conflict (id) do nothing;

  insert into public.player_stats (user_id) values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;
