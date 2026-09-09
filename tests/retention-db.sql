-- Transactional verification: every fixture is rolled back; no real shop is changed.
begin;
do $$
declare c uuid:=gen_random_uuid(); o uuid:=gen_random_uuid(); result jsonb; queue jsonb; stamp timestamptz; days integer;
begin
 insert into public.yp_customers(id,phone,store_name,pin_hash,pin_salt) values(c,'5545000000001','__retention_rollback_fixture__','test-only','test-only');
 result:=public.yp_save_customer_cart(c,0,'[{"product_id":"base","quantity":1}]',5016);
 assert (result->>'saved')::boolean and (result->'cart'->>'revision')::integer=1,'initial draft';
 result:=public.yp_save_customer_cart(c,0,'[{"product_id":"base","quantity":9}]',45144);
 assert not (result->>'saved')::boolean,'stale save must fail';
 insert into public.yp_orders(id,customer_id,public_number,client_token_hash,session_id,customer_name,company,phone,city,state,items,total,cart_revision)
 values(o,c,'TEST-'||o,'test-only',gen_random_uuid(),'Test','Test','5545000000001','Test','PR','[{"product_id":"base","quantity":1}]',5016,1);
 assert (select status='prepared' and revision=2 from public.yp_customer_carts where customer_id=c),'checkout closes draft';
 result:=public.yp_save_customer_cart(c,1,'[{"quantity":9}]',45144);
 assert not (result->>'saved')::boolean and result->'cart'->>'status'='prepared','late save cannot resurrect';
 result:=public.yp_save_customer_cart(c,2,'[{"quantity":2}]',10032);
 assert (result->>'saved')::boolean,'new deliberate draft';
 begin
  insert into public.yp_orders(id,customer_id,public_number,client_token_hash,session_id,customer_name,company,phone,city,state,items,total,cart_revision)
  values(gen_random_uuid(),c,'STALE-'||gen_random_uuid(),'test-only',gen_random_uuid(),'Test','Test','5545000000001','Test','PR','[]',5016,2);
  raise exception 'stale checkout unexpectedly accepted';
 exception when serialization_failure then null;
 end;
 assert (select revision=3 and status='active' from public.yp_customer_carts where customer_id=c),'newer draft preserved';
 update public.yp_customer_carts set updated_at=now()-interval '3 hours' where customer_id=c;
 queue:=public.yp_retention_queue('carts',0,'__retention_rollback_fixture__');assert (queue->>'total')::integer=1,'inactive draft visible';
 update public.yp_customer_carts set dismissed_revision=revision where customer_id=c;
 queue:=public.yp_retention_queue('carts',0,'__retention_rollback_fixture__');assert (queue->>'total')::integer=0,'dismissed draft hidden';
 result:=public.yp_save_customer_cart(c,3,'[{"quantity":3}]',15048);
 assert result->'cart'->>'dismissed_revision' is null,'fresh edit resets dismissal';
 -- Prepared/test/cancelled orders must not influence the purchase interval.
 foreach days in array array[100,70,40] loop
  insert into public.yp_orders(id,customer_id,public_number,client_token_hash,session_id,customer_name,company,phone,city,state,items,total,status,purchased_at,created_at)
  values(gen_random_uuid(),c,'HIST-'||gen_random_uuid(),'test-only',gen_random_uuid(),'Test','Test','5545000000001','Test','PR','[]',5016,'confirmed',now()-make_interval(days=>days),now()-make_interval(days=>days));
 end loop;
 update public.yp_orders set status='cancelled' where id=o;
 queue:=public.yp_retention_queue('reorder',0,'__retention_rollback_fixture__');
 assert (queue->>'total')::integer=1 and (queue->'rows'->0->>'cycle_days')::integer=30,'30-day inferred cycle';
 select purchased_at into stamp from public.yp_orders where customer_id=c and status='confirmed' order by purchased_at desc limit 1;
 update public.yp_orders set status_note='note change',updated_at=now(),status='fulfilled' where customer_id=c and purchased_at=stamp;
 assert (select max(purchased_at)=stamp from public.yp_orders where customer_id=c),'notes must not change purchase date';
 insert into public.yp_customer_followups(customer_id,cycle_days) values(c,60);
 queue:=public.yp_retention_queue('reorder',0,'__retention_rollback_fixture__');assert (queue->>'total')::integer=0,'manual interval overrides history';
 assert not has_table_privilege('anon','public.yp_customer_carts','select'),'anonymous drafts denied';
 assert not has_table_privilege('authenticated','public.yp_customer_favorites','select'),'authenticated direct favorites denied';
 assert not has_function_privilege('anon','public.yp_retention_queue(text,integer,text)','execute'),'public queue denied';
end $$;
select 'retention transaction checks passed; all fixtures rolled back' as verification;
rollback;
