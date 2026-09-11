import type { Catalog, Flavor, Line, Product } from './portal';
import { getLineDetails, type LineDetailsData } from './line-details';

export type PublicLine = Pick<Line, 'id' | 'name' | 'description'>;
export type PublicProduct = Pick<Product,
  'id' | 'line_id' | 'name' | 'description' | 'image_url' | 'package_label' |
  'package_weight_grams' | 'has_flavors' | 'available'> & { details: LineDetailsData };
export type PublicFlavor = Pick<Flavor,
  'id' | 'product_id' | 'name' | 'package_weight_grams' | 'available'>;
export type PublicCatalog = {
  lines: PublicLine[];
  products: PublicProduct[];
  flavors: PublicFlavor[];
};

const byPosition = (a: { position: number; name: string }, b: { position: number; name: string }) =>
  a.position - b.position || a.name.localeCompare(b.name, 'pt-BR');

// Explicit allowlist: prices, settings, offers, internal codes and customer data
// must never be serialized into the public catalog's HTML or React payload.
export function toPublicCatalog(source: Catalog): PublicCatalog {
  const activeLines = source.lines.filter(line => line.active).sort(byPosition);
  const lineIds = new Set(activeLines.map(line => line.id));
  const activeProducts = source.products
    .filter(product => product.active && lineIds.has(product.line_id))
    .sort(byPosition);
  const flavorProductIds = new Set(activeProducts.filter(product => product.has_flavors).map(product => product.id));
  const products = activeProducts.map(product => ({
    id: product.id,
    line_id: product.line_id,
    name: product.name,
    description: product.description,
    image_url: product.image_url,
    package_label: product.package_label,
    package_weight_grams: product.package_weight_grams,
    has_flavors: product.has_flavors,
    available: product.available,
    details: getLineDetails(product, source.flavors),
  }));
  const lines = activeLines
    .filter(line => products.some(product => product.line_id === line.id))
    .map(line => ({ id: line.id, name: line.name, description: line.description }));
  const flavors = source.flavors
    .filter(flavor => flavor.active && flavorProductIds.has(flavor.product_id))
    .sort(byPosition)
    .map(flavor => ({
      id: flavor.id,
      product_id: flavor.product_id,
      name: flavor.name,
      package_weight_grams: flavor.package_weight_grams,
      available: flavor.available,
    }));
  return { lines, products, flavors };
}
