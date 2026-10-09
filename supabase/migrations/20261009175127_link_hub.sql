-- An editable public link page, isolated from customer and order data.
create table public.yp_link_hub (
  id smallint primary key check (id = 1),
  config jsonb not null check (jsonb_typeof(config) = 'object' and jsonb_typeof(config->'links') = 'array' and jsonb_array_length(config->'links') <= 50),
  version integer not null default 1 check (version > 0),
  updated_at timestamptz not null default now(),
  updated_by uuid
);
create table public.yp_link_hub_daily (
  event_day date not null,
  event_key text not null check (event_key = 'page' or event_key ~ '^[0-9a-f-]{36}$'),
  events bigint not null default 1 check (events > 0),
  primary key (event_day, event_key)
);
alter table public.yp_link_hub enable row level security;
alter table public.yp_link_hub_daily enable row level security;
revoke all on public.yp_link_hub, public.yp_link_hub_daily from public, anon, authenticated;
grant select, insert, update, delete on public.yp_link_hub, public.yp_link_hub_daily to service_role;

with initial_links as (
  select jsonb_agg(jsonb_build_object(
    'id', gen_random_uuid(), 'subtitle', '', 'image_url', '', 'badge', '',
    'style', 'card', 'enabled', true, 'starts_at', null, 'ends_at', null
  ) || item order by position) as links
  from jsonb_array_elements('[
    {"title":"Conheça nossos produtos","subtitle":"Linhas, sabores e possibilidades para o seu negócio.","url":"https://pedidos.yogomarcas.com.br/catalogo","icon":"catalog","style":"featured","badge":"Explore o catálogo","image_url":"/assets/catalog-expresso-italiano-v1.webp"},
    {"title":"Fale com a nossa equipe","subtitle":"Vamos encontrar a melhor base para o seu negócio?","url":"https://wa.me/5545991034053","icon":"whatsapp"},
    {"title":"Faça seu pedido","subtitle":"Escolha seus produtos e continue pelo WhatsApp.","url":"https://pedidos.yogomarcas.com.br/","icon":"shopping"},
    {"title":"Conheça o kit de teste","subtitle":"Descubra como experimentar os produtos Yogo.","url":"https://www.yogomarcas.com.br/contato/","icon":"flask"},
    {"title":"Visite nosso site","subtitle":"Conheça a Yogomarcas e o que move a gente.","url":"https://www.yogomarcas.com.br/","icon":"globe"},
    {"title":"Instagram","url":"https://www.instagram.com/yogomarcas","icon":"instagram","style":"social"},
    {"title":"WhatsApp","url":"https://wa.me/5545991034053","icon":"whatsapp","style":"social"}
  ]'::jsonb) with ordinality as t(item, position)
)
insert into public.yp_link_hub(id, config)
select 1, jsonb_build_object(
  'title', 'Yogomarcas', 'bio', 'Grandes resultados começam na base.',
  'tagline', 'Sabor, praticidade e alta qualidade para o seu negócio.',
  'logo_url', '/assets/logo.png', 'background_color', '#f7f4fb', 'accent_color', '#51358b',
  'footer', 'Marechal Cândido Rondon · Paraná', 'public_url', '', 'links', links
) from initial_links;

-- Invoker rights + service-only execution. No visitor identifiers are stored.
create function public.yp_record_link_hub_event(p_key text) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_config jsonb; v_now timestamptz := now();
begin
  select config into v_config from public.yp_link_hub where id = 1;
  if v_config is null then return false; end if;
  if p_key <> 'page' and not exists (
    select 1 from jsonb_array_elements(v_config->'links') link
    where link->>'id' = p_key and (link->>'enabled')::boolean
      and (link->>'starts_at' is null or (link->>'starts_at')::timestamptz <= v_now)
      and (link->>'ends_at' is null or (link->>'ends_at')::timestamptz > v_now)
  ) then return false; end if;
  if p_key is null then return false; end if;
  insert into public.yp_link_hub_daily(event_day, event_key, events)
  values ((v_now at time zone 'America/Sao_Paulo')::date, p_key, 1)
  on conflict (event_day, event_key) do update set events = public.yp_link_hub_daily.events + 1;
  return true;
end; $$;

create function public.yp_link_hub_stats() returns jsonb
language sql stable security invoker set search_path = '' as $$
  with totals as (
    select event_key, sum(events) as total from public.yp_link_hub_daily
    where event_day >= (now() at time zone 'America/Sao_Paulo')::date - 29
    group by event_key
  )
  select jsonb_build_object(
    'views', coalesce(sum(total) filter (where event_key = 'page'), 0),
    'clicks', coalesce(sum(total) filter (where event_key <> 'page'), 0),
    'links', coalesce(jsonb_object_agg(event_key, total) filter (where event_key <> 'page'), '{}'::jsonb)
  ) from totals;
$$;
revoke all on function public.yp_record_link_hub_event(text), public.yp_link_hub_stats() from public, anon, authenticated;
grant execute on function public.yp_record_link_hub_event(text), public.yp_link_hub_stats() to service_role;
