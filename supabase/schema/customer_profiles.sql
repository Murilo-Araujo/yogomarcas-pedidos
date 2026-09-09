-- Durable self-declared shop profiles; phone alone never authorizes reading.
create table public.yp_customers (
 id uuid primary key default gen_random_uuid(), phone text not null unique check(phone ~ '^55[1-9][0-9]{9,10}$'),
 store_name text not null, contact_name text not null default '',
 portions jsonb not null default '[]'::jsonb check(jsonb_typeof(portions)='array'), preferred_portion_id text,
 pin_hash text not null, pin_salt text not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.yp_customer_devices (
 token_hash text primary key, customer_id uuid not null references public.yp_customers(id) on delete cascade,
 created_at timestamptz not null default now(), revoked_at timestamptz
);
create index yp_customer_devices_customer_idx on public.yp_customer_devices(customer_id);
alter table public.yp_customers enable row level security;
alter table public.yp_customer_devices enable row level security;
revoke all on public.yp_customers,public.yp_customer_devices from anon,authenticated;
grant all on public.yp_customers,public.yp_customer_devices to service_role;
alter table public.yp_products add column yield_grams integer check(yield_grams between 1 and 100000), add column yield_min_grams integer check(yield_min_grams between 1 and 100000), add constraint yp_product_yield_range check ((yield_grams is null and yield_min_grams is null) or (yield_grams is not null and yield_min_grams is not null and yield_min_grams<=yield_grams));
-- User-specified baseline: 6 kg/packet; supplied 55–60 servings at 100 g.
update public.yp_products set yield_grams=6000,yield_min_grams=5500 where sku in ('BAU','CHO','GRE','NEU');
alter table public.yp_orders add column customer_id uuid references public.yp_customers(id), add column projection_snapshot jsonb;
create index yp_orders_customer_idx on public.yp_orders(customer_id);
create function public.yp_register_customer(p_id uuid,p_phone text,p_store text,p_contact text,p_portions jsonb,p_preferred text,p_pin_hash text,p_salt text,p_token_hash text) returns void language plpgsql security invoker set search_path='' as $$
begin
 insert into public.yp_customers(id,phone,store_name,contact_name,portions,preferred_portion_id,pin_hash,pin_salt) values(p_id,p_phone,p_store,p_contact,p_portions,p_preferred,p_pin_hash,p_salt);
 insert into public.yp_customer_devices(token_hash,customer_id) values(p_token_hash,p_id);
end $$;
create function public.yp_customer_directory(p_search text,p_page integer) returns jsonb language sql stable security invoker set search_path='' as $$
with matched as (select id,phone,store_name,contact_name,portions,preferred_portion_id,created_at,updated_at from public.yp_customers where p_search='' or store_name ilike '%'||p_search||'%' or phone like '%'||p_search||'%'),
page_rows as(select * from matched order by updated_at desc,id limit 51 offset greatest(p_page,0)*50),
prices as(select x.name,x.grams,x.price from public.yp_customers c cross join lateral jsonb_to_recordset(c.portions) as x(name text,grams integer,price integer)),
summary as(select name,grams,count(*) as shops,round(avg(price)) as average_price,min(price) as minimum_price,max(price) as maximum_price from prices group by name,grams)
select jsonb_build_object('customers',coalesce((select jsonb_agg(to_jsonb(page_rows)) from page_rows),'[]'::jsonb),'matched_count',(select count(*) from matched),'total_count',(select count(*) from public.yp_customers),'price_summary',coalesce((select jsonb_agg(to_jsonb(summary) order by shops desc,name,grams) from summary),'[]'::jsonb)); $$;
revoke all on function public.yp_register_customer(uuid,text,text,text,jsonb,text,text,text,text),public.yp_customer_directory(text,integer) from public,anon,authenticated;
grant execute on function public.yp_register_customer(uuid,text,text,text,jsonb,text,text,text,text),public.yp_customer_directory(text,integer) to service_role;
-- Reset only through authenticated administration; invalidate remembered devices atomically.
create function public.yp_reset_customer_pin(p_customer uuid,p_hash text,p_salt text) returns void language plpgsql security invoker set search_path='' as $$
begin
 update public.yp_customers set pin_hash=p_hash,pin_salt=p_salt,updated_at=now() where id=p_customer;
 update public.yp_customer_devices set revoked_at=now() where customer_id=p_customer and revoked_at is null;
end $$;
revoke all on function public.yp_reset_customer_pin(uuid,text,text) from public,anon,authenticated;
grant execute on function public.yp_reset_customer_pin(uuid,text,text) to service_role;
