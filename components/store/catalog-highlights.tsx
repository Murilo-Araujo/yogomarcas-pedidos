'use client';
import {useEffect, useState} from 'react';
import {ArrowRight, Package, Sparkles} from 'lucide-react';
import {highlightIsActive, type CatalogHighlight} from '@/lib/catalog-management';

type HighlightProduct = {id: string; name: string; image_url: string; description: string; has_flavors?: boolean};
export default function CatalogHighlights({highlights = [], products, onSelect}: {highlights?: CatalogHighlight[]; products: HighlightProduct[]; onSelect: (id: string) => void}) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const refresh = () => setNow(Date.now());
    const timer = window.setInterval(refresh, 1000);
    window.addEventListener('focus', refresh);
    return () => {window.clearInterval(timer); window.removeEventListener('focus', refresh);};
  }, []);
  const cards = highlights.filter(h => highlightIsActive(h, now)).flatMap(highlight => {
    const product = products.find(p => p.id === highlight.product_id);
    return product ? [{highlight, product}] : [];
  });
  if (!cards.length) return null;
  return <section className="catalog-highlights" aria-label="Novidades Yogomarcas">{cards.map(({highlight, product}) => <article className="catalog-highlight" key={highlight.id}>
    <div className="catalog-highlight-photo">{product.image_url ? <img src={product.image_url} alt={product.name}/> : <Package size={48} aria-hidden="true"/>}</div>
    <div className="catalog-highlight-copy"><span className="catalog-highlight-badge"><Sparkles size={14} aria-hidden="true"/>Novidade</span><h2>{highlight.title || product.name}</h2><p>{highlight.description || product.description}</p><button type="button" onClick={() => onSelect(product.id)}>Conhecer {product.has_flavors ? 'a linha' : 'o produto'}<ArrowRight size={17} aria-hidden="true"/></button></div>
  </article>)}</section>;
}
