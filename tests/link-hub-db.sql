-- Run after the link_hub migration in an isolated Postgres database only.
begin;
do $$
declare
  first_id text; stats jsonb; changed integer;
begin
  if not (select relrowsecurity from pg_class where oid='public.yp_link_hub'::regclass)
    or not (select relrowsecurity from pg_class where oid='public.yp_link_hub_daily'::regclass) then raise exception 'RLS missing'; end if;
  if has_table_privilege('anon','public.yp_link_hub','SELECT') or has_table_privilege('authenticated','public.yp_link_hub','UPDATE')
    or has_function_privilege('anon','public.yp_record_link_hub_event(text)','EXECUTE')
    or has_function_privilege('authenticated','public.yp_link_hub_stats()','EXECUTE') then raise exception 'Unexpected public access'; end if;
  select config->'links'->0->>'id' into first_id from public.yp_link_hub where id=1;
  if not public.yp_record_link_hub_event('page') or not public.yp_record_link_hub_event(first_id)
    or not public.yp_record_link_hub_event(first_id) then raise exception 'Valid event rejected'; end if;
  if public.yp_record_link_hub_event(gen_random_uuid()::text) or public.yp_record_link_hub_event(null) then raise exception 'Unknown event accepted'; end if;
  stats=public.yp_link_hub_stats();
  if (stats->>'views')::int<>1 or (stats->>'clicks')::int<>2 or (stats->'links'->>first_id)::int<>2 then raise exception 'Counter total failed'; end if;
  insert into public.yp_link_hub_daily(event_day,event_key,events) values(current_date-40,'page',500);
  if (public.yp_link_hub_stats()->>'views')::int<>1 then raise exception 'Old metrics included'; end if;
  update public.yp_link_hub set config=jsonb_set(config,'{links,0,enabled}','false');
  if public.yp_record_link_hub_event(first_id) then raise exception 'Hidden link counted'; end if;
  update public.yp_link_hub set config=jsonb_set(jsonb_set(config,'{links,0,enabled}','true'),'{links,0,starts_at}',to_jsonb((now()+interval '1 day')::text));
  if public.yp_record_link_hub_event(first_id) then raise exception 'Future link counted'; end if;
  update public.yp_link_hub set config=jsonb_set(jsonb_set(config,'{links,0,starts_at}','null'),'{links,0,ends_at}',to_jsonb(now()::text));
  if public.yp_record_link_hub_event(first_id) then raise exception 'Expired link counted'; end if;
  update public.yp_link_hub set version=2 where id=1 and version=1;
  update public.yp_link_hub set version=3 where id=1 and version=1;
  get diagnostics changed = row_count;
  if changed<>0 then raise exception 'Stale writer overwrote current version'; end if;
end $$;
rollback;
