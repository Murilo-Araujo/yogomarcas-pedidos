import PricedCatalogPage, { pricedCatalogMetadata } from '@/components/store/priced-catalog-page';

export const dynamic = 'force-dynamic';
export const metadata = pricedCatalogMetadata('grego');

export default function GregoCatalogPage() {
  return <PricedCatalogPage catalogKey="grego" />;
}
