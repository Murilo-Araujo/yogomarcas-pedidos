-- Isolated portal tables. Existing landing-page tables are untouched.
create table public.yp_lines (
 id uuid primary key default gen_random_uuid(), name text not null unique,
 description text not null default '', position integer not null default 0, active boolean not null default true
);
create table public.yp_products (
 id uuid primary key default gen_random_uuid(), line_id uuid not null references public.yp_lines(id),
 name text not null, sku text not null unique, description text not null default '', image_url text not null default '',
 package_label text not null default 'Pacote', package_price integer check(package_price between 1 and 100000000),
 bundle_units integer check(bundle_units between 2 and 1000), bundle_price integer check(bundle_price between 1 and 100000000),
 active boolean not null default true, available boolean not null default true, position integer not null default 0,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 constraint yp_bundle_valid check(bundle_price is null or bundle_units is not null)
);
create table public.yp_settings (
 id integer primary key default 1 check(id=1), whatsapp text not null default '554532541200',
 minimum_order integer not null default 0 check(minimum_order>=0),
 notice text not null default 'Frete, prazo e pagamento serão confirmados pelo WhatsApp.',
 upsell_enabled boolean not null default false, upsell_product_id uuid references public.yp_products(id),
 upsell_title text not null default 'Complete seu pedido', upsell_description text not null default '',
 upsell_price integer check(upsell_price between 1 and 100000000),
 ordering_enabled boolean not null default false
);
create table public.yp_admins (
 user_id uuid primary key references auth.users(id) on delete cascade,
 email text not null unique, role text not null default 'admin' check(role in ('owner','admin')),
 created_at timestamptz not null default now()
);
create table public.yp_setup (
 id integer primary key check(id=1), token_hash text not null,
 expires_at timestamptz not null, used_at timestamptz
);
create table public.yp_orders (
 id uuid primary key, public_number text not null unique,
 client_token_hash text not null, session_id uuid not null,
 customer_name text not null, company text not null, phone text not null,
 city text not null, state text not null, customer_code text not null default '', notes text not null default '',
 items jsonb not null check(jsonb_typeof(items)='array'), total integer not null check(total>0),
 status text not null default 'prepared' check(status in ('prepared','contacted','confirmed','fulfilled','cancelled')),
 status_note text not null default '', is_test boolean not null default false,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now()
);
create table public.yp_events (
 id uuid primary key, session_id uuid not null, type text not null check(type in ('visit','product_view','product_click','add_to_cart','checkout','upsell_view','upsell_add')),
 product_id uuid references public.yp_products(id), created_at timestamptz not null default now()
);
create table public.yp_rate_limits (key text primary key, hits integer not null default 1, expires_at timestamptz not null);
create index yp_products_line_idx on public.yp_products(line_id);
create index yp_settings_upsell_idx on public.yp_settings(upsell_product_id);
create index yp_orders_date_idx on public.yp_orders(created_at desc);
create index yp_orders_session_idx on public.yp_orders(session_id);
create index yp_events_date_type_idx on public.yp_events(created_at,type);
create index yp_events_product_idx on public.yp_events(product_id);
create index yp_rate_expiry_idx on public.yp_rate_limits(expires_at);
-- No client role can read or mutate portal rows. The Edge Function authorizes each operation.
do $$ declare t text; begin foreach t in array array['yp_lines','yp_products','yp_settings','yp_admins','yp_setup','yp_orders','yp_events','yp_rate_limits'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon, authenticated',t);
 execute format('grant all on public.%I to service_role',t);
end loop; end $$;
create function public.yp_check_rate(p_key text,p_limit integer,p_expiry timestamptz) returns boolean language plpgsql security invoker set search_path='' as $$
declare n integer; begin
 insert into public.yp_rate_limits(key,hits,expires_at) values(p_key,1,p_expiry)
 on conflict(key) do update set hits=public.yp_rate_limits.hits+1 returning hits into n;
 if random()<0.01 then delete from public.yp_rate_limits where expires_at<now(); end if;
 return n<=p_limit; end $$;
create function public.yp_claim_owner(p_hash text,p_user uuid,p_email text) returns boolean language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.yp_setup where id=1 and token_hash=p_hash and used_at is null and expires_at>now() for update;
 if not found or exists(select 1 from public.yp_admins) then return false; end if;
 insert into public.yp_admins(user_id,email,role) values(p_user,p_email,'owner');
 update public.yp_setup set used_at=now() where id=1; return true;
end $$;
create function public.yp_metrics(p_from timestamptz,p_to timestamptz) returns jsonb language sql stable security invoker set search_path='' as $$
with o as (select * from public.yp_orders where created_at>=p_from and created_at<p_to and not is_test),
e as (select * from public.yp_events where created_at>=p_from and created_at<p_to),
i as (select o.id,o.status,x.* from o cross join lateral jsonb_to_recordset(o.items) as x(product_id uuid,quantity integer,units integer,line_total integer,upsell boolean)),
stats as (select p.id,p.name,l.name as line,
(select count(*) from e where product_id=p.id and type='product_view') as views,
(select count(*) from e where product_id=p.id and type='product_click') as clicks,
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
revoke all on function public.yp_check_rate(text,integer,timestamptz) from public,anon,authenticated;
revoke all on function public.yp_claim_owner(text,uuid,text) from public,anon,authenticated;
revoke all on function public.yp_metrics(timestamptz,timestamptz) from public,anon,authenticated;
grant execute on function public.yp_check_rate(text,integer,timestamptz),public.yp_claim_owner(text,uuid,text),public.yp_metrics(timestamptz,timestamptz) to service_role;
insert into public.yp_settings(id) values(1);
insert into public.yp_lines(name,description,position) values
('Sorvete soft','Mixes em pó para sua operação soft.',0),('Iogurte grego','Mix para frozen yogurt.',1),('Apoio à operação','Cuidados com a máquina.',2);
insert into public.yp_products(line_id,name,sku,description,position)
select id,'Baunilha','BAU','Mix base em pó para sorvete soft de baunilha.',0 from public.yp_lines where name='Sorvete soft'
union all select id,'Chocolate','CHO','Mix base em pó para sorvete soft de chocolate.',1 from public.yp_lines where name='Sorvete soft'
union all select id,'Base Neutra','NEU','Base para combinar com aromas e saborizantes.',2 from public.yp_lines where name='Sorvete soft'
union all select id,'Iogurte Grego','GRE','Mix base em pó para frozen yogurt.',3 from public.yp_lines where name='Iogurte grego'
union all select id,'Lubrificante alimentício','LUB','Linha de apoio à operação da máquina de sorvete.',4 from public.yp_lines where name='Apoio à operação';
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('yp-products','yp-products',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
-- Follow-up migration: allow the owner to restore a previously removed account.
create function public.yp_find_auth_user(p_email text) returns uuid language sql stable security invoker set search_path='' as $$ select id from auth.users where lower(email)=lower(p_email) limit 1; $$;
revoke all on function public.yp_find_auth_user(text) from public,anon,authenticated;
grant execute on function public.yp_find_auth_user(text) to service_role;
