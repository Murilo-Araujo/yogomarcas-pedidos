-- Normalized flavors under each product family; trusted Edge API handles access.
alter table public.yp_products add column if not exists has_flavors boolean not null default false;
alter table public.yp_products add column if not exists package_weight_grams integer check(package_weight_grams between 1 and 100000);
create table if not exists public.yp_flavors (
 id uuid primary key default gen_random_uuid(),
 product_id uuid not null references public.yp_products(id),
 name text not null check(length(name) between 1 and 120),
 package_weight_grams integer check(package_weight_grams between 1 and 100000),
 package_price integer check(package_price between 1 and 100000000),
 bundle_price integer check(bundle_price between 1 and 100000000),
 active boolean not null default true, available boolean not null default true,
 position integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(product_id,name),unique(id,product_id)
);
alter table public.yp_flavors enable row level security;
revoke all on public.yp_flavors from public,anon,authenticated;
grant all on public.yp_flavors to service_role;
alter table public.yp_settings add column if not exists upsell_flavor_id uuid references public.yp_flavors(id);
alter table public.yp_events add column if not exists flavor_id uuid;
alter table public.yp_events add constraint yp_event_flavor_product_fk foreign key(flavor_id,product_id) references public.yp_flavors(id,product_id);
create index if not exists yp_settings_flavor_idx on public.yp_settings(upsell_flavor_id);
create index if not exists yp_events_flavor_product_idx on public.yp_events(flavor_id,product_id);
create or replace function public.yp_flavor_metrics(p_from timestamptz,p_to timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
with e as (select flavor_id,type from public.yp_events where created_at>=p_from and created_at<p_to and flavor_id is not null),
i as (select o.id,x.* from public.yp_orders o cross join lateral jsonb_to_recordset(o.items) x(flavor_id uuid,units integer,line_total integer) where o.created_at>=p_from and o.created_at<p_to and not o.is_test and o.status<>'cancelled'),
ev as (select flavor_id,count(*) filter(where type='product_click') as clicks,count(*) filter(where type='add_to_cart') as adds from e group by flavor_id),
oi as (select flavor_id,count(distinct id) as orders,sum(units) as units,sum(line_total) as requested_value from i where flavor_id is not null group by flavor_id),
stats as(select f.id,f.name,p.name as line,0 as views,coalesce(ev.clicks,0) as clicks,coalesce(ev.adds,0) as adds,coalesce(oi.orders,0) as orders,coalesce(oi.units,0) as units,coalesce(oi.requested_value,0) as requested_value from public.yp_flavors f join public.yp_products p on p.id=f.product_id left join ev on ev.flavor_id=f.id left join oi on oi.flavor_id=f.id)
select coalesce(jsonb_agg(to_jsonb(stats) order by orders desc,clicks desc,name),'[]'::jsonb) from stats; $$;
revoke all on function public.yp_flavor_metrics(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.yp_flavor_metrics(timestamptz,timestamptz) to service_role;
