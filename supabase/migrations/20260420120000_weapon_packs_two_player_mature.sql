-- Mature / NSFW packs: flagged for UI warnings only (still readable by all authenticated users).
alter table public.weapon_packs
  add column if not exists is_mature boolean not null default false;

-- Themed weapon pools (free). Each pack has enough weapons for typical lobby sizes.
insert into public.weapon_packs (slug, name, description, is_premium, sort_order, is_mature)
values
  (
    'school',
    'School pack',
    'Things you might find in a classroom, hallway, or cafeteria.',
    false,
    10,
    false
  ),
  (
    'family_home',
    'Family home pack',
    'Kid-friendly household objects — nothing sharp or alarming.',
    false,
    20,
    false
  ),
  (
    'adults_couples',
    'Couples / adults pack',
    'Explicit adult humor — only pick this when everyone in the room is comfortable with NSFW language and props.',
    false,
    99,
    true
  ),
  (
    'pub',
    'Pub pack',
    'Bar, darts, pool night — props you might actually have on the table.',
    false,
    30,
    false
  ),
  (
    'sports_football',
    'Football / locker pack',
    'Sideline, locker room, and gridiron-adjacent bits.',
    false,
    50,
    false
  ),
  (
    'sports_basketball',
    'Basketball pack',
    'Court, bench, and gym-bag classics.',
    false,
    55,
    false
  ),
  (
    'sports_gym',
    'Gym / locker room pack',
    'Weights-floor and locker-room finds.',
    false,
    60,
    false
  ),
  (
    'shisha_cafe',
    'Shisha café pack',
    'Lounge-night props: coals, foil, mouth tips, and the usual table clutter.',
    false,
    40,
    false
  )
on conflict (slug) do nothing;

-- School
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('school_ruler', 'Plastic Ruler'),
    ('school_eraser', 'Pink Eraser'),
    ('school_spiral', 'Spiral Notebook'),
    ('school_tray', 'Cafeteria Tray'),
    ('school_hall_pass', 'Laminated Hall Pass'),
    ('school_dry_erase', 'Dry-Erase Marker'),
    ('school_calc', 'Scientific Calculator'),
    ('school_glue', 'Glue Stick'),
    ('school_scissors', 'Blunt-Tip Scissors'),
    ('school_locker_magnet', 'Locker Magnet'),
    ('school_pencil_pouch', 'Pencil Pouch'),
    ('school_library_card', 'Library Due-Date Card')
) as v(slug, name)
where p.slug = 'school'
on conflict (pack_id, slug) do nothing;

-- Family home
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('family_lego', 'LEGO Brick'),
    ('family_crayon', 'Crayon'),
    ('family_stuffed', 'Stuffed Animal Keychain'),
    ('family_bubbles', 'Bubble Wand'),
    ('family_sippy_lid', 'Sippy Cup Lid'),
    ('family_fridge_magnet', 'Fridge Letter Magnet'),
    ('family_sidewalk_chalk', 'Sidewalk Chalk'),
    ('family_storybook', 'Picture Storybook'),
    ('family_toy_car', 'Toy Car'),
    ('family_blanket_clip', 'Blanket-Fort Clip'),
    ('family_playdoh_lid', 'Play-Doh Lid'),
    ('family_rubber_duck', 'Rubber Duck')
) as v(slug, name)
where p.slug = 'family_home'
on conflict (pack_id, slug) do nothing;

-- Adults / couples (explicit humor — names are the joke object)
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('adults_dildo', 'Dildo'),
    ('adults_cock_ring', 'Cock ring'),
    ('adults_vibrator', 'Bullet vibrator'),
    ('adults_condom', 'Condom (foil, unopened)'),
    ('adults_lube', 'Lube sachet'),
    ('adults_handcuffs', 'Fuzzy handcuffs'),
    ('adults_blindfold', 'Satin blindfold'),
    ('adults_tickler', 'Feather tickler'),
    ('adults_nipple_clamps', 'Nipple clamps'),
    ('adults_massage_oil', 'Massage oil mini bottle'),
    ('adults_edible_panties', 'Edible panties (gag gift box)'),
    ('adults_dirty_cards', 'After Dark playing cards')
) as v(slug, name)
where p.slug = 'adults_couples'
on conflict (pack_id, slug) do nothing;

-- Pub
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('pub_beer_mat', 'Beer mat / coaster stack'),
    ('pub_pint_glass', 'Empty pint glass'),
    ('pub_pool_chalk', 'Pool cue chalk cube'),
    ('pub_dart_flight', 'Dart flight set'),
    ('pub_stirrer', 'Cocktail stirrer'),
    ('pub_lime_pick', 'Cocktail pick with lime wedge'),
    ('pub_napkin', 'Bar napkin'),
    ('pub_bottle_opener', 'Bottle opener keychain'),
    ('pub_coaster', 'Branded beer coaster'),
    ('pub_swizzle', 'Swizzle stick'),
    ('pub_salt_rimmer', 'Tequila salt rimmer lid'),
    ('pub_shot_tray', 'Shot flight tray')
) as v(slug, name)
where p.slug = 'pub'
on conflict (pack_id, slug) do nothing;

-- Football
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('fb_cleat_lace', 'Cleat lace tip'),
    ('fb_mouthguard_case', 'Mouthguard case'),
    ('fb_wrist_playcard', 'Wrist play-call card'),
    ('fb_mini_cone', 'Mini practice cone'),
    ('fb_flag_belt_clip', 'Flag belt clip'),
    ('fb_helmet_decal', 'Helmet sticker decal'),
    ('fb_yard_wristband', 'Yard-line wristband'),
    ('fb_water_bottle_cap', 'Squeeze bottle cap'),
    ('fb_mini_pylon', 'Desk pylon souvenir'),
    ('fb_whistle', 'Coach whistle'),
    ('fb_chinstrap_pad', 'Chinstrap pad'),
    ('fb_turf_pellet', 'Rubber turf pellet')
) as v(slug, name)
where p.slug = 'sports_football'
on conflict (pack_id, slug) do nothing;

-- Basketball
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('bb_sweatband', 'Wrist sweatband'),
    ('bb_ankle_sleeve', 'Ankle sleeve'),
    ('bb_shooting_sleeve', 'Shooting sleeve'),
    ('bb_pump_needle', 'Ball pump needle'),
    ('bb_mini_ball_keychain', 'Mini basketball keychain'),
    ('bb_chalk_square', 'Hand chalk cube'),
    ('bb_extra_laces', 'Spare shoelaces'),
    ('bb_mouthguard', 'Basketball mouthguard'),
    ('bb_finger_tape', 'Finger tape roll'),
    ('bb_net_loop', 'Net loop string'),
    ('bb_jersey_pin', 'Reversible jersey pin'),
    ('bb_clipboard', 'Mini clipboard')
) as v(slug, name)
where p.slug = 'sports_basketball'
on conflict (pack_id, slug) do nothing;

-- Gym / locker
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('gym_locker_plate', 'Locker number plate'),
    ('gym_combo_lock', 'Combination lock'),
    ('gym_resistance_band', 'Resistance band loop'),
    ('gym_foam_roller', 'Foam roller mini'),
    ('gym_shaker_lid', 'Protein shaker lid'),
    ('gym_scan_tag', 'Gym key fob / scan tag'),
    ('gym_towel_loop', 'Gym towel wrist loop'),
    ('gym_collar_clip', 'Barbell collar clip'),
    ('gym_yoga_block', 'Yoga block corner'),
    ('gym_sandal_hanger', 'Shower sandal hanger'),
    ('gym_electrolyte', 'Electrolyte powder stick'),
    ('gym_earbud_case', 'Gym earbud case')
) as v(slug, name)
where p.slug = 'sports_gym'
on conflict (pack_id, slug) do nothing;

-- Shisha café
insert into public.weapons (pack_id, slug, name)
select p.id, v.slug, v.name
from public.weapon_packs p
cross join (
  values
    ('shisha_coal_tongs', 'Coal tongs'),
    ('shisha_foil_poker', 'Foil poker / hole punch'),
    ('shisha_mouth_tip', 'Disposable mouth tip'),
    ('shisha_hose_spring', 'Hose spring cover'),
    ('shisha_flavor_card', 'Flavor box tab card'),
    ('shisha_quick_coal', 'Quick-light charcoal disc'),
    ('shisha_bowl_grommet', 'Bowl grommet'),
    ('shisha_wind_cover', 'Wind cover handle'),
    ('shisha_ice_tip', 'Ice hose tip'),
    ('shisha_coal_fork', 'Coal tray fork'),
    ('shisha_drip_catcher', 'Molasses drip ring'),
    ('shisha_hose_weight', 'Hose counterweight / timble')
) as v(slug, name)
where p.slug = 'shisha_cafe'
on conflict (pack_id, slug) do nothing;

-- Minimum 2 players (was 4). Still requires enough unique weapons in the pack.
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
  if n < 2 then
    raise exception 'need at least 2 players (ready members plus host)';
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

-- Host can change weapon pack before any round starts (open lobby, no active game).
create or replace function public.host_set_lobby_weapon_pack(
  p_lobby_id uuid,
  p_weapon_pack_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_host uuid;
  v_pack_exists boolean;
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  select host_id into v_host
  from public.lobbies
  where id = p_lobby_id and status = 'open';

  if v_host is null then
    raise exception 'lobby not found or closed';
  end if;

  if v_host <> auth.uid() then
    raise exception 'only the host can change the weapon pack';
  end if;

  if exists (
    select 1 from public.games g
    where g.lobby_id = p_lobby_id and g.status = 'active'
  ) then
    raise exception 'cannot change weapon pack while a game is active';
  end if;

  select exists(
    select 1 from public.weapon_packs wp where wp.id = p_weapon_pack_id
  ) into v_pack_exists;

  if not v_pack_exists then
    raise exception 'weapon pack not found';
  end if;

  update public.lobbies
  set weapon_pack_id = p_weapon_pack_id
  where id = p_lobby_id and status = 'open' and host_id = auth.uid();
end;
$$;

grant execute on function public.host_set_lobby_weapon_pack(uuid, uuid) to authenticated;
