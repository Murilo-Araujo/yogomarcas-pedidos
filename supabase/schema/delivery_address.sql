-- Immutable delivery details for each order; historic orders remain valid.
-- City and state keep their existing columns for reporting and compatibility.
alter table public.yp_orders
  add column if not exists delivery_address jsonb
  constraint yp_orders_delivery_address_object
  check (delivery_address is null or jsonb_typeof(delivery_address) = 'object');

comment on column public.yp_orders.delivery_address is
  'Delivery snapshot: postal_code, street, number, neighborhood, complement and reference. Protected by the existing order access rules.';
