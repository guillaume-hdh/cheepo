alter table public.events
add column if not exists status text not null default 'active';

alter table public.events
add column if not exists archived_at timestamptz;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_status_check'
  ) then
    alter table public.events
    add constraint events_status_check check (status in ('active', 'archived'));
  end if;
end
$$;

update public.events
set status = 'active'
where status is null;

create table if not exists public.event_invitations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  email text not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'revoked')),
  message text,
  invited_by uuid not null references public.profiles (id) on delete cascade,
  accepted_by uuid references public.profiles (id) on delete set null,
  invited_at timestamptz not null default timezone('utc', now()),
  accepted_at timestamptz,
  revoked_at timestamptz
);

create index if not exists event_invitations_event_id_idx on public.event_invitations (event_id);
create unique index if not exists event_invitations_event_email_idx
on public.event_invitations (event_id, lower(email));

create or replace function public.current_actor_name(p_user_id uuid default auth.uid())
returns text
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      nullif(trim(profiles.display_name), ''),
      split_part(coalesce(profiles.email, ''), '@', 1),
      'Systeme'
    )
  from public.profiles as profiles
  where profiles.id = p_user_id
  union all
  select 'Systeme'
  limit 1;
$$;

create or replace function public.describe_event_activity(
  p_table_name text,
  p_action text,
  p_actor_name text,
  p_old jsonb,
  p_new jsonb
)
returns text
language plpgsql
stable
set search_path = public
as $$
declare
  item_label text := coalesce(p_new ->> 'label', p_old ->> 'label', 'element');
  item_quantity text := coalesce(p_new ->> 'quantity', p_old ->> 'quantity', '?');
  item_unit text := coalesce(p_new ->> 'unit', p_old ->> 'unit', '');
  member_user_id uuid := nullif(coalesce(p_new ->> 'user_id', p_old ->> 'user_id', ''), '')::uuid;
  member_name text := coalesce(public.current_actor_name(member_user_id), 'participant');
  old_status text := coalesce(p_old ->> 'status', '');
  new_status text := coalesce(p_new ->> 'status', '');
  changed_fields text[] := '{}';
begin
  if p_table_name = 'events' and p_action = 'insert' then
    return p_actor_name || ' a cree l evenement';
  end if;

  if p_table_name = 'events' and p_action = 'delete' then
    return p_actor_name || ' a supprime l evenement';
  end if;

  if p_table_name = 'events' and p_action = 'update' then
    if old_status is distinct from new_status and new_status = 'archived' then
      return p_actor_name || ' a archive l evenement';
    end if;

    if old_status is distinct from new_status and new_status = 'active' then
      return p_actor_name || ' a reactive l evenement';
    end if;

    if coalesce(p_old ->> 'title', '') is distinct from coalesce(p_new ->> 'title', '') then
      changed_fields := array_append(changed_fields, 'le titre');
    end if;
    if coalesce(p_old ->> 'event_date', '') is distinct from coalesce(p_new ->> 'event_date', '') then
      changed_fields := array_append(changed_fields, 'la date');
    end if;
    if coalesce(p_old ->> 'location', '') is distinct from coalesce(p_new ->> 'location', '') then
      changed_fields := array_append(changed_fields, 'le lieu');
    end if;
    if coalesce(p_old ->> 'description', '') is distinct from coalesce(p_new ->> 'description', '') then
      changed_fields := array_append(changed_fields, 'la description');
    end if;

    if array_length(changed_fields, 1) is null then
      return p_actor_name || ' a modifie l evenement';
    end if;

    return p_actor_name || ' a modifie ' || array_to_string(changed_fields, ', ');
  end if;

  if p_table_name = 'event_members' and p_action = 'insert' then
    return p_actor_name || ' a ajoute ' || member_name || ' a l evenement';
  end if;

  if p_table_name = 'event_members' and p_action = 'delete' then
    return p_actor_name || ' a retire ' || member_name || ' de l evenement';
  end if;

  if p_table_name = 'eat_selections' and p_action = 'insert' then
    return p_actor_name || ' a ajoute ' || item_label || ' (' || item_quantity || ' ' || item_unit || ') dans les repas';
  end if;

  if p_table_name = 'eat_selections' and p_action = 'update' then
    return p_actor_name || ' a modifie ' || item_label || ' dans les repas';
  end if;

  if p_table_name = 'eat_selections' and p_action = 'delete' then
    return p_actor_name || ' a supprime ' || item_label || ' des repas';
  end if;

  if p_table_name = 'bring_items' and p_action = 'insert' then
    return p_actor_name || ' a ajoute ' || item_label || ' (' || item_quantity || ' ' || item_unit || ') dans les apports';
  end if;

  if p_table_name = 'bring_items' and p_action = 'update' then
    return p_actor_name || ' a modifie ' || item_label || ' dans les apports';
  end if;

  if p_table_name = 'bring_items' and p_action = 'delete' then
    return p_actor_name || ' a supprime ' || item_label || ' des apports';
  end if;

  if p_table_name = 'shopping_additions' and p_action = 'insert' then
    return p_actor_name || ' a ajoute ' || item_label || ' (' || item_quantity || ' ' || item_unit || ') a la liste de courses';
  end if;

  if p_table_name = 'shopping_additions' and p_action = 'update' then
    return p_actor_name || ' a modifie ' || item_label || ' dans la liste de courses';
  end if;

  if p_table_name = 'shopping_additions' and p_action = 'delete' then
    return p_actor_name || ' a supprime ' || item_label || ' de la liste de courses';
  end if;

  return p_actor_name || ' a modifie un element';
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

drop function if exists public.admin_list_events(text);

create or replace function public.admin_list_events(p_search text default null)
returns table (
  id uuid,
  title text,
  description text,
  location text,
  event_date timestamptz,
  share_code text,
  host_id uuid,
  host_name text,
  host_email text,
  status text,
  member_count bigint,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_platform_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;

  return query
  select
    events.id,
    events.title,
    events.description,
    events.location,
    events.event_date,
    events.share_code,
    events.host_id,
    coalesce(
      nullif(trim(host_profile.display_name), ''),
      split_part(coalesce(host_profile.email, ''), '@', 1),
      'Hote'
    ) as host_name,
    host_profile.email as host_email,
    events.status,
    count(members.user_id)::bigint as member_count,
    events.created_at
  from public.events
  left join public.profiles as host_profile
    on host_profile.id = events.host_id
  left join public.event_members as members
    on members.event_id = events.id
  where (
    nullif(trim(coalesce(p_search, '')), '') is null
    or lower(events.title) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(events.location, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(events.share_code, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(host_profile.display_name, '')) like '%' || lower(trim(p_search)) || '%'
    or lower(coalesce(host_profile.email, '')) like '%' || lower(trim(p_search)) || '%'
  )
  group by events.id, host_profile.id
  order by
    case when events.status = 'active' then 0 else 1 end,
    coalesce(events.event_date, events.created_at) desc,
    events.created_at desc;
end;
$$;

create or replace function public.get_event_invitations(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  email text,
  status text,
  message text,
  invited_by uuid,
  invited_at timestamptz,
  accepted_at timestamptz,
  revoked_at timestamptz,
  accepted_by uuid,
  accepted_user_name text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_host(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  return query
  select
    invitations.id,
    invitations.event_id,
    invitations.email,
    invitations.status,
    invitations.message,
    invitations.invited_by,
    invitations.invited_at,
    invitations.accepted_at,
    invitations.revoked_at,
    invitations.accepted_by,
    case
      when accepted_profile.id is null then null
      else coalesce(
        nullif(trim(accepted_profile.display_name), ''),
        split_part(coalesce(accepted_profile.email, ''), '@', 1)
      )
    end as accepted_user_name
  from public.event_invitations as invitations
  left join public.profiles as accepted_profile
    on accepted_profile.id = invitations.accepted_by
  where invitations.event_id = p_event_id
  order by invitations.invited_at desc;
end;
$$;

create or replace function public.create_event_invitation(
  p_event_id uuid,
  p_email text,
  p_message text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  invitation_id uuid;
  normalized_email text := lower(trim(coalesce(p_email, '')));
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_event_host(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  if normalized_email = '' or position('@' in normalized_email) = 0 then
    raise exception 'INVALID_EMAIL';
  end if;

  if exists (
    select 1
    from public.event_members as members
    join public.profiles as profiles
      on profiles.id = members.user_id
    where members.event_id = p_event_id
      and lower(coalesce(profiles.email, '')) = normalized_email
  ) then
    raise exception 'ALREADY_MEMBER';
  end if;

  select invitations.id
  into invitation_id
  from public.event_invitations as invitations
  where invitations.event_id = p_event_id
    and lower(invitations.email) = normalized_email;

  if invitation_id is null then
    insert into public.event_invitations (
      event_id,
      email,
      status,
      message,
      invited_by
    )
    values (
      p_event_id,
      normalized_email,
      'pending',
      nullif(trim(coalesce(p_message, '')), ''),
      auth.uid()
    )
    returning id into invitation_id;
  else
    update public.event_invitations
    set
      email = normalized_email,
      status = 'pending',
      message = nullif(trim(coalesce(p_message, '')), ''),
      invited_by = auth.uid(),
      invited_at = timezone('utc', now()),
      accepted_at = null,
      accepted_by = null,
      revoked_at = null
    where id = invitation_id;
  end if;

  return invitation_id;
end;
$$;

create or replace function public.revoke_event_invitation(p_invitation_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
begin
  select invitations.event_id
  into target_event_id
  from public.event_invitations as invitations
  where invitations.id = p_invitation_id;

  if target_event_id is null then
    raise exception 'INVITATION_NOT_FOUND';
  end if;

  if not public.is_event_host(target_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  update public.event_invitations
  set
    status = 'revoked',
    revoked_at = timezone('utc', now())
  where id = p_invitation_id;

  return p_invitation_id;
end;
$$;

create or replace function public.archive_event(p_event_id uuid, p_archived boolean default true)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_host(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  update public.events
  set
    status = case when p_archived then 'archived' else 'active' end,
    archived_at = case when p_archived then timezone('utc', now()) else null end
  where id = p_event_id;

  return p_event_id;
end;
$$;

create or replace function public.duplicate_event(p_event_id uuid, p_title text default null)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  source_event public.events%rowtype;
  new_event_id uuid;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED';
  end if;

  if not public.is_event_host(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  select *
  into source_event
  from public.events
  where id = p_event_id;

  if source_event.id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  insert into public.events (
    host_id,
    title,
    description,
    location,
    event_date,
    share_code,
    status,
    archived_at
  )
  values (
    auth.uid(),
    coalesce(nullif(trim(coalesce(p_title, '')), ''), source_event.title || ' (copie)'),
    source_event.description,
    source_event.location,
    source_event.event_date,
    public.generate_share_code(6),
    'active',
    null
  )
  returning id into new_event_id;

  insert into public.event_members (event_id, user_id, role)
  values (new_event_id, auth.uid(), 'host')
  on conflict do nothing;

  insert into public.shopping_additions (event_id, label, unit, quantity, created_by)
  select
    new_event_id,
    additions.label,
    additions.unit,
    additions.quantity,
    auth.uid()
  from public.shopping_additions as additions
  where additions.event_id = p_event_id;

  return new_event_id;
end;
$$;

create or replace function public.transfer_event_host(p_event_id uuid, p_new_host_user_id uuid)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_host_id uuid;
  actor_name text := public.current_actor_name(auth.uid());
  next_host_name text := public.current_actor_name(p_new_host_user_id);
begin
  if not public.is_event_host(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  select events.host_id
  into current_host_id
  from public.events as events
  where events.id = p_event_id;

  if current_host_id is null then
    raise exception 'EVENT_NOT_FOUND';
  end if;

  if current_host_id = p_new_host_user_id then
    return p_event_id;
  end if;

  if not exists (
    select 1
    from public.event_members as members
    where members.event_id = p_event_id
      and members.user_id = p_new_host_user_id
  ) then
    raise exception 'TARGET_NOT_MEMBER';
  end if;

  update public.event_members
  set role = 'member'
  where event_id = p_event_id
    and user_id = current_host_id;

  update public.event_members
  set role = 'host'
  where event_id = p_event_id
    and user_id = p_new_host_user_id;

  update public.events
  set host_id = p_new_host_user_id
  where id = p_event_id;

  insert into public.event_activity_log (
    event_id,
    actor_user_id,
    actor_name,
    entity_type,
    entity_id,
    action,
    summary,
    old_values,
    new_values
  )
  values (
    p_event_id,
    auth.uid(),
    actor_name,
    'events',
    p_event_id,
    'update',
    actor_name || ' a transfere le role d hote a ' || next_host_name,
    jsonb_build_object('host_id', current_host_id),
    jsonb_build_object('host_id', p_new_host_user_id)
  );

  return p_event_id;
end;
$$;

grant execute on function public.join_event_by_code(text) to authenticated;
grant execute on function public.admin_list_events(text) to authenticated;
grant execute on function public.get_event_invitations(uuid) to authenticated;
grant execute on function public.create_event_invitation(uuid, text, text) to authenticated;
grant execute on function public.revoke_event_invitation(uuid) to authenticated;
grant execute on function public.archive_event(uuid, boolean) to authenticated;
grant execute on function public.duplicate_event(uuid, text) to authenticated;
grant execute on function public.transfer_event_host(uuid, uuid) to authenticated;

grant select, insert, update on public.event_invitations to authenticated;

alter table public.event_invitations enable row level security;

drop policy if exists "event_invitations_select_for_host" on public.event_invitations;
create policy "event_invitations_select_for_host"
on public.event_invitations
for select
to authenticated
using (public.is_event_host(event_id));

drop policy if exists "event_invitations_insert_for_host" on public.event_invitations;
create policy "event_invitations_insert_for_host"
on public.event_invitations
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.is_event_host(event_id)
);

drop policy if exists "event_invitations_update_for_host" on public.event_invitations;
create policy "event_invitations_update_for_host"
on public.event_invitations
for update
to authenticated
using (public.is_event_host(event_id))
with check (public.is_event_host(event_id));
