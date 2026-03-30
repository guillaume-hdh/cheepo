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

  if tg_table_name = 'event_members' and tg_op = 'INSERT' and coalesce(new_payload ->> 'role', '') = 'host' then
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
