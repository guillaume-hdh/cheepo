create table if not exists public.platform_admins (
  user_id uuid primary key references public.profiles (id) on delete cascade,
  created_at timestamptz not null default timezone('utc', now())
);

create table if not exists public.event_activity_log (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  actor_user_id uuid references public.profiles (id) on delete set null,
  actor_name text,
  entity_type text not null,
  entity_id uuid,
  action text not null check (action in ('insert', 'update', 'delete')),
  summary text not null,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default timezone('utc', now())
);

create index if not exists event_activity_log_event_id_idx on public.event_activity_log (event_id);
create index if not exists event_activity_log_created_at_idx on public.event_activity_log (created_at desc);

create or replace function public.is_platform_admin(p_user_id uuid default auth.uid())
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
      from public.platform_admins as admins
      where admins.user_id = p_user_id
    );
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
    p_user_id is not null
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
      'System'
    )
  from public.profiles as profiles
  where profiles.id = p_user_id
  union all
  select 'System'
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
  changed_fields text[] := '{}';
begin
  if p_table_name = 'events' and p_action = 'insert' then
    return p_actor_name || ' a cree l evenement';
  end if;

  if p_table_name = 'events' and p_action = 'delete' then
    return p_actor_name || ' a supprime l evenement';
  end if;

  if p_table_name = 'events' and p_action = 'update' then
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

create or replace function public.log_event_activity()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  target_event_id uuid;
  target_entity_id uuid;
  old_payload jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) else null end;
  new_payload jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) else null end;
  actor_id uuid := auth.uid();
  actor_name text := public.current_actor_name(auth.uid());
  table_name text := tg_table_name;
begin
  if tg_table_name = 'events' then
    target_event_id := coalesce(new.id, old.id);
    target_entity_id := target_event_id;
  elsif tg_table_name = 'event_members' then
    target_event_id := coalesce(new.event_id, old.event_id);
    target_entity_id := coalesce(new.user_id, old.user_id);
  elsif tg_table_name in ('eat_selections', 'bring_items', 'shopping_additions') then
    target_event_id := coalesce(new.event_id, old.event_id);
    target_entity_id := coalesce(new.id, old.id);
  else
    return coalesce(new, old);
  end if;

  if tg_table_name = 'event_members' and tg_op = 'INSERT' and coalesce(new.role, '') = 'host' then
    return new;
  end if;

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
    target_event_id,
    actor_id,
    actor_name,
    table_name,
    target_entity_id,
    lower(tg_op),
    public.describe_event_activity(table_name, lower(tg_op), actor_name, old_payload, new_payload),
    old_payload,
    new_payload
  );

  return coalesce(new, old);
end;
$$;

drop trigger if exists log_events_activity on public.events;
create trigger log_events_activity
after insert or update or delete on public.events
for each row
execute function public.log_event_activity();

drop trigger if exists log_event_members_activity on public.event_members;
create trigger log_event_members_activity
after insert or delete on public.event_members
for each row
execute function public.log_event_activity();

drop trigger if exists log_eat_selections_activity on public.eat_selections;
create trigger log_eat_selections_activity
after insert or update or delete on public.eat_selections
for each row
execute function public.log_event_activity();

drop trigger if exists log_bring_items_activity on public.bring_items;
create trigger log_bring_items_activity
after insert or update or delete on public.bring_items
for each row
execute function public.log_event_activity();

drop trigger if exists log_shopping_additions_activity on public.shopping_additions;
create trigger log_shopping_additions_activity
after insert or update or delete on public.shopping_additions
for each row
execute function public.log_event_activity();

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
  order by coalesce(events.event_date, events.created_at) desc, events.created_at desc;
end;
$$;

create or replace function public.get_event_activity_log(p_event_id uuid)
returns table (
  id uuid,
  event_id uuid,
  actor_user_id uuid,
  actor_name text,
  entity_type text,
  entity_id uuid,
  action text,
  summary text,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_event_member(p_event_id) then
    raise exception 'ACCESS_DENIED';
  end if;

  return query
  select
    logs.id,
    logs.event_id,
    logs.actor_user_id,
    logs.actor_name,
    logs.entity_type,
    logs.entity_id,
    logs.action,
    logs.summary,
    logs.old_values,
    logs.new_values,
    logs.created_at
  from public.event_activity_log as logs
  where logs.event_id = p_event_id
  order by logs.created_at desc;
end;
$$;

grant execute on function public.is_platform_admin(uuid) to authenticated;
grant execute on function public.admin_list_events(text) to authenticated;
grant execute on function public.get_event_activity_log(uuid) to authenticated;

grant select on public.platform_admins to authenticated;
grant select on public.event_activity_log to authenticated;

alter table public.platform_admins enable row level security;
alter table public.event_activity_log enable row level security;

drop policy if exists "platform_admins_select_self" on public.platform_admins;
create policy "platform_admins_select_self"
on public.platform_admins
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "activity_select_for_members" on public.event_activity_log;
create policy "activity_select_for_members"
on public.event_activity_log
for select
to authenticated
using (public.is_event_member(event_id));

drop policy if exists "event_members_insert_for_host" on public.event_members;
create policy "event_members_insert_for_host"
on public.event_members
for insert
to authenticated
with check (
  role = 'member'
  and public.is_event_host(event_id)
);

drop policy if exists "event_members_delete_for_host" on public.event_members;
create policy "event_members_delete_for_host"
on public.event_members
for delete
to authenticated
using (
  role = 'member'
  and public.is_event_host(event_id)
);

drop policy if exists "eat_update_for_host_or_self" on public.eat_selections;
drop policy if exists "eat_update_for_self" on public.eat_selections;
create policy "eat_update_for_host_or_self"
on public.eat_selections
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_event_host(event_id)
)
with check (
  public.is_event_member(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "eat_delete_for_host_or_self" on public.eat_selections;
drop policy if exists "eat_delete_for_self" on public.eat_selections;
create policy "eat_delete_for_host_or_self"
on public.eat_selections
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_event_host(event_id)
);

drop policy if exists "bring_update_for_host_or_self" on public.bring_items;
drop policy if exists "bring_update_for_self" on public.bring_items;
create policy "bring_update_for_host_or_self"
on public.bring_items
for update
to authenticated
using (
  user_id = auth.uid()
  or public.is_event_host(event_id)
)
with check (
  public.is_event_member(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "bring_delete_for_host_or_self" on public.bring_items;
drop policy if exists "bring_delete_for_self" on public.bring_items;
create policy "bring_delete_for_host_or_self"
on public.bring_items
for delete
to authenticated
using (
  user_id = auth.uid()
  or public.is_event_host(event_id)
);

drop policy if exists "shopping_update_for_creator_or_host" on public.shopping_additions;
create policy "shopping_update_for_creator_or_host"
on public.shopping_additions
for update
to authenticated
using (
  created_by = auth.uid()
  or public.is_event_host(event_id)
)
with check (
  public.is_event_member(event_id)
  and (created_by = auth.uid() or public.is_event_host(event_id))
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
