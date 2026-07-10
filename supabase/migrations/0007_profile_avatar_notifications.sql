alter table public.profiles
add column if not exists avatar_path text;

alter table public.profiles
add column if not exists avatar_mime_type text;

alter table public.profiles
add column if not exists avatar_updated_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_display_name_length_check'
  ) then
    alter table public.profiles
    add constraint profiles_display_name_length_check
    check (display_name is null or char_length(trim(display_name)) between 2 and 80)
    not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'profiles_avatar_mime_type_check'
  ) then
    alter table public.profiles
    add constraint profiles_avatar_mime_type_check
    check (
      avatar_mime_type is null
      or avatar_mime_type in ('image/jpeg', 'image/png', 'image/webp')
    )
    not valid;
  end if;
end
$$;

create table if not exists public.notification_categories (
  key text primary key,
  label text not null,
  sort_order integer not null default 0,
  default_in_app boolean not null default true,
  default_email boolean not null default false,
  default_push boolean not null default false
);

create table if not exists public.user_notification_preferences (
  user_id uuid not null references public.profiles (id) on delete cascade,
  category text not null references public.notification_categories (key) on delete cascade,
  in_app_enabled boolean not null default true,
  email_enabled boolean not null default false,
  push_enabled boolean not null default false,
  created_at timestamptz not null default timezone('utc', now()),
  updated_at timestamptz not null default timezone('utc', now()),
  primary key (user_id, category)
);

create index if not exists user_notification_preferences_user_id_idx
on public.user_notification_preferences (user_id);

drop trigger if exists touch_user_notification_preferences_updated_at
on public.user_notification_preferences;
create trigger touch_user_notification_preferences_updated_at
before update on public.user_notification_preferences
for each row
execute function public.touch_updated_at();

insert into public.notification_categories (
  key,
  label,
  sort_order,
  default_in_app,
  default_email,
  default_push
)
values
  ('chat_message', 'Nouveau message dans le chat', 10, true, false, false),
  ('bring_item_added', 'Nouvel element dans Qui apporte quoi', 20, true, false, false),
  ('bring_item_changed', 'Modification ou suppression d un element', 30, true, false, false),
  ('task_created', 'Nouvelle tache', 40, true, false, false),
  ('task_assigned_or_done', 'Tache attribuee ou terminee', 50, true, false, false),
  ('event_changed', 'Modification importante d un evenement', 60, true, true, false),
  ('cooking_changed', 'Ajout ou modification d une cuisson', 70, true, false, false)
on conflict (key) do update
set
  label = excluded.label,
  sort_order = excluded.sort_order,
  default_in_app = excluded.default_in_app,
  default_email = excluded.default_email,
  default_push = excluded.default_push;

insert into public.user_notification_preferences (
  user_id,
  category,
  in_app_enabled,
  email_enabled,
  push_enabled
)
select
  profiles.id,
  categories.key,
  categories.default_in_app,
  categories.default_email,
  categories.default_push
from public.profiles as profiles
cross join public.notification_categories as categories
on conflict (user_id, category) do nothing;

create or replace function public.ensure_user_notification_preferences(p_user_id uuid default auth.uid())
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_user_id is null or p_user_id <> auth.uid() then
    raise exception 'ACCESS_DENIED';
  end if;

  insert into public.user_notification_preferences (
    user_id,
    category,
    in_app_enabled,
    email_enabled,
    push_enabled
  )
  select
    p_user_id,
    categories.key,
    categories.default_in_app,
    categories.default_email,
    categories.default_push
  from public.notification_categories as categories
  on conflict (user_id, category) do nothing;
end;
$$;

drop function if exists public.get_event_members(uuid);

create function public.get_event_members(p_event_id uuid)
returns table (
  user_id uuid,
  role text,
  display_name text,
  email text,
  avatar_path text,
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
    profiles.avatar_path,
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

grant select on public.notification_categories to authenticated;
grant select, insert, update on public.user_notification_preferences to authenticated;
grant execute on function public.ensure_user_notification_preferences(uuid) to authenticated;
grant execute on function public.get_event_members(uuid) to authenticated;

alter table public.notification_categories enable row level security;
alter table public.user_notification_preferences enable row level security;

drop policy if exists "notification_categories_select_authenticated"
on public.notification_categories;
create policy "notification_categories_select_authenticated"
on public.notification_categories
for select
to authenticated
using (public.is_active_platform_user());

drop policy if exists "notification_preferences_select_self"
on public.user_notification_preferences;
create policy "notification_preferences_select_self"
on public.user_notification_preferences
for select
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_platform_user()
);

drop policy if exists "notification_preferences_insert_self"
on public.user_notification_preferences;
create policy "notification_preferences_insert_self"
on public.user_notification_preferences
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_active_platform_user()
);

drop policy if exists "notification_preferences_update_self"
on public.user_notification_preferences;
create policy "notification_preferences_update_self"
on public.user_notification_preferences
for update
to authenticated
using (
  user_id = auth.uid()
  and public.is_active_platform_user()
)
with check (
  user_id = auth.uid()
  and public.is_active_platform_user()
);

insert into storage.buckets (
  id,
  name,
  public,
  file_size_limit,
  allowed_mime_types
)
values (
  'avatars',
  'avatars',
  false,
  1048576,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set
  public = false,
  file_size_limit = 1048576,
  allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

drop policy if exists "avatars_select_authenticated" on storage.objects;
create policy "avatars_select_authenticated"
on storage.objects
for select
to authenticated
using (
  bucket_id = 'avatars'
  and public.is_active_platform_user()
);

drop policy if exists "avatars_insert_owner" on storage.objects;
create policy "avatars_insert_owner"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
  and public.is_active_platform_user()
);

drop policy if exists "avatars_update_owner" on storage.objects;
create policy "avatars_update_owner"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and public.is_active_platform_user()
)
with check (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and name like auth.uid()::text || '/%'
  and public.is_active_platform_user()
);

drop policy if exists "avatars_delete_owner" on storage.objects;
create policy "avatars_delete_owner"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'avatars'
  and owner = auth.uid()
  and public.is_active_platform_user()
);
