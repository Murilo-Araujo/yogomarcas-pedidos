import { cache } from 'react';
import type { Metadata } from 'next';
import LinkHub from '@/components/links/link-hub';
import { API_URL, SUPABASE_KEY } from '@/lib/config';
import { publicLinkHub, type LinkHubConfig } from '@/lib/link-hub';

export const dynamic = 'force-dynamic';
const getPage = cache(async (): Promise<LinkHubConfig | null> => {
  try {
    const response = await fetch(API_URL + '?view=links', { headers: { apikey: SUPABASE_KEY }, cache: 'no-store', signal: AbortSignal.timeout(12_000) });
    if (!response.ok) return null;
    return publicLinkHub((await response.json()).config);
  } catch { return null; }
});
export async function generateMetadata(): Promise<Metadata> {
  const page = await getPage();
  const title = `${page?.title || 'Yogomarcas'} | Nossos links`;
  const description = page?.tagline || page?.bio || 'Produtos, pedidos e contato com a Yogomarcas.';
  const canonical = page?.public_url || 'https://pedidos.yogomarcas.com.br/links';
  const image = page?.logo_url || '/assets/logo.png';
  return {
    title, description, robots: { index: true, follow: true }, alternates: { canonical },
    openGraph: { title, description, url: canonical, locale: 'pt_BR', type: 'website', images: [{ url: image.startsWith('/') ? 'https://pedidos.yogomarcas.com.br' + image : image, alt: page?.title || 'Yogomarcas' }] },
    twitter: { card: 'summary', title, description },
  };
}
export default async function LinksPage() { return <LinkHub initialConfig={await getPage()} />; }
