import PricedCatalogPage, { pricedCatalogMetadata } from '@/components/store/priced-catalog-page';

export const dynamic = 'force-dynamic';
export const metadata = pricedCatalogMetadata('expressoitaliano');

export default function ExpressoItalianoCatalogPage() {
  return <PricedCatalogPage catalogKey="expressoitaliano" />;
}
