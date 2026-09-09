-- Apply after these six assets are available on both portal deployments.
-- Preserve any photo changed by an administrator since the catalogue review.
with images(sku, previous_url, next_url) as (values
 ('YOGO-EI', '/assets/mix.webp', '/assets/catalog-expresso-italiano-v1.webp'),
 ('YOGO-FY', '/assets/mix.webp', '/assets/catalog-frozen-yogurt-v1.webp'),
 ('YOGO-IG', '/assets/mix.webp', '/assets/catalog-iogurte-grego-v1.webp'),
 ('YOGO-SAB', '/assets/mix.webp', '/assets/catalog-saborizantes-v1.webp'),
 ('YOGO-SAB-BASE', '/assets/mix.webp', '/assets/catalog-base-neutra-v1.webp'),
 ('LUB', '', '/assets/catalog-lubrificante-v1.webp')
)
update public.yp_products p
set image_url = images.next_url, updated_at = now()
from images
where p.sku = images.sku and p.image_url = images.previous_url
returning p.sku, p.name, p.image_url;
