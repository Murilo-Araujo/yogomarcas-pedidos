import PricedCatalogPage, { pricedCatalogMetadata } from '@/components/store/priced-catalog-page';

export const dynamic = 'force-dynamic';
export const metadata = pricedCatalogMetadata('frozen');

export default function FrozenCatalogPage() {
  return <PricedCatalogPage catalogKey="frozen" />;
}
