-- Run against an isolated test database after the catalog-management migration.
-- Every fixture and change is rolled back. Never runs the global worker if real jobs are due.
begin;
do $$
declare
  actor uuid; line uuid=gen_random_uuid(); simple uuid=gen_random_uuid(); multi uuid=gen_random_uuid(); flavor uuid=gen_random_uuid();
  adjustment uuid=gen_random_uuid(); scheduled uuid=gen_random_uuid(); cancelled uuid=gen_random_uuid(); failing uuid=gen_random_uuid();
  preview jsonb; job public.yp_price_adjustments; h public.yp_catalog_highlights; n integer;
begin
  select user_id into actor from public.yp_admins where active and not must_change_password limit 1;
  if actor is null then raise exception 'Test database needs a synthetic active admin'; end if;
  if exists(select 1 from public.yp_price_adjustments where status='pending' and scheduled_at<=now()) then raise exception 'Use an isolated database without due jobs'; end if;
  insert into public.yp_lines(id,name) values(line,'Catalog management isolated test '||line);
  insert into public.yp_products(id,line_id,name,sku,package_price,has_flavors) values(simple,line,'Simple fixture','T-'||simple,6260,false),(multi,line,'Flavor fixture','T-'||multi,null,true);
  insert into public.yp_flavors(id,product_id,name,sku,package_price) values(flavor,multi,'Chocolate','T-'||flavor,5850);
  h=public.yp_save_highlight(multi,'New line','Test only',2,'months');
  if not h.active or h.expires_at<>(((h.starts_at at time zone 'America/Sao_Paulo')+interval '2 months') at time zone 'America/Sao_Paulo') then raise exception 'Calendar-month duration failed'; end if;
  h=public.yp_save_highlight(multi,'New title','Test only',10,'days');
  select count(*) into n from public.yp_catalog_highlights where product_id=multi;
  if n<>1 or h.title<>'New title' then raise exception 'Highlight uniqueness failed'; end if;
  update public.yp_catalog_highlights set active=false where id=h.id;
  if exists(select 1 from public.yp_catalog_highlights where id=h.id and active and expires_at>now()) then raise exception 'Highlight termination failed'; end if;
  preview=public.yp_preview_price_adjustment(array[simple,multi],350);
  if jsonb_array_length(preview->'changes')<>2 then raise exception 'Variant selection failed'; end if;
  job=public.yp_create_price_adjustment(adjustment,350,array[simple,multi],null,actor,preview->>'fingerprint');
  if job.status<>'applied' or jsonb_array_length(job.changes)<>2 then raise exception 'Immediate adjustment failed'; end if;
  if (select package_price from public.yp_products where id=simple)<>6480 or (select bundle_price from public.yp_products where id=simple)<>32400 then raise exception 'Product rounding or bundle failed'; end if;
  if (select package_price from public.yp_flavors where id=flavor)<>6055 or (select bundle_price from public.yp_flavors where id=flavor)<>30275 then raise exception 'Flavor rounding or bundle failed'; end if;
  job=public.yp_create_price_adjustment(adjustment,350,array[simple,multi],null,actor,preview->>'fingerprint');
  if (select package_price from public.yp_products where id=simple)<>6480 then raise exception 'Duplicate adjustment was applied twice'; end if;
  -- A stale preview cannot silently overwrite changed prices.
  begin
    perform public.yp_create_price_adjustment(gen_random_uuid(),350,array[simple,multi],null,actor,preview->>'fingerprint');
    raise exception 'Stale preview was accepted';
  exception when sqlstate 'P0002' then null; end;
  preview=public.yp_preview_price_adjustment(array[multi],350);
  job=public.yp_create_price_adjustment(scheduled,350,array[multi],now()+interval '1 hour',actor,preview->>'fingerprint');
  if job.status<>'pending' or (select package_price from public.yp_flavors where id=flavor)<>6055 then raise exception 'Schedule changed prices early'; end if;
  perform public.yp_apply_price_adjustment(scheduled);
  if (select status from public.yp_price_adjustments where id=scheduled)<>'pending' then raise exception 'Future job ran early'; end if;
  job=public.yp_create_price_adjustment(cancelled,350,array[multi],now()+interval '1 hour',actor,preview->>'fingerprint');
  if not public.yp_cancel_price_adjustment(cancelled) or public.yp_cancel_price_adjustment(cancelled) then raise exception 'Cancellation failed'; end if;
  update public.yp_price_adjustments set scheduled_at=now()-interval '1 minute' where id in (scheduled,cancelled);
  n=public.yp_run_due_price_adjustments();
  if n<>1 or (select package_price from public.yp_flavors where id=flavor)<>6270 or (select status from public.yp_price_adjustments where id=cancelled)<>'cancelled' then raise exception 'Due job processing failed'; end if;
  if public.yp_run_due_price_adjustments()<>0 then raise exception 'Scheduler repeated a completed job'; end if;
  -- Scheduled jobs use execution-time prices. Out-of-range results fail atomically.
  preview=public.yp_preview_price_adjustment(array[simple,multi],10000);
  job=public.yp_create_price_adjustment(failing,10000,array[simple,multi],now()+interval '1 hour',actor,preview->>'fingerprint');
  update public.yp_products set package_price=20000000 where id=simple;
  update public.yp_price_adjustments set scheduled_at=now()-interval '1 minute' where id=failing;
  n=public.yp_run_due_price_adjustments();
  if n<>0 or (select status from public.yp_price_adjustments where id=failing)<>'failed' or (select package_price from public.yp_flavors where id=flavor)<>6270 then raise exception 'Failure was not atomic'; end if;
  if has_function_privilege('anon','public.yp_create_price_adjustment(uuid,integer,uuid[],timestamptz,uuid,text)','execute') or has_function_privilege('authenticated','public.yp_run_due_price_adjustments()','execute') then raise exception 'Public RPC access leaked'; end if;
  if has_table_privilege('anon','public.yp_price_adjustments','select') or has_table_privilege('authenticated','public.yp_catalog_highlights','update') then raise exception 'Table access leaked'; end if;
end $$;
rollback;
