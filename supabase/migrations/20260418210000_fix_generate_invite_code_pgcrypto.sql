-- RPCs like create_lobby use set search_path = public; lobby insert triggers then
-- called generate_invite_code(), which could not see gen_random_bytes (pgcrypto)
-- when it lived only in schema extensions on Supabase.

create or replace function public.generate_invite_code()
returns text
language sql
set search_path = public, extensions
as $$
  select upper(
    substring(
      translate(encode(gen_random_bytes(5), 'base64'), '+/', 'AZ')
      from 1 for 6
    )
  );
$$;
