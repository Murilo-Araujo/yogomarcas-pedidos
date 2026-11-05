import type { Catalog, Flavor, Product } from './portal';

// Stable IDs from the existing catalog. Renaming a line does not break its link.
export const PRICED_CATALOGS = {
  expressoitaliano: { name: 'Expresso Italiano', path: '/catalogoexpressoitaliano', lineId: '8e6da33f-eb1e-4f1f-a5f8-c52b865c8c78' },
  grego: { name: 'Iogurte Grego', path: '/catalogogrego', lineId: '1bf726e8-67a3-4c67-bf09-e72e4e8862b2' },
  frozen: { name: 'Frozen Yogurt', path: '/catalogofrozen', lineId: '8f0f5e86-6ac8-4be5-a651-a123e4aa1b0c' },
} as const;

export type PricedCatalogKey = keyof typeof PRICED_CATALOGS;
export type PricedCatalogItem = { id: string; name: string; price: number | null; available: boolean; preparationLabel: string | null };
export type PricedCatalogGroup = { id: string; name: string; hasFlavors: boolean; items: PricedCatalogItem[] };
export type PricedCatalog = { groups: PricedCatalogGroup[] };

const byPosition = (a: { position: number; name: string }, b: { position: number; name: string }) =>
  a.position - b.position || a.name.localeCompare(b.name, 'pt-BR');
// Neutral bases first, then natural options in their configured order.
// All remaining flavors use Portuguese alphabetical order, not admin position.
function flavorPriority(name: string): number {
  const normalized = name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').trim().toLocaleLowerCase('pt-BR');
  if (/\bneutr[oa]\b|\bsem\s+sabor\b|\bs\s*\/\s*sabor\b/.test(normalized)) return 0;
  return /^natural\b/.test(normalized) ? 1 : 2;
}
const byFlavorName = (a: { position: number; name: string }, b: { position: number; name: string }) => {
  const priority = flavorPriority(a.name);
  const difference = priority - flavorPriority(b.name);
  return difference || (priority < 2 ? byPosition(a, b)
    : a.name.localeCompare(b.name, 'pt-BR', { sensitivity: 'base', numeric: true }) || byPosition(a, b));
};
const validPrice = (price: number | null | undefined): number | null =>
  typeof price === 'number' && Number.isSafeInteger(price) && price > 0 ? price : null;

export function formatCatalogPrice(price: number | null): string {
  return price === null ? 'Sob consulta' : (price / 100).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

// Stable product IDs keep the non-water preparations correct after a rename.
const SPECIAL_PREPARATIONS: Readonly<Record<string, string>> = {
  '2c9d9e2d-4de7-4aea-a592-845793bcc4eb': '1 pacote para 5 litros de polpa de açaí.',
  '923c7d61-7f32-4d67-952a-e2791dac82c5': '1 pacote para 4 litros de garapa ou outra bebida já doce da sua preferência.',
};

// A flavor's explicit water instruction takes precedence over the line default.
// Return only the short hint, never the full observation or preparation payload.
export function catalogPreparationLabel(product: Pick<Product, 'id' | 'preparation'>, flavor?: Pick<Flavor, 'observation'>): string | null {
  if (Object.hasOwn(SPECIAL_PREPARATIONS, product.id)) return SPECIAL_PREPARATIONS[product.id];
  const observation = (flavor?.observation ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
  const waterAmount = /\b(\d+(?:[.,]\d+)?)\s*(?:litros?|l)\s*(?:de\s+)?agua\b/;
  // Prefer the actual instruction over a comparison with the standard recipe.
  const instruction = observation.match(/\b(?:utilize|use|misture|dilua|adicione)\b[^;!?\n]*/)?.[0];
  const match = instruction?.match(waterAmount) ?? observation.match(waterAmount);
  const litres = match ? Number(match[1].replace(',', '.')) : product.preparation?.waterLitres;
  if (typeof litres !== 'number' || !Number.isFinite(litres) || litres <= 0) return null;
  const amount = litres.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return `1 pacote para ${amount} ${litres === 1 ? 'litro' : 'litros'} de água.`;
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
        ? source.flavors.filter(flavor => flavor.active && flavor.product_id === product.id).sort(byFlavorName).map(flavor => ({
            id: flavor.id,
            name: flavor.name,
            price: validPrice(flavor.package_price),
            available: !!(product.available && flavor.available),
            preparationLabel: catalogPreparationLabel(product, flavor),
          }))
        : [{ id: product.id, name: product.name, price: validPrice(product.package_price), available: !!product.available, preparationLabel: catalogPreparationLabel(product) }];
      return { id: product.id, name: product.name, hasFlavors, items };
    })
    .filter(group => group.items.length > 0);
  return { groups };
}
