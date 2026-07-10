create or replace function public.is_event_active(p_event_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.events as events
    where events.id = p_event_id
      and coalesce(events.status, 'active') = 'active'
  );
$$;

grant execute on function public.is_event_active(uuid) to authenticated;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_title_length_check'
  ) then
    alter table public.events
    add constraint events_title_length_check
    check (char_length(trim(title)) between 3 and 120)
    not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_location_length_check'
  ) then
    alter table public.events
    add constraint events_location_length_check
    check (location is null or char_length(trim(location)) <= 160)
    not valid;
  end if;

  if not exists (
    select 1
    from pg_constraint
    where conname = 'events_description_length_check'
  ) then
    alter table public.events
    add constraint events_description_length_check
    check (description is null or char_length(trim(description)) <= 2000)
    not valid;
  end if;
end
$$;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'eat_selections_label_length_check'
  ) then
    alter table public.eat_selections
    add constraint eat_selections_label_length_check
    check (char_length(trim(label)) between 1 and 120)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bring_items_label_length_check'
  ) then
    alter table public.bring_items
    add constraint bring_items_label_length_check
    check (char_length(trim(label)) between 1 and 120)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shopping_additions_label_length_check'
  ) then
    alter table public.shopping_additions
    add constraint shopping_additions_label_length_check
    check (char_length(trim(label)) between 1 and 120)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'eat_selections_unit_length_check'
  ) then
    alter table public.eat_selections
    add constraint eat_selections_unit_length_check
    check (char_length(trim(unit)) between 1 and 40)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'bring_items_unit_length_check'
  ) then
    alter table public.bring_items
    add constraint bring_items_unit_length_check
    check (char_length(trim(unit)) between 1 and 40)
    not valid;
  end if;

  if not exists (
    select 1 from pg_constraint where conname = 'shopping_additions_unit_length_check'
  ) then
    alter table public.shopping_additions
    add constraint shopping_additions_unit_length_check
    check (char_length(trim(unit)) between 1 and 40)
    not valid;
  end if;
end
$$;

drop policy if exists "events_update_for_host" on public.events;
create policy "events_update_for_host"
on public.events
for update
to authenticated
using (
  public.is_event_host(id)
  and public.is_event_active(id)
)
with check (
  public.is_event_host(id)
  and public.is_event_active(id)
);

drop policy if exists "events_delete_for_host" on public.events;
create policy "events_delete_for_host"
on public.events
for delete
to authenticated
using (
  public.is_event_host(id)
  and public.is_event_active(id)
);

drop policy if exists "event_members_insert_for_host" on public.event_members;
create policy "event_members_insert_for_host"
on public.event_members
for insert
to authenticated
with check (
  role = 'member'
  and public.is_event_host(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "event_members_delete_for_host" on public.event_members;
create policy "event_members_delete_for_host"
on public.event_members
for delete
to authenticated
using (
  role = 'member'
  and public.is_event_host(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "eat_insert_for_self" on public.eat_selections;
create policy "eat_insert_for_self"
on public.eat_selections
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_event_member(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "eat_update_for_host_or_self" on public.eat_selections;
create policy "eat_update_for_host_or_self"
on public.eat_selections
for update
to authenticated
using (
  public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
)
with check (
  public.is_event_member(event_id)
  and public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "eat_delete_for_host_or_self" on public.eat_selections;
create policy "eat_delete_for_host_or_self"
on public.eat_selections
for delete
to authenticated
using (
  public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "bring_insert_for_self" on public.bring_items;
create policy "bring_insert_for_self"
on public.bring_items
for insert
to authenticated
with check (
  user_id = auth.uid()
  and public.is_event_member(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "bring_update_for_host_or_self" on public.bring_items;
create policy "bring_update_for_host_or_self"
on public.bring_items
for update
to authenticated
using (
  public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
)
with check (
  public.is_event_member(event_id)
  and public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "bring_delete_for_host_or_self" on public.bring_items;
create policy "bring_delete_for_host_or_self"
on public.bring_items
for delete
to authenticated
using (
  public.is_event_active(event_id)
  and (user_id = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "shopping_insert_for_members" on public.shopping_additions;
create policy "shopping_insert_for_members"
on public.shopping_additions
for insert
to authenticated
with check (
  created_by = auth.uid()
  and public.is_event_member(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "shopping_update_for_creator_or_host" on public.shopping_additions;
create policy "shopping_update_for_creator_or_host"
on public.shopping_additions
for update
to authenticated
using (
  public.is_event_active(event_id)
  and (created_by = auth.uid() or public.is_event_host(event_id))
)
with check (
  public.is_event_member(event_id)
  and public.is_event_active(event_id)
  and (created_by = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "shopping_delete_for_creator_or_host" on public.shopping_additions;
create policy "shopping_delete_for_creator_or_host"
on public.shopping_additions
for delete
to authenticated
using (
  public.is_event_active(event_id)
  and (created_by = auth.uid() or public.is_event_host(event_id))
);

drop policy if exists "event_invitations_insert_for_host" on public.event_invitations;
create policy "event_invitations_insert_for_host"
on public.event_invitations
for insert
to authenticated
with check (
  invited_by = auth.uid()
  and public.is_event_host(event_id)
  and public.is_event_active(event_id)
);

drop policy if exists "event_invitations_update_for_host" on public.event_invitations;
create policy "event_invitations_update_for_host"
on public.event_invitations
for update
to authenticated
using (
  public.is_event_host(event_id)
  and public.is_event_active(event_id)
)
with check (
  public.is_event_host(event_id)
  and public.is_event_active(event_id)
);

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

  if not public.is_event_active(p_event_id) then
    raise exception 'EVENT_ARCHIVED';
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

  if not public.is_event_active(target_event_id) then
    raise exception 'EVENT_ARCHIVED';
  end if;

  update public.event_invitations
  set
    status = 'revoked',
    revoked_at = timezone('utc', now())
  where id = p_invitation_id;

  return p_invitation_id;
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

  if not public.is_event_active(p_event_id) then
    raise exception 'EVENT_ARCHIVED';
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
