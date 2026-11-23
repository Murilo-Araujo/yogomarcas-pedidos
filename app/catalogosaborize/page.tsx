import PricedCatalogPage, { pricedCatalogMetadata } from '@/components/store/priced-catalog-page';

export const dynamic = 'force-dynamic';
export const metadata = pricedCatalogMetadata('saborizante');

export default function SaborizanteCatalogPage() {
  return <PricedCatalogPage catalogKey="saborizante" />;
}
