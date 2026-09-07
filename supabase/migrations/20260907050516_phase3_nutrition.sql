-- Phase 3: cloud-backed food library, favorites, reusable meals, and daily entries.
-- USDA search results are saved per client on selection, so the external API is never
-- the source of truth for a meal or a historical daily total.

create table if not exists nutrition_foods (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  source text not null default 'manual' check (source in ('manual', 'usda')),
  external_id text,
  name text not null check (length(trim(name)) > 0),
  brand text,
  serving_description text not null default 'serving',
  serving_quantity numeric(10,2) not null default 1 check (serving_quantity > 0),
  serving_unit text not null default 'serving',
  serving_grams numeric(10,2) check (serving_grams is null or serving_grams > 0),
  calories numeric(10,1) not null default 0 check (calories >= 0),
  protein_grams numeric(10,1) not null default 0 check (protein_grams >= 0),
  carb_grams numeric(10,1) not null default 0 check (carb_grams >= 0),
  fat_grams numeric(10,1) not null default 0 check (fat_grams >= 0),
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists nutrition_foods_external_per_client
  on nutrition_foods (profile_id, source, external_id)
  where external_id is not null;
create index if not exists nutrition_foods_profile_name on nutrition_foods (profile_id, lower(name));

create table if not exists food_favorites (
  profile_id uuid not null references profiles(id) on delete cascade,
  food_id uuid not null references nutrition_foods(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (profile_id, food_id)
);

create table if not exists saved_meals (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  name text not null check (length(trim(name)) > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (profile_id, name)
);

create table if not exists saved_meal_items (
  id uuid primary key default gen_random_uuid(),
  meal_id uuid not null references saved_meals(id) on delete cascade,
  food_id uuid not null references nutrition_foods(id) on delete restrict,
  servings numeric(10,2) not null default 1 check (servings > 0),
  created_at timestamptz not null default now(),
  unique (meal_id, food_id)
);
create index if not exists saved_meal_items_meal on saved_meal_items (meal_id);

create table if not exists nutrition_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles(id) on delete cascade,
  local_date date not null,
  food_id uuid references nutrition_foods(id) on delete set null,
  meal_id uuid references saved_meals(id) on delete set null,
  food_name text not null,
  meal_label text,
  servings numeric(10,2) not null default 1 check (servings > 0),
  serving_label text not null default 'serving',
  calories numeric(10,1) not null default 0 check (calories >= 0),
  protein_grams numeric(10,1) not null default 0 check (protein_grams >= 0),
  carb_grams numeric(10,1) not null default 0 check (carb_grams >= 0),
  fat_grams numeric(10,1) not null default 0 check (fat_grams >= 0),
  created_at timestamptz not null default now()
);
create index if not exists nutrition_entries_daily on nutrition_entries (profile_id, local_date desc);

comment on table nutrition_foods is
  'A client-owned library of manual or selected USDA foods. Nutrition values describe one saved serving.';
comment on table nutrition_entries is
  'Immutable-by-default daily nutrition snapshots. Food name and macros are copied at log time so later edits do not rewrite history.';

alter table nutrition_foods enable row level security;
alter table food_favorites enable row level security;
alter table saved_meals enable row level security;
alter table saved_meal_items enable row level security;
alter table nutrition_entries enable row level security;

create policy nutrition_foods_select on nutrition_foods for select to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_foods_insert on nutrition_foods for insert to authenticated
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_foods_update on nutrition_foods for update to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())))
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_foods_delete on nutrition_foods for delete to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));

create policy food_favorites_select on food_favorites for select to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy food_favorites_insert on food_favorites for insert to authenticated
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy food_favorites_delete on food_favorites for delete to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));

create policy saved_meals_select on saved_meals for select to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy saved_meals_insert on saved_meals for insert to authenticated
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy saved_meals_update on saved_meals for update to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())))
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy saved_meals_delete on saved_meals for delete to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));

create policy saved_meal_items_select on saved_meal_items for select to authenticated
  using (meal_id in (select id from saved_meals where profile_id = (select auth.uid())) or (select is_coach(auth.uid())));
create policy saved_meal_items_insert on saved_meal_items for insert to authenticated
  with check (meal_id in (select id from saved_meals where profile_id = (select auth.uid())) or (select is_coach(auth.uid())));
create policy saved_meal_items_update on saved_meal_items for update to authenticated
  using (meal_id in (select id from saved_meals where profile_id = (select auth.uid())) or (select is_coach(auth.uid())))
  with check (meal_id in (select id from saved_meals where profile_id = (select auth.uid())) or (select is_coach(auth.uid())));
create policy saved_meal_items_delete on saved_meal_items for delete to authenticated
  using (meal_id in (select id from saved_meals where profile_id = (select auth.uid())) or (select is_coach(auth.uid())));

create policy nutrition_entries_select on nutrition_entries for select to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_entries_insert on nutrition_entries for insert to authenticated
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_entries_update on nutrition_entries for update to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())))
  with check ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));
create policy nutrition_entries_delete on nutrition_entries for delete to authenticated
  using ((select auth.uid()) = profile_id or (select is_coach(auth.uid())));

grant select, insert, update, delete on nutrition_foods, food_favorites, saved_meals, saved_meal_items, nutrition_entries to authenticated;
