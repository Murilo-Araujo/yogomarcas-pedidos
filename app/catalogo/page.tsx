import type { Metadata } from 'next';
import PublicCatalogView from '@/components/store/public-catalog';
import { API_URL, SUPABASE_KEY } from '@/lib/config';
import { toPublicCatalog, type PublicCatalog } from '@/lib/public-catalog';

const title = 'Yogomarcas | Linhas e sabores';
const description = 'Conheça as linhas, os produtos e os sabores da Yogomarcas para sua sorveteria.';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title,
  description,
  alternates: { canonical: 'https://pedidos.yogomarcas.com.br/catalogo' },
  openGraph: { title, description, url: 'https://pedidos.yogomarcas.com.br/catalogo', locale: 'pt_BR', type: 'website' },
};

export default async function CatalogPage() {
  let catalog: PublicCatalog | null = null;
  try {
    // Fetch on the server so the visitor receives only the public allowlist.
    // A new visit reflects the current catalog without a new deployment.
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
    catalog = toPublicCatalog(data);
  } catch {
    // Never expose an upstream response or fall back to the ordering page.
  }
  return <PublicCatalogView catalog={catalog} />;
}
