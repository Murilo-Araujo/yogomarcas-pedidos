-- Apply before deploying the order-portal and storefront update.
-- Existing products remain eligible; all flavors inherit their product's choice.
alter table public.yp_products
  add column bundle_enabled boolean not null default true;

comment on column public.yp_products.bundle_enabled is
  'Allows new bundle purchases for this product and all its flavors. Does not change historical orders or the five-package bundle calculation.';
