create extension if not exists pgcrypto;

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = timezone('utc', now());
  return new;
end;
$$;

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  display_name text,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  host_id uuid not null references public.profiles (id) on delete cascade,
  title text not null,
  description text,
  location text,
  event_date timestamptz,
  share_code text not null unique,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_members (
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null check (role in ('host', 'member')),
  joined_at timestamptz not null default timezone('utc', now()),
  primary key (event_id, user_id)
);

create table if not exists public.catalog_items (
  id uuid primary key default gen_random_uuid(),
  category text,
  label text not null,
  unit text not null,
  is_active boolean not null default true,
  sort_order integer not null default 0,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.eat_selections (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  category text,
  unit text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.bring_items (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  label text not null,
  category text,
  unit text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  catalog_item_id uuid references public.catalog_items (id) on delete set null,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.shopping_additions (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  label text not null,
  unit text not null,
  quantity numeric(10,2) not null check (quantity > 0),
  created_by uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists events_host_id_idx on public.events (host_id);
create index if not exists events_share_code_idx on public.events (share_code);
create index if not exists event_members_user_id_idx on public.event_members (user_id);
create index if not exists eat_selections_event_id_idx on public.eat_selections (event_id);
create index if not exists bring_items_event_id_idx on public.bring_items (event_id);
create index if not exists shopping_additions_event_id_idx on public.shopping_additions (event_id);

drop trigger if exists touch_profiles_updated_at on public.profiles;
create trigger touch_profiles_updated_at
before update on public.profiles
for each row
execute function public.touch_updated_at();

drop trigger if exists touch_events_updated_at on public.events;
create trigger touch_events_updated_at
before update on public.events
for each row
execute function public.touch_updated_at();

create or replace function public.sync_profile_from_auth()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email, display_name)
  values (
    new.id,
    new.email,
    coalesce(
      nullif(trim(new.raw_user_meta_data ->> 'display_name'), ''),
      split_part(coalesce(new.email, ''), '@', 1)
    )
  )
  on conflict (id) do update
  set
    email = excluded.email,
    display_name = coalesce(public.profiles.display_name, excluded.display_name),
    updated_at = timezone('utc', now());

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.sync_profile_from_auth();

insert into public.profiles (id, email, display_name)
select
  users.id,
  users.email,
  coalesce(
    nullif(trim(users.raw_user_meta_data ->> 'display_name'), ''),
    split_part(coalesce(users.email, ''), '@', 1)
  )
from auth.users as users
on conflict (id) do nothing;

create or replace function public.generate_share_code(p_length integer default 6)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  candidate text;
  index_pos integer;
begin
  loop
    candidate := '';

    for index_pos in 1..greatest(p_length, 4) loop
      candidate := candidate || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;

    exit when not exists (
      select 1
      from public.events
      where share_code = candidate
    );
  end loop;

  return candidate;
end;
$$;

create or replace function public.is_event_member(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.event_members as members
      where members.event_id = p_event_id
        and members.user_id = p_user_id
    );
$$;

create or replace function public.is_event_host(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    p_user_id is not null
    and exists (
      select 1
      from public.events as event_row
      where event_row.id = p_event_id
        and event_row.host_id = p_user_id
    );
$$;

create or replace function public.create_event(
  p_title text,
  p_event_date timestamptz default null,
  p_location text default null,
  p_description text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  created_event_id uuid;
  trimmed_title text := trim(coalesce(p_title, ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if length(trimmed_title) < 3 then
    raise exception 'TITLE_TOO_SHORT';
  end if;

  insert into public.events (
    host_id,
    title,
    description,
    location,
    event_date,
    share_code
  )
  values (
    auth.uid(),
    trimmed_title,
    nullif(trim(coalesce(p_description, '')), ''),
    nullif(trim(coalesce(p_location, '')), ''),
    p_event_date,
    public.generate_share_code(6)
  )
  returning id into created_event_id;

  insert into public.event_members (event_id, user_id, role)
  values (created_event_id, auth.uid(), 'host')
  on conflict do nothing;

  return created_event_id;
end;
$$;

create or replace function public.join_event_by_code(p_code text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  normalized_code text := upper(trim(coalesce(p_code, '')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  select id
  into target_event_id
  from public.events
  where share_code = normalized_code;

  if target_event_id is null then
    raise exception 'INVALID_CODE';
  end if;

  insert into public.event_members (event_id, user_id, role)
  values (target_event_id, auth.uid(), 'member')
  on conflict do nothing;

  return target_event_id;
end;
$$;

create or replace function public.get_event_members(p_event_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  email text,
  joined_at timestamptz
)
language sql
security definer
set search_path = public
as $$
  select
    members.user_id,
    members.role,
    coalesce(
      nullif(trim(profiles.display_name), ''),
      split_part(coalesce(profiles.email, ''), '@', 1),
      'Invite'
    ) as display_name,
    profiles.email,
    members.joined_at
  from public.event_members as members
  join public.profiles as profiles
    on profiles.id = members.user_id
  where members.event_id = p_event_id
    and public.is_event_member(p_event_id)
  order by
    case when members.role = 'host' then 0 else 1 end,
    members.joined_at asc;
$$;

create or replace function public.get_shopping_remaining(p_event_id uuid)
returns table (
  label text,
  category text,
  unit text,
  needed numeric,
  brought numeric,
  remaining numeric
)
language sql
security definer
set search_path = public
as $$
  with wanted as (
    select
      event_id,
      label,
      max(category) as category,
      unit,
      sum(quantity) as needed
    from public.eat_selections
    where event_id = p_event_id
    group by event_id, label, unit
  ),
  promised as (
    select
      event_id,
      label,
      max(category) as category,
      unit,
      sum(quantity) as brought
    from public.bring_items
    where event_id = p_event_id
    group by event_id, label, unit
  ),
  manual as (
    select
      event_id,
      label,
      unit,
      sum(quantity) as extra_needed
    from public.shopping_additions
    where event_id = p_event_id
    group by event_id, label, unit
  ),
  keys as (
    select event_id, label, unit from wanted
    union
    select event_id, label, unit from promised
    union
    select event_id, label, unit from manual
  )
  select
    keys.label,
    coalesce(wanted.category, promised.category) as category,
    keys.unit,
    coalesce(wanted.needed, 0) + coalesce(manual.extra_needed, 0) as needed,
    coalesce(promised.brought, 0) as brought,
    greatest(
      coalesce(wanted.needed, 0) + coalesce(manual.extra_needed, 0) - coalesce(promised.brought, 0),
      0
    ) as remaining
  from keys
  left join wanted
    on wanted.event_id = keys.event_id
   and wanted.label = keys.label
   and wanted.unit = keys.unit
  left join promised
    on promised.event_id = keys.event_id
   and promised.label = keys.label
   and promised.unit = keys.unit
  left join manual
    on manual.event_id = keys.event_id
   and manual.label = keys.label
   and manual.unit = keys.unit
  where public.is_event_member(p_event_id)
    and greatest(
      coalesce(wanted.needed, 0) + coalesce(manual.extra_needed, 0) - coalesce(promised.brought, 0),
      0
    ) > 0
  order by lower(keys.label);
$$;

grant usage on schema public to authenticated, anon;

grant select, update on public.profiles to authenticated;
grant select, insert, update, delete on public.events to authenticated;
grant select on public.catalog_items to authenticated;
grant select on public.event_members to authenticated;
grant select, insert, update, delete on public.eat_selections to authenticated;
grant select, insert, update, delete on public.bring_items to authenticated;
grant select, insert, update, delete on public.shopping_additions to authenticated;

grant execute on function public.create_event(text, timestamptz, text, text) to authenticated;
grant execute on function public.join_event_by_code(text) to authenticated;
grant execute on function public.get_event_members(uuid) to authenticated;
grant execute on function public.get_shopping_remaining(uuid) to authenticated;

alter table public.profiles enable row level security;
alter table public.events enable row level security;
alter table public.event_members enable row level security;
alter table public.catalog_items enable row level security;
alter table public.eat_selections enable row level security;
alter table public.bring_items enable row level security;
alter table public.shopping_additions enable row level security;

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (id = auth.uid());

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (id = auth.uid());

drop policy if exists "events_select_for_members" on public.events;
create policy "events_select_for_members"
on public.events
for select
to authenticated
using (public.is_event_member(id));

drop policy if exists "events_insert_for_host" on public.events;
create policy "events_insert_for_host"
on public.events
for insert
to authenticated
with check (host_id = auth.uid());

drop policy if exists "events_update_for_host" on public.events;
create policy "events_update_for_host"
on public.events
for update
to authenticated
using (public.is_event_host(id))
with check (public.is_event_host(id));

drop policy if exists "events_delete_for_host" on public.events;
create policy "events_delete_for_host"
on public.events
for delete
to authenticated
using (public.is_event_host(id));

drop policy if exists "event_members_select_for_members" on public.event_members;
create policy "event_members_select_for_members"
on public.event_members
for select
to authenticated
using (public.is_event_member(event_id));

drop policy if exists "catalog_items_select_for_authenticated" on public.catalog_items;
create policy "catalog_items_select_for_authenticated"
on public.catalog_items
for select
to authenticated
using (is_active = true);

drop policy if exists "eat_select_for_members" on public.eat_selections;
create policy "eat_select_for_members"
on public.eat_selections
for select
to authenticated
using (public.is_event_member(event_id));

drop policy if exists "eat_insert_for_self" on public.eat_selections;
create policy "eat_insert_for_self"
on public.eat_selections
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_event_member(event_id)
);

drop policy if exists "eat_update_for_self" on public.eat_selections;
create policy "eat_update_for_self"
on public.eat_selections
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "eat_delete_for_self" on public.eat_selections;
create policy "eat_delete_for_self"
on public.eat_selections
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "bring_select_for_members" on public.bring_items;
create policy "bring_select_for_members"
on public.bring_items
for select
to authenticated
using (public.is_event_member(event_id));

drop policy if exists "bring_insert_for_self" on public.bring_items;
create policy "bring_insert_for_self"
on public.bring_items
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_event_member(event_id)
);

drop policy if exists "bring_update_for_self" on public.bring_items;
create policy "bring_update_for_self"
on public.bring_items
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

drop policy if exists "bring_delete_for_self" on public.bring_items;
create policy "bring_delete_for_self"
on public.bring_items
for delete
to authenticated
using (user_id = auth.uid());

drop policy if exists "shopping_select_for_members" on public.shopping_additions;
create policy "shopping_select_for_members"
on public.shopping_additions
for select
to authenticated
using (public.is_event_member(event_id));

drop policy if exists "shopping_insert_for_members" on public.shopping_additions;
create policy "shopping_insert_for_members"
on public.shopping_additions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_event_member(event_id)
);

drop policy if exists "shopping_delete_for_creator_or_host" on public.shopping_additions;
create policy "shopping_delete_for_creator_or_host"
on public.shopping_additions
for delete
to authenticated
using (
  created_by = auth.uid()
  or public.is_event_host(event_id)
);

insert into public.catalog_items (category, label, unit, sort_order)
values
  ('Viandes', 'Saucisses', 'portion', 10),
  ('Viandes', 'Merguez', 'portion', 20),
  ('Viandes', 'Poulet marine', 'portion', 30),
  ('Accompagnements', 'Pain burger', 'piece', 40),
  ('Accompagnements', 'Salade', 'portion', 50),
  ('Accompagnements', 'Chips', 'piece', 60),
  ('Boissons', 'Soda', 'bouteille', 70),
  ('Boissons', 'Eau', 'bouteille', 80),
  ('Boissons', 'Biere', 'bouteille', 90),
  ('Desserts', 'Pasteque', 'portion', 100),
  ('Desserts', 'Brownie', 'portion', 110),
  ('Logistique', 'Glacons', 'piece', 120),
  ('Logistique', 'Gobelets', 'piece', 130),
  ('Logistique', 'Serviettes', 'piece', 140),
  ('Logistique', 'Charbon', 'piece', 150)
on conflict do nothing;
