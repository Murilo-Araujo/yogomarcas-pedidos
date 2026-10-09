-- Existing preparations are backfilled below; prices and commercial settings are untouched.
alter table public.yp_products add column preparation jsonb;
alter table public.yp_products add column additional_info jsonb not null default '[]'::jsonb;
alter table public.yp_products add constraint yp_preparation_object check (preparation is null or jsonb_typeof(preparation)='object');
alter table public.yp_products add constraint yp_information_array check (jsonb_typeof(additional_info)='array' and jsonb_array_length(additional_info)<=12);

update public.yp_products set preparation=jsonb_build_object(
  'title','Modo de preparo','waterLitres',case when sku='YOGO-FY' then 3 else 4 end,'minutes',2,
  'steps',jsonb_build_array('Misture o conteúdo de 1 pacote com '||(case when sku='YOGO-FY' then 3 else 4 end)||' litros de água.',
  'Bata a mistura por 2 minutos.','Utilize a calda na máquina, seguindo as orientações do fabricante para operação e incorporação de ar.'))
where sku in ('YOGO-EI','YOGO-FY','YOGO-IG');
update public.yp_products set preparation='{"title":"Como usar com a base neutra","steps":["Prepare a base neutra Saborize: misture 1 pacote de base com 4 litros de água e bata por 2 minutos.","Adicione o saborizante à calda. A referência do catálogo é 1 colher de chá para cada 300 ml de calda.","Misture e ajuste a dosagem conforme o sabor e o resultado desejado."],"note":"A base neutra é vendida separadamente. O saborizante é utilizado na calda já preparada."}'::jsonb where sku='YOGO-SAB';
update public.yp_products set preparation='{"title":"Preparo da base neutra","waterLitres":4,"minutes":2,"steps":["Misture o conteúdo de 1 pacote de base neutra com 4 litros de água.","Bata a mistura por 2 minutos.","Combine a calda com os saborizantes Saborize. Use como referência 1 colher de chá de saborizante para cada 300 ml de calda, ajustando a dosagem conforme o resultado desejado."],"note":"Os saborizantes são vendidos separadamente. Opere a máquina conforme as orientações do fabricante."}'::jsonb where sku='YOGO-SAB-BASE';

create table public.yp_catalog_highlights (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null unique references public.yp_products(id),
  title text not null default '' check(length(title)<=120),
  description text not null default '' check(length(description)<=400),
  starts_at timestamptz not null default now(),
  expires_at timestamptz not null,
  active boolean not null default true,
  check (expires_at>starts_at)
);
create index yp_highlights_expiry_idx on public.yp_catalog_highlights(expires_at) where active;
alter table public.yp_catalog_highlights enable row level security;
revoke all on public.yp_catalog_highlights from public,anon,authenticated;
grant select,insert,update,delete on public.yp_catalog_highlights to service_role;

create function public.yp_save_highlight(p_product uuid,p_title text,p_description text,p_duration integer,p_unit text)
returns public.yp_catalog_highlights language plpgsql security invoker set search_path='' as $$
declare saved public.yp_catalog_highlights; finish timestamptz;
begin
  if p_duration is null or p_duration<1 or p_unit is null or p_unit not in ('days','months') or
    (p_unit='days' and p_duration>365) or (p_unit='months' and p_duration>24) then raise exception 'invalid highlight duration'; end if;
  if not exists(select 1 from public.yp_products p join public.yp_lines l on l.id=p.line_id where p.id=p_product and p.deleted_at is null and p.active and l.active) then raise exception 'product unavailable'; end if;
  finish=((now() at time zone 'America/Sao_Paulo')+case when p_unit='months' then make_interval(months=>p_duration) else make_interval(days=>p_duration) end) at time zone 'America/Sao_Paulo';
  insert into public.yp_catalog_highlights(product_id,title,description,starts_at,expires_at,active)
  values(p_product,p_title,p_description,now(),finish,true)
  on conflict(product_id) do update set title=excluded.title,description=excluded.description,starts_at=excluded.starts_at,expires_at=excluded.expires_at,active=true
  returning * into saved;
  return saved;
end $$;
revoke all on function public.yp_save_highlight(uuid,text,text,integer,text) from public,anon,authenticated;
grant execute on function public.yp_save_highlight(uuid,text,text,integer,text) to service_role;

create table public.yp_price_adjustments (
  id uuid primary key,
  basis_points integer not null check(basis_points between 1 and 10000),
  product_ids uuid[],
  scheduled_at timestamptz not null,
  status text not null default 'pending' check(status in ('pending','applied','cancelled','failed')),
  created_by uuid not null references public.yp_admins(user_id),
  created_at timestamptz not null default now(),
  applied_at timestamptz,
  changes jsonb not null default '[]'::jsonb,
  error text,
  check(product_ids is null or cardinality(product_ids) between 1 and 1000)
);
create index yp_price_adjustments_due_idx on public.yp_price_adjustments(scheduled_at,created_at) where status='pending';
create index yp_price_adjustments_creator_idx on public.yp_price_adjustments(created_by);
alter table public.yp_price_adjustments enable row level security;
revoke all on public.yp_price_adjustments from public,anon,authenticated;
grant select,insert,update on public.yp_price_adjustments to service_role;

-- All amounts are integer cents. The same formula drives preview and execution.
create function public.yp_price_targets(p_ids uuid[],p_bps integer)
returns table(kind text,id uuid,product_id uuid,name text,before_price integer,after_price integer)
language sql stable security invoker set search_path='' as $$
  select 'product',p.id,p.id,p.name,p.package_price,(ceil(p.package_price::numeric*(10000+p_bps)/50000)*5)::integer
  from public.yp_products p where p.deleted_at is null and not p.has_flavors and p.package_price>0 and (p_ids is null or p.id=any(p_ids))
  union all
  select 'flavor',f.id,p.id,p.name||' · '||f.name,f.package_price,(ceil(f.package_price::numeric*(10000+p_bps)/50000)*5)::integer
  from public.yp_flavors f join public.yp_products p on p.id=f.product_id
  where p.deleted_at is null and p.has_flavors and f.deleted_at is null and f.package_price>0 and (p_ids is null or p.id=any(p_ids));
$$;
revoke all on function public.yp_price_targets(uuid[],integer) from public,anon,authenticated;
grant execute on function public.yp_price_targets(uuid[],integer) to service_role;

create function public.yp_preview_price_adjustment(p_ids uuid[],p_bps integer)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare items jsonb;
begin
  if p_bps is null or p_bps<1 or p_bps>10000 or (p_ids is not null and (cardinality(p_ids)<1 or cardinality(p_ids)>1000)) then raise exception 'invalid adjustment'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('kind',kind,'id',id,'product_id',product_id,'name',name,'before',before_price,'after',after_price) order by name,kind,id),'[]'::jsonb) into items from public.yp_price_targets(p_ids,p_bps);
  if exists(select 1 from public.yp_price_targets(p_ids,p_bps) where after_price>20000000) then raise exception 'price limit exceeded'; end if;
  return jsonb_build_object('changes',items,'fingerprint',md5(items::text));
end $$;
revoke all on function public.yp_preview_price_adjustment(uuid[],integer) from public,anon,authenticated;
grant execute on function public.yp_preview_price_adjustment(uuid[],integer) to service_role;

create function public.yp_apply_price_adjustment(p_id uuid,p_fingerprint text default null)
returns public.yp_price_adjustments language plpgsql security invoker set search_path='' as $$
declare job public.yp_price_adjustments; preview jsonb;
begin
  perform pg_advisory_xact_lock(89091234);
  select * into job from public.yp_price_adjustments where id=p_id for update;
  if job.id is null then raise exception 'adjustment not found'; end if;
  if job.status<>'pending' or job.scheduled_at>now() then return job; end if;
  -- Serialize with manual product/flavor edits so the audit matches the prices written.
  lock table public.yp_products,public.yp_flavors in share row exclusive mode;
  preview=public.yp_preview_price_adjustment(job.product_ids,job.basis_points);
  if p_fingerprint is not null and p_fingerprint<>preview->>'fingerprint' then raise exception 'Prices changed. Refresh preview.' using errcode='P0002'; end if;
  if jsonb_array_length(preview->'changes')=0 then raise exception 'no priced products'; end if;
  update public.yp_products p set package_price=(item->>'after')::integer,updated_at=now()
    from jsonb_array_elements(preview->'changes') item where item->>'kind'='product' and p.id=(item->>'id')::uuid;
  update public.yp_flavors f set package_price=(item->>'after')::integer,updated_at=now()
    from jsonb_array_elements(preview->'changes') item where item->>'kind'='flavor' and f.id=(item->>'id')::uuid;
  -- Existing bundle triggers derive package_price * 5 in this same transaction.
  update public.yp_price_adjustments set status='applied',applied_at=now(),changes=preview->'changes',error=null where id=p_id returning * into job;
  return job;
end $$;
revoke all on function public.yp_apply_price_adjustment(uuid,text) from public,anon,authenticated;
grant execute on function public.yp_apply_price_adjustment(uuid,text) to service_role;

create function public.yp_create_price_adjustment(p_id uuid,p_bps integer,p_ids uuid[],p_scheduled_at timestamptz,p_actor uuid,p_fingerprint text)
returns public.yp_price_adjustments language plpgsql security invoker set search_path='' as $$
declare job public.yp_price_adjustments; preview jsonb;
begin
  perform pg_advisory_xact_lock(89091234);
  select * into job from public.yp_price_adjustments where id=p_id;
  if job.id is not null then
    if job.created_by<>p_actor or job.basis_points<>p_bps or job.product_ids is distinct from p_ids then raise exception 'request conflict'; end if;
    return job;
  end if;
  if not exists(select 1 from public.yp_admins where user_id=p_actor and active and not must_change_password) then raise exception 'inactive administrator'; end if;
  if p_ids is not null and (array_position(p_ids,null) is not null or exists(select 1 from unnest(p_ids) x where not exists(select 1 from public.yp_products p where p.id=x and p.deleted_at is null))) then raise exception 'invalid products'; end if;
  if p_scheduled_at is not null and (p_scheduled_at<=now() or p_scheduled_at>now()+interval '2 years') then raise exception 'invalid schedule'; end if;
  preview=public.yp_preview_price_adjustment(p_ids,p_bps);
  if jsonb_array_length(preview->'changes')=0 then raise exception 'no priced products'; end if;
  if p_fingerprint is null or p_fingerprint<>preview->>'fingerprint' then raise exception 'Prices changed. Refresh preview.' using errcode='P0002'; end if;
  insert into public.yp_price_adjustments(id,basis_points,product_ids,scheduled_at,created_by) values(p_id,p_bps,p_ids,coalesce(p_scheduled_at,now()),p_actor) returning * into job;
  if p_scheduled_at is null then return public.yp_apply_price_adjustment(p_id,p_fingerprint); end if;
  return job;
end $$;
revoke all on function public.yp_create_price_adjustment(uuid,integer,uuid[],timestamptz,uuid,text) from public,anon,authenticated;
grant execute on function public.yp_create_price_adjustment(uuid,integer,uuid[],timestamptz,uuid,text) to service_role;

create function public.yp_cancel_price_adjustment(p_id uuid)
returns boolean language plpgsql security invoker set search_path='' as $$
begin
  perform pg_advisory_xact_lock(89091234);
  update public.yp_price_adjustments set status='cancelled' where id=p_id and status='pending';
  return found;
end $$;
revoke all on function public.yp_cancel_price_adjustment(uuid) from public,anon,authenticated;
grant execute on function public.yp_cancel_price_adjustment(uuid) to service_role;

create function public.yp_run_due_price_adjustments()
returns integer language plpgsql security invoker set search_path='' as $$
declare job record; processed integer=0;
begin
  if not pg_try_advisory_xact_lock(89091234) then return 0; end if;
  for job in select id from public.yp_price_adjustments where status='pending' and scheduled_at<=now() order by scheduled_at,created_at,id limit 100 for update loop
    begin
      perform public.yp_apply_price_adjustment(job.id,null);
      processed=processed+1;
    exception when others then
      update public.yp_price_adjustments set status='failed',error='Não foi possível aplicar. Confira os produtos e seus preços e crie um novo reajuste.' where id=job.id;
    end;
  end loop;
  return processed;
end $$;
revoke all on function public.yp_run_due_price_adjustments() from public,anon,authenticated;
grant execute on function public.yp_run_due_price_adjustments() to service_role;

create extension if not exists pg_cron;
select cron.schedule('yp-price-adjustments','* * * * *','select public.yp_run_due_price_adjustments()');
