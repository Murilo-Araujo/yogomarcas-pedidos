import type { Metadata } from 'next';
import { API_URL, SUPABASE_KEY } from '@/lib/config';
import { PRICED_CATALOGS, toPricedCatalog, type PricedCatalog, type PricedCatalogKey } from '@/lib/priced-catalog';
import PricedCatalogView from './priced-catalog';

export function pricedCatalogMetadata(key: PricedCatalogKey): Metadata {
  const definition = PRICED_CATALOGS[key];
  const title = `${definition.name} | Sabores e preços | Yogomarcas`;
  const description = `Consulte os sabores e os preços por pacote da linha ${definition.name} da Yogomarcas.`;
  const url = `https://pedidos.yogomarcas.com.br${definition.path}`;
  return {
    title, description,
    robots: { index: false, follow: false },
    alternates: { canonical: url },
    openGraph: { title, description, url, locale: 'pt_BR', type: 'website' },
  };
}

export default async function PricedCatalogPage({ catalogKey }: { catalogKey: PricedCatalogKey }) {
  let catalog: PricedCatalog | null = null;
  try {
    // Same live source as ordering, fetched on the server on every visit.
    const response = await fetch(API_URL + '?offers=2', {
      headers: { apikey: SUPABASE_KEY },
      cache: 'no-store',
      signal: AbortSignal.timeout(12_000),
    });
    if (!response.ok) throw new Error('Catalog unavailable');
    const data = await response.json();
    if (!Array.isArray(data.lines) || !Array.isArray(data.products) || !Array.isArray(data.flavors)) {
      throw new Error('Invalid catalog');
    }
    catalog = toPricedCatalog(data, catalogKey);
  } catch {
    // No stale price fallback, upstream details, or redirect into ordering.
  }
  return <PricedCatalogView catalog={catalog} catalogKey={catalogKey} />;
}
