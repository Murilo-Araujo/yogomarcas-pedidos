import type { Catalog } from './portal';

// Stable IDs from the existing catalog. Renaming a line does not break its link.
export const PRICED_CATALOGS = {
  expressoitaliano: { name: 'Expresso Italiano', path: '/catalogoexpressoitaliano', lineId: '8e6da33f-eb1e-4f1f-a5f8-c52b865c8c78' },
  grego: { name: 'Iogurte Grego', path: '/catalogogrego', lineId: '1bf726e8-67a3-4c67-bf09-e72e4e8862b2' },
  frozen: { name: 'Frozen Yogurt', path: '/catalogofrozen', lineId: '8f0f5e86-6ac8-4be5-a651-a123e4aa1b0c' },
} as const;

export type PricedCatalogKey = keyof typeof PRICED_CATALOGS;
export type PricedCatalogItem = { id: string; name: string; price: number | null; available: boolean };
export type PricedCatalogGroup = { id: string; name: string; hasFlavors: boolean; items: PricedCatalogItem[] };
export type PricedCatalog = { groups: PricedCatalogGroup[] };

const byPosition = (a: { position: number; name: string }, b: { position: number; name: string }) =>
  a.position - b.position || a.name.localeCompare(b.name, 'pt-BR');
const validPrice = (price: number | null | undefined): number | null =>
  typeof price === 'number' && Number.isSafeInteger(price) && price > 0 ? price : null;

export function formatCatalogPrice(price: number | null): string {
  return price === null ? 'Sob consulta' : (price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Independent allowlist: the original /catalogo still never receives prices.
// Do not copy settings, internal codes, customer data, weights, offers or other lines.
export function toPricedCatalog(source: Catalog, key: PricedCatalogKey): PricedCatalog {
  const lineId = PRICED_CATALOGS[key].lineId;
  if (!source.lines.some(line => line.id === lineId && line.active)) return { groups: [] };
  const groups = source.products
    .filter(product => product.active && product.line_id === lineId)
    .sort(byPosition)
    .map(product => {
      const hasFlavors = !!product.has_flavors;
      const items: PricedCatalogItem[] = hasFlavors
        ? source.flavors.filter(flavor => flavor.active && flavor.product_id === product.id).sort(byPosition).map(flavor => ({
            id: flavor.id,
            name: flavor.name,
            price: validPrice(flavor.package_price),
            available: !!(product.available && flavor.available),
          }))
        : [{ id: product.id, name: product.name, price: validPrice(product.package_price), available: !!product.available }];
      return { id: product.id, name: product.name, hasFlavors, items };
    })
    .filter(group => group.items.length > 0);
  return { groups };
}
