-- Customer shopping preferences and commercial follow-up. Edge-only access.
begin;
create table if not exists public.yp_customer_favorites (
 customer_id uuid not null references public.yp_customers(id) on delete cascade,
 flavor_id uuid not null references public.yp_flavors(id) on delete cascade,
 created_at timestamptz not null default now(), primary key(customer_id,flavor_id)
);
create index if not exists yp_customer_favorites_flavor_idx on public.yp_customer_favorites(flavor_id);
create table if not exists public.yp_customer_carts (
 customer_id uuid primary key references public.yp_customers(id) on delete cascade,
 revision bigint not null default 0 check(revision>=0),
 items jsonb not null default '[]'::jsonb check(jsonb_typeof(items)='array' and jsonb_array_length(items)<=200),
 total bigint not null default 0 check(total between 0 and 100000000),
 status text not null default 'empty' check(status in ('active','empty','prepared')),
 updated_at timestamptz not null default now(), dismissed_revision bigint
);
create index if not exists yp_customer_carts_pending_idx on public.yp_customer_carts(updated_at) where status='active';
create table if not exists public.yp_customer_followups (
 customer_id uuid primary key references public.yp_customers(id) on delete cascade,
 cycle_days integer check(cycle_days between 1 and 365), snoozed_until timestamptz
);
create table if not exists public.yp_upsell_rules (
 id uuid primary key default gen_random_uuid(),
 trigger_product_id uuid not null references public.yp_products(id),
 product_id uuid not null references public.yp_products(id),
 flavor_id uuid references public.yp_flavors(id),
 title text not null default 'Complete seu pedido', description text not null default '',
 price integer check(price>0), priority integer not null default 0 check(priority between 0 and 999),
 active boolean not null default true, check(trigger_product_id<>product_id)
);
create index if not exists yp_upsell_rules_trigger_idx on public.yp_upsell_rules(trigger_product_id);
create index if not exists yp_upsell_rules_product_idx on public.yp_upsell_rules(product_id);
create index if not exists yp_upsell_rules_flavor_idx on public.yp_upsell_rules(flavor_id);
alter table public.yp_settings add column if not exists contextual_upsell_enabled boolean not null default true;
alter table public.yp_orders add column if not exists purchased_at timestamptz;
alter table public.yp_orders add column if not exists cart_revision bigint check(cart_revision>=0);
update public.yp_orders set purchased_at=created_at where status in ('confirmed','fulfilled') and purchased_at is null;
create index if not exists yp_orders_customer_purchase_idx on public.yp_orders(customer_id,purchased_at desc) where status in ('confirmed','fulfilled') and is_test=false;
create index if not exists yp_orders_customer_history_idx on public.yp_orders(customer_id,created_at desc,id desc) where is_test=false;
alter table public.yp_customer_favorites enable row level security;
alter table public.yp_customer_carts enable row level security;
alter table public.yp_customer_followups enable row level security;
alter table public.yp_upsell_rules enable row level security;
revoke all on public.yp_customer_favorites,public.yp_customer_carts,public.yp_customer_followups,public.yp_upsell_rules from public,anon,authenticated;
grant all on public.yp_customer_favorites,public.yp_customer_carts,public.yp_customer_followups,public.yp_upsell_rules to service_role;

create or replace function public.yp_save_customer_cart(p_customer uuid,p_revision bigint,p_items jsonb,p_total bigint) returns jsonb language plpgsql security invoker set search_path='' as $$
declare c public.yp_customer_carts;
begin
 insert into public.yp_customer_carts(customer_id) values(p_customer) on conflict do nothing;
 select * into c from public.yp_customer_carts where customer_id=p_customer for update;
 if c.revision<>p_revision then return jsonb_build_object('saved',false,'cart',to_jsonb(c)); end if;
 if c.items=p_items and c.total=p_total and c.status<>'prepared' then return jsonb_build_object('saved',true,'cart',to_jsonb(c)); end if;
 update public.yp_customer_carts set items=p_items,total=p_total,status=case when jsonb_array_length(p_items)=0 then 'empty' else 'active' end,revision=revision+1,updated_at=now(),dismissed_revision=null where customer_id=p_customer returning * into c;
 return jsonb_build_object('saved',true,'cart',to_jsonb(c));
end $$;
-- Serialize checkout with concurrent draft changes; reject stale snapshots.
create or replace function public.yp_validate_order_cart() returns trigger language plpgsql security invoker set search_path='' as $$
declare v bigint;
begin
 if new.customer_id is not null and new.cart_revision is not null and not new.is_test then
  insert into public.yp_customer_carts(customer_id) values(new.customer_id) on conflict do nothing;
  select revision into v from public.yp_customer_carts where customer_id=new.customer_id for update;
  if v<>new.cart_revision then raise exception using errcode='40001',message='cart_changed'; end if;
 end if;
 return new;
end $$;
drop trigger if exists yp_validate_order_cart on public.yp_orders;
create trigger yp_validate_order_cart before insert on public.yp_orders for each row execute function public.yp_validate_order_cart();
-- A checkout closes the draft atomically, including late requests from another tab.
create or replace function public.yp_close_prepared_cart() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.customer_id is not null and not new.is_test and new.cart_revision is not null then
  insert into public.yp_customer_carts(customer_id,revision,items,total,status) values(new.customer_id,1,new.items,new.total,'prepared')
  on conflict(customer_id) do update set revision=public.yp_customer_carts.revision+1,items=excluded.items,total=excluded.total,status='prepared',updated_at=now(),dismissed_revision=null;
 end if;
 return new;
end $$;
drop trigger if exists yp_close_prepared_cart on public.yp_orders;
create trigger yp_close_prepared_cart after insert on public.yp_orders for each row execute function public.yp_close_prepared_cart();
create or replace function public.yp_purchase_timestamp() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if new.status in ('confirmed','fulfilled') and new.purchased_at is null then new.purchased_at=now(); end if;
 return new;
end $$;
drop trigger if exists yp_purchase_timestamp on public.yp_orders;
create trigger yp_purchase_timestamp before insert or update on public.yp_orders for each row execute function public.yp_purchase_timestamp();

create or replace function public.yp_retention_queue(p_kind text,p_page integer,p_search text) returns jsonb language sql stable security invoker set search_path='' as $$
with purchase_days as (
 select customer_id,(purchased_at at time zone 'America/Sao_Paulo')::date as day,max(purchased_at) as purchased_at
 from public.yp_orders where is_test=false and status in ('confirmed','fulfilled') and customer_id is not null and purchased_at is not null group by customer_id,day
), recent as (
 select *,row_number() over(partition by customer_id order by day desc) as rn from purchase_days
), gaps as (
 select *,day-lag(day) over(partition by customer_id order by day) as gap from recent where rn<=6
), history as (
 select customer_id,max(purchased_at) as last_purchase,count(*) as purchases,
 case when count(*)>=3 then round((percentile_cont(0.5) within group(order by gap) filter(where gap>0))::numeric)::integer end as inferred_days
 from gaps group by customer_id
), shops as (
 select c.id as customer_id,c.store_name,c.phone,c.contact_name,f.cycle_days as manual_days,
 coalesce(f.cycle_days,h.inferred_days) as cycle_days,h.last_purchase,coalesce(h.purchases,0) as observed_purchase_days,
 case when f.cycle_days is not null then 'manual' when h.inferred_days is not null then 'history' else 'unknown' end as cycle_source,
 h.last_purchase+make_interval(days=>coalesce(f.cycle_days,h.inferred_days,0)) as due_at,f.snoozed_until
 from public.yp_customers c left join history h on h.customer_id=c.id left join public.yp_customer_followups f on f.customer_id=c.id
 where p_search='' or c.store_name ilike '%'||p_search||'%' or c.phone like '%'||p_search||'%'
), matched as (
 select to_jsonb(s)||jsonb_build_object('days_overdue',greatest(0,floor(extract(epoch from now()-s.due_at)/86400))) as row,s.due_at as sort_at
 from shops s where p_kind='reorder' and s.last_purchase is not null and s.cycle_days is not null and s.due_at<=now() and (s.snoozed_until is null or s.snoozed_until<=now())
 and not exists(select 1 from public.yp_orders o where o.customer_id=s.customer_id and o.is_test=false and o.status in ('prepared','contacted') and o.created_at>s.last_purchase and o.created_at>now()-interval '7 days')
 union all
 select to_jsonb(s)||jsonb_build_object('revision',c.revision,'items',c.items,'total',c.total,'updated_at',c.updated_at),c.updated_at
 from public.yp_customer_carts c join shops s on s.customer_id=c.customer_id where p_kind='carts' and c.status='active' and jsonb_array_length(c.items)>0 and c.updated_at<=now()-interval '2 hours' and c.dismissed_revision is distinct from c.revision
 and not exists(select 1 from public.yp_orders o where o.customer_id=c.customer_id and not o.is_test and o.cart_revision is null and o.created_at>=c.updated_at and o.status in ('prepared','contacted','confirmed','fulfilled'))
 union all
 select to_jsonb(s),s.last_purchase from shops s where p_kind='frequency'
), page_rows as (select row,sort_at from matched order by sort_at nulls last,row->>'customer_id' limit 51 offset greatest(p_page,0)*50)
select jsonb_build_object('rows',coalesce((select jsonb_agg(row order by sort_at nulls last,row->>'customer_id') from page_rows),'[]'::jsonb),'total',(select count(*) from matched));
$$;
revoke all on function public.yp_save_customer_cart(uuid,bigint,jsonb,bigint),public.yp_validate_order_cart(),public.yp_close_prepared_cart(),public.yp_purchase_timestamp(),public.yp_retention_queue(text,integer,text) from public,anon,authenticated;
grant execute on function public.yp_save_customer_cart(uuid,bigint,jsonb,bigint),public.yp_validate_order_cart(),public.yp_close_prepared_cart(),public.yp_purchase_timestamp(),public.yp_retention_queue(text,integer,text) to service_role;
-- Seed only the known compatible pairing; no discount or invented price.
insert into public.yp_upsell_rules(trigger_product_id,product_id,title,description,priority)
select a.id,b.id,'Já tem a base para preparar?','Adicione a Base Neutra Saborize se precisar repor.',0
from public.yp_products a cross join public.yp_products b where a.sku='YOGO-SAB' and b.sku='YOGO-SAB-BASE'
and not exists(select 1 from public.yp_upsell_rules r where r.trigger_product_id=a.id and r.product_id=b.id);
commit;
