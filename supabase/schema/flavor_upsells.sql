-- Run after customer_retention.sql. Existing product-wide rules remain valid.
alter table public.yp_upsell_rules
 add column if not exists trigger_flavor_id uuid references public.yp_flavors(id);
create index if not exists yp_upsell_rules_trigger_flavor_idx on public.yp_upsell_rules(trigger_flavor_id);
alter table public.yp_upsell_rules drop constraint if exists yp_upsell_rules_check;
alter table public.yp_upsell_rules drop constraint if exists yp_upsell_rules_distinct_variant_check;
alter table public.yp_upsell_rules add constraint yp_upsell_rules_distinct_variant_check check (
 trigger_product_id<>product_id or
 (flavor_id is not null and (trigger_flavor_id is null or trigger_flavor_id<>flavor_id))
);
