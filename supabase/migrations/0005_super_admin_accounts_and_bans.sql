create table if not exists public.platform_user_bans (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  reason text,
  banned_by uuid references public.profiles (id) on delete set null,
  banned_at timestamptz not null default timezone('utc', now()),
  lifted_by uuid references public.profiles (id) on delete set null,
  lifted_at timestamptz
);

create index if not exists platform_user_bans_banned_at_idx
on public.platform_user_bans (banned_at desc);

create or replace function public.is_user_banned(p_user_id uuid default auth.uid())
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
      from public.platform_user_bans as bans
      where bans.user_id = p_user_id
        and bans.lifted_at is null
    );
$$;

create or replace function public.is_active_platform_user(p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select p_user_id is not null and not public.is_user_banned(p_user_id);
$$;

create or replace function public.is_event_member(p_event_id uuid, p_user_id uuid default auth.uid())
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_active_platform_user(p_user_id)
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.event_members as members
        where members.event_id = p_event_id
          and members.user_id = p_user_id
      )
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
    public.is_active_platform_user(p_user_id)
    and (
      public.is_platform_admin(p_user_id)
      or exists (
        select 1
        from public.events as event_row
        where event_row.id = p_event_id
          and event_row.host_id = p_user_id
      )
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

  if public.is_user_banned(auth.uid()) then
    raise exception 'USER_BANNED';
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
  target_status text;
  normalized_code text := upper(trim(coalesce(p_code, '')));
  actor_email text := lower(coalesce(auth.jwt() ->> 'email', ''));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if public.is_user_banned(auth.uid()) then
    raise exception 'USER_BANNED';
  end if;

  select id, status
  into target_event_id, target_status
  from public.events
  where share_code = normalized_code;

  if target_event_id is null then
    raise exception 'INVALID_CODE';
  end if;

  if coalesce(target_status, 'active') = 'archived' then
    raise exception 'EVENT_ARCHIVED';
  end if;

  insert into public.event_members (event_id, user_id, role)
  values (target_event_id, auth.uid(), 'member')
  on conflict do nothing;

  if actor_email <> '' then
    update public.event_invitations
    set
      status = 'accepted',
      accepted_at = timezone('utc', now()),
      accepted_by = auth.uid(),
      revoked_at = null
    where event_id = target_event_id
      and lower(email) = actor_email;
  end if;

  return target_event_id;
end;
$$;

create or replace function public.get_session_flags()
returns table (
  is_platform_admin boolean,
  is_banned boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_platform_admin(auth.uid()) as is_platform_admin,
    public.is_user_banned(auth.uid()) as is_banned;
$$;

create or replace function public.admin_get_overview_stats()
returns table (
  total_events bigint,
  active_events bigint,
  archived_events bigint,
  total_accounts bigint,
  banned_accounts bigint,
  average_members_per_event numeric,
  pending_invitations bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_user_banned() or not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  with member_counts as (
    select
      events.id,
      count(members.user_id)::numeric as member_count
    from public.events
    left join public.event_members as members
      on members.event_id = events.id
    group by events.id
  )
  select
    (select count(*)::bigint from public.events) as total_events,
    (select count(*)::bigint from public.events where status = 'active') as active_events,
    (select count(*)::bigint from public.events where status = 'archived') as archived_events,
    (select count(*)::bigint from public.profiles) as total_accounts,
    (
      select count(*)::bigint
      from public.platform_user_bans as bans
      where bans.lifted_at is null
    ) as banned_accounts,
    coalesce((select round(avg(member_count), 1) from member_counts), 0) as average_members_per_event,
    (
      select count(*)::bigint
      from public.event_invitations as invitations
      where invitations.status = 'pending'
    ) as pending_invitations;
end;
$$;

create or replace function public.admin_list_accounts(p_search text default null)
returns table (
  user_id uuid,
  email text,
  display_name text,
  created_at timestamptz,
  is_platform_admin boolean,
  is_banned boolean,
  ban_reason text,
  banned_at timestamptz,
  hosted_events bigint,
  member_events bigint,
  pending_invitations bigint
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_user_banned() or not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  with hosted as (
    select
      events.host_id as user_id,
      count(*)::bigint as hosted_events
    from public.events
    group by events.host_id
  ),
  members as (
    select
      event_members.user_id,
      count(*) filter (where event_members.role = 'member')::bigint as member_events
    from public.event_members
    group by event_members.user_id
  ),
  pending_invites as (
    select
      lower(invitations.email) as email_key,
      count(*)::bigint as pending_invitations
    from public.event_invitations as invitations
    where invitations.status = 'pending'
    group by lower(invitations.email)
  )
  select
    profiles.id as user_id,
    profiles.email,
    coalesce(
      nullif(trim(profiles.display_name), ''),
      split_part(coalesce(profiles.email, ''), '@', 1),
      'Compte'
    ) as display_name,
    profiles.created_at,
    admins.user_id is not null as is_platform_admin,
    active_bans.user_id is not null as is_banned,
    active_bans.reason as ban_reason,
    active_bans.banned_at,
    coalesce(hosted.hosted_events, 0) as hosted_events,
    coalesce(members.member_events, 0) as member_events,
    coalesce(pending_invites.pending_invitations, 0) as pending_invitations
  from public.profiles as profiles
  left join public.platform_admins as admins
    on admins.user_id = profiles.id
  left join public.platform_user_bans as active_bans
    on active_bans.user_id = profiles.id
   and active_bans.lifted_at is null
  left join hosted
    on hosted.user_id = profiles.id
  left join members
    on members.user_id = profiles.id
  left join pending_invites
    on pending_invites.email_key = lower(coalesce(profiles.email, ''))
  where (
    nullif(trim(coalesce(p_search, '')), '') is null
    or lower(coalesce(profiles.display_name, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(profiles.email, '')) like '%' || lower(trim(p_search)) || '%'
  )
  order by
    admins.user_id desc nulls last,
    coalesce(hosted.hosted_events, 0) desc,
    profiles.created_at desc;
end;
$$;

create or replace function public.admin_list_account_events(p_user_id uuid)
returns table (
  event_id uuid,
  title text,
  share_code text,
  event_date timestamptz,
  status text,
  role text,
  location text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_user_banned() or not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  select
    events.id as event_id,
    events.title,
    events.share_code,
    events.event_date,
    events.status,
    members.role,
    events.location,
    members.joined_at
  from public.event_members as members
  join public.events as events
    on events.id = members.event_id
  where members.user_id = p_user_id
  order by
    case when members.role = 'host' then 0 else 1 end,
    coalesce(events.event_date, events.created_at) desc,
    members.joined_at desc;
end;
$$;

create or replace function public.admin_set_user_ban(
  p_user_id uuid,
  p_banned boolean default true,
  p_reason text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if public.is_user_banned() or not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  if p_user_id is null or not exists (
    select 1
    from public.profiles as profiles
    where profiles.id = p_user_id
  ) then
    raise exception 'ACCOUNT_NOT_FOUND';
  end if;

  if p_user_id = auth.uid() then
    raise exception 'CANNOT_BAN_SELF';
  end if;

  if p_banned then
    insert into public.platform_user_bans (
      user_id,
      reason,
      banned_by,
      banned_at,
      lifted_by,
      lifted_at
    )
    values (
      p_user_id,
      nullif(trim(coalesce(p_reason, '')), ''),
      auth.uid(),
      timezone('utc', now()),
      null,
      null
    )
    on conflict (user_id) do update
    set
      reason = excluded.reason,
      banned_by = excluded.banned_by,
      banned_at = excluded.banned_at,
      lifted_by = null,
      lifted_at = null;
  else
    update public.platform_user_bans
    set
      reason = nullif(trim(coalesce(p_reason, '')), ''),
      lifted_by = auth.uid(),
      lifted_at = timezone('utc', now())
    where user_id = p_user_id;
  end if;

  return p_user_id;
end;
$$;

grant execute on function public.get_session_flags() to authenticated;
grant execute on function public.admin_get_overview_stats() to authenticated;
grant execute on function public.admin_list_accounts(text) to authenticated;
grant execute on function public.admin_list_account_events(uuid) to authenticated;
grant execute on function public.admin_set_user_ban(uuid, boolean, text) to authenticated;

alter table public.platform_user_bans enable row level security;

drop policy if exists "platform_user_bans_select_self_or_admin" on public.platform_user_bans;
create policy "platform_user_bans_select_self_or_admin"
on public.platform_user_bans
for select
to authenticated
using (
  user_id = auth.uid()
  or public.is_platform_admin()
);

drop policy if exists "profiles_select_self" on public.profiles;
create policy "profiles_select_self"
on public.profiles
for select
to authenticated
using (
  id = auth.uid()
  and public.is_active_platform_user()
);

drop policy if exists "profiles_update_self" on public.profiles;
create policy "profiles_update_self"
on public.profiles
for update
to authenticated
using (
  id = auth.uid()
  and public.is_active_platform_user()
)
with check (
  id = auth.uid()
  and public.is_active_platform_user()
);

drop policy if exists "events_insert_for_host" on public.events;
create policy "events_insert_for_host"
on public.events
for insert
to authenticated
with check (
  host_id = auth.uid()
  and public.is_active_platform_user()
);

drop policy if exists "catalog_items_select_for_authenticated" on public.catalog_items;
create policy "catalog_items_select_for_authenticated"
on public.catalog_items
for select
to authenticated
using (
  is_active = true
  and public.is_active_platform_user()
);
