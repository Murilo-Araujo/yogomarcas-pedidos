create or replace function public.yp_metrics(p_from timestamptz,p_to timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
with o as (select * from public.yp_orders where created_at>=p_from and created_at<p_to and not is_test),
e as (select * from public.yp_events where created_at>=p_from and created_at<p_to),
i as (select o.id,o.status,x.* from o cross join lateral jsonb_to_recordset(o.items) as x(product_id uuid,quantity integer,units integer,line_total integer,upsell boolean)),
stats as (select p.id,p.name,l.name as line,
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
'products',coalesce((select jsonb_agg(to_jsonb(stats) order by orders desc,clicks desc,name) from stats),'[]'::jsonb),
'daily',coalesce((select jsonb_agg(v order by day) from (select (created_at at time zone 'America/Sao_Paulo')::date as day,count(*) as orders,sum(total) as value from o where status<>'cancelled' group by 1) v),'[]'::jsonb)
); $$;
