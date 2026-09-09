-- Delete catalog entries without erasing quotations, historical metrics or order snapshots.
begin;
alter table public.yp_products add column deleted_at timestamptz;
alter table public.yp_flavors add column deleted_at timestamptz;
alter table public.yp_products add constraint yp_deleted_product_unavailable check(deleted_at is null or (not active and not available));
alter table public.yp_flavors add constraint yp_deleted_flavor_unavailable check(deleted_at is null or (not active and not available));
alter table public.yp_products drop constraint yp_products_sku_key;
create unique index yp_product_live_sku on public.yp_products(sku) where deleted_at is null;
alter table public.yp_flavors drop constraint yp_flavors_product_id_name_key;
create unique index yp_flavor_live_name on public.yp_flavors(product_id,name) where deleted_at is null;
drop index public.yp_flavor_code_unique;
create unique index yp_flavor_code_unique on public.yp_flavors(lower(sku)) where deleted_at is null;

create function public.yp_guard_live_flavor() returns trigger language plpgsql set search_path='' as $$
begin
 -- Existing live rows stay under the same parent; deletion will lock and hide them.
 -- Avoid reversing parent/child lock order for routine price edits.
 if tg_op='UPDATE' then
  if new.product_id=old.product_id and old.deleted_at is null then return new; end if;
 end if;
 if new.deleted_at is null then
  perform 1 from public.yp_products where id=new.product_id and deleted_at is null for key share;
  if not found then raise exception 'Product was deleted' using errcode='23514'; end if;
 end if;
 return new;
end $$;
create trigger yp_guard_live_flavor before insert or update on public.yp_flavors for each row execute function public.yp_guard_live_flavor();

create function public.yp_delete_catalog_item(p_kind text,p_id uuid,p_product uuid default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare parent_id uuid; item_name text; deleted_count integer; stamp timestamptz=clock_timestamp();
begin
 if p_kind='product' then parent_id=p_id;
 elsif p_kind='flavor' then parent_id=p_product;
 else raise exception 'Invalid catalog kind' using errcode='22023'; end if;
 -- Parent lock also serializes new flavor inserts with product deletion.
 perform 1 from public.yp_products where id=parent_id and deleted_at is null for update;
 if not found then return jsonb_build_object('deleted',false); end if;
 if p_kind='product' then
  update public.yp_products set deleted_at=stamp,active=false,available=false,updated_at=stamp where id=p_id returning name into item_name;
  update public.yp_flavors set deleted_at=stamp,active=false,available=false,updated_at=stamp where product_id=p_id and deleted_at is null;
  get diagnostics deleted_count=row_count;
  delete from public.yp_customer_favorites where flavor_id in (select id from public.yp_flavors where product_id=p_id);
  update public.yp_upsell_rules set active=false where trigger_product_id=p_id or product_id=p_id;
  update public.yp_settings set upsell_enabled=false,upsell_product_id=null,upsell_flavor_id=null,upsell_price=null where upsell_product_id=p_id;
 else
  update public.yp_flavors set deleted_at=stamp,active=false,available=false,updated_at=stamp where id=p_id and product_id=parent_id and deleted_at is null returning name into item_name;
  if not found then return jsonb_build_object('deleted',false); end if;
  deleted_count=1;
  delete from public.yp_customer_favorites where flavor_id=p_id;
  update public.yp_upsell_rules set active=false where flavor_id=p_id;
  update public.yp_settings set upsell_enabled=false,upsell_product_id=null,upsell_flavor_id=null,upsell_price=null where upsell_flavor_id=p_id;
 end if;
 return jsonb_build_object('deleted',true,'name',item_name,'flavors_deleted',deleted_count);
end $$;
revoke all on function public.yp_guard_live_flavor() from public,anon,authenticated;
revoke all on function public.yp_delete_catalog_item(text,uuid,uuid) from public,anon,authenticated;
grant execute on function public.yp_delete_catalog_item(text,uuid,uuid) to service_role;

create or replace function public.yp_metrics(p_from timestamptz,p_to timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
with o as (select * from public.yp_orders where created_at>=p_from and created_at<p_to and not is_test),
e as (select * from public.yp_events where created_at>=p_from and created_at<p_to),
i as (select o.id,o.status,x.* from o cross join lateral jsonb_to_recordset(o.items) as x(product_id uuid,quantity integer,units integer,line_total integer,upsell boolean)),
stats as (select p.id,p.name||case when p.deleted_at is null then '' else ' (excluído)' end as name,p.deleted_at is not null as deleted,l.name as line,
(select count(*) from e where product_id=p.id and type='product_view') as views,
(select count(*) from e where product_id=p.id and type='product_click' and flavor_id is null) as clicks,
(select count(*) from e where product_id=p.id and type='add_to_cart') as adds,
(select count(distinct id) from i where product_id=p.id and status<>'cancelled') as orders,
coalesce((select sum(units) from i where product_id=p.id and status<>'cancelled'),0) as units,
coalesce((select sum(line_total) from i where product_id=p.id and status<>'cancelled'),0) as requested_value
from public.yp_products p join public.yp_lines l on l.id=p.line_id)
select jsonb_build_object(
'orders',(select count(*) from o),'requested_total',coalesce((select sum(total) from o where status<>'cancelled'),0),
'average_ticket',coalesce((select round(avg(total)) from o where status<>'cancelled'),0),
'confirmed_total',coalesce((select sum(total) from o where status in ('confirmed','fulfilled')),0),
'confirmed_orders',(select count(*) from o where status in ('confirmed','fulfilled')),
'cancelled_orders',(select count(*) from o where status='cancelled'),
'visitors',(select count(distinct session_id) from e where type='visit'),
'cart_sessions',(select count(distinct session_id) from e where type='add_to_cart'),
'checkout_sessions',(select count(distinct session_id) from e where type='checkout'),
'order_sessions',(select count(distinct session_id) from o),
'upsell_views',(select count(distinct session_id) from e where type='upsell_view'),
'upsell_orders',(select count(distinct id) from i where upsell and status<>'cancelled'),
'products',coalesce((select jsonb_agg(to_jsonb(stats) order by orders desc,clicks desc,name) from stats where not deleted or views>0 or clicks>0 or adds>0 or orders>0),'[]'::jsonb),
'daily',coalesce((select jsonb_agg(v order by day) from (select (created_at at time zone 'America/Sao_Paulo')::date as day,count(*) as orders,sum(total) as value from o where status<>'cancelled' group by 1) v),'[]'::jsonb)
); $$;

create or replace function public.yp_flavor_metrics(p_from timestamptz,p_to timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
with e as (select flavor_id,type from public.yp_events where created_at>=p_from and created_at<p_to and flavor_id is not null),
i as (select o.id,x.* from public.yp_orders o cross join lateral jsonb_to_recordset(o.items) x(flavor_id uuid,units integer,line_total integer) where o.created_at>=p_from and o.created_at<p_to and not o.is_test and o.status<>'cancelled'),
ev as (select flavor_id,count(*) filter(where type='product_click') as clicks,count(*) filter(where type='add_to_cart') as adds from e group by flavor_id),
oi as (select flavor_id,count(distinct id) as orders,sum(units) as units,sum(line_total) as requested_value from i where flavor_id is not null group by flavor_id),
stats as(select f.id,f.name||case when f.deleted_at is null and p.deleted_at is null then '' else ' (excluído)' end as name,(f.deleted_at is not null or p.deleted_at is not null) as deleted,p.name as line,0 as views,coalesce(ev.clicks,0) as clicks,coalesce(ev.adds,0) as adds,coalesce(oi.orders,0) as orders,coalesce(oi.units,0) as units,coalesce(oi.requested_value,0) as requested_value from public.yp_flavors f join public.yp_products p on p.id=f.product_id left join ev on ev.flavor_id=f.id left join oi on oi.flavor_id=f.id)
select coalesce(jsonb_agg(to_jsonb(stats) order by orders desc,clicks desc,name),'[]'::jsonb) from stats where not deleted or clicks>0 or adds>0 or orders>0; $$;
revoke all on function public.yp_flavor_metrics(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.yp_flavor_metrics(timestamptz,timestamptz) to service_role;

commit;
