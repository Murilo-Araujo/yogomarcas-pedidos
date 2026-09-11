'use client';

import { useState } from 'react';
import Image from 'next/image';
import { ArrowUp, BookOpen, Info, Package, Search, X } from 'lucide-react';
import type { PublicCatalog, PublicFlavor, PublicProduct } from '@/lib/public-catalog';
import { Sheet, SheetClose, SheetContent, SheetDescription, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { LineDetailsContent } from './line-details';
import styles from './public-catalog.module.css';

const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('pt-BR');
const weight = (grams: number) => `${grams.toLocaleString('pt-BR')} g`;

function ProductPhoto({ product, priority }: { product: PublicProduct; priority: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={styles.photo}>
    {product.image_url && !failed
      ? <Image src={product.image_url} alt={product.name} fill unoptimized priority={priority}
          sizes="(max-width: 700px) 100vw, 300px" onError={() => setFailed(true)} />
      : <div className={styles.photoFallback}><Package size={48} strokeWidth={1.25} aria-hidden="true" /><span>{product.name}</span></div>}
  </div>;
}

function ProductSection({ product, flavors, totalFlavors, priority }: {
  product: PublicProduct; flavors: PublicFlavor[]; totalFlavors: number; priority: boolean;
}) {
  return <article className={styles.product} aria-labelledby={`product-${product.id}`}>
    <div className={styles.productIntro}>
      <ProductPhoto product={product} priority={priority} />
      <div className={styles.productInfo}>
        <h3 id={`product-${product.id}`}>{product.name}</h3>
        <p>{product.description}</p>
        {!product.available && <span className={styles.unavailable}>Temporariamente indisponível</span>}
        {!product.has_flavors && !!product.package_weight_grams && <span className={styles.packaging}>
          <Package size={17} aria-hidden="true" />{weight(product.package_weight_grams)} por {product.package_label.toLocaleLowerCase('pt-BR')}
        </span>}
        <Sheet>
          <SheetTrigger asChild>
            <button type="button" className={styles.aboutButton} aria-label={`${product.has_flavors ? 'Sobre a linha' : 'Sobre o produto'} ${product.name}`}>
              <Info size={18} aria-hidden="true" />{product.has_flavors ? 'Sobre esta linha' : 'Sobre este produto'}
            </button>
          </SheetTrigger>
          <SheetContent className={styles.aboutSheet} showCloseButton={false}>
            <SheetHeader className={styles.aboutHeader}>
              <SheetTitle>{product.name}</SheetTitle>
              <SheetDescription>{product.has_flavors ? 'Sobre esta linha' : 'Sobre este produto'}</SheetDescription>
            </SheetHeader>
            <SheetClose className={styles.aboutClose} aria-label="Fechar informações"><X size={20} aria-hidden="true" /></SheetClose>
            <div className={styles.aboutBody}>
              <LineDetailsContent details={product.details}><ProductPhoto product={product} priority={false} /></LineDetailsContent>
            </div>
          </SheetContent>
        </Sheet>
      </div>
    </div>
    {product.has_flavors && <div className={styles.flavorPanel}>
      <div className={styles.flavorHeading}>
        <h4>Sabores</h4>
        <span>{flavors.length === totalFlavors ? `${totalFlavors} opções` : `${flavors.length} de ${totalFlavors} opções`}</span>
      </div>
      {flavors.length ? <ul className={styles.flavors} aria-label={`Sabores de ${product.name}`}>
        {flavors.map(flavor => <li key={flavor.id}>
          <span className={styles.flavorName}>{flavor.name}</span>
          {!!flavor.package_weight_grams && <span className={styles.flavorWeight}>{weight(flavor.package_weight_grams)}</span>}
          {(!product.available || !flavor.available) && <small className={styles.flavorUnavailable}>Temporariamente indisponível</small>}
        </li>)}
      </ul> : <p className={styles.noFlavors}>Os sabores desta linha serão disponibilizados em breve.</p>}
    </div>}
  </article>;
}

export default function PublicCatalogView({ catalog }: { catalog: PublicCatalog | null }) {
  const [lineId, setLineId] = useState('all');
  const [query, setQuery] = useState('');
  const term = normalize(query.trim());
  const groups = (catalog?.lines ?? []).filter(line => lineId === 'all' || line.id === lineId).map(line => {
    const lineMatches = normalize(line.name).includes(term);
    const products = (catalog?.products ?? []).filter(product => product.line_id === line.id).flatMap(product => {
      const allFlavors = (catalog?.flavors ?? []).filter(flavor => flavor.product_id === product.id);
      const productMatches = lineMatches || normalize(product.name).includes(term);
      const flavors = productMatches ? allFlavors : allFlavors.filter(flavor => normalize(flavor.name).includes(term));
      return productMatches || flavors.length ? [{ product, flavors, totalFlavors: allFlavors.length }] : [];
    });
    return { line, products };
  }).filter(group => group.products.length);
  const productCount = groups.reduce((total, group) => total + group.products.length, 0);
  const flavorCount = groups.reduce((total, group) => total + group.products.reduce((sum, item) => sum + item.flavors.length, 0), 0);

  function resetFilters() { setLineId('all'); setQuery(''); }

  return <div className={styles.catalog} id="top">
    <a className={styles.skipLink} href="#catalog-content">Ir para as linhas e sabores</a>
    <header className={styles.header}>
      <div className={styles.headerInner}>
        <a href="/catalogo" aria-label="Yogomarcas, catálogo de produtos" className={styles.logo}>
          <Image src="/assets/logo.png" alt="Yogomarcas" width={191} height={44} priority unoptimized />
        </a>
        <span className={styles.headerLabel}><BookOpen size={18} aria-hidden="true" />Catálogo de produtos</span>
      </div>
    </header>
    <main className={styles.main} id="catalog-content">
      <div className={styles.heading}>
        <div><span className={styles.eyebrow}>Yogomarcas</span><h1>Linhas e sabores</h1><p>Conheça as opções para sua sorveteria.</p></div>
        {!!catalog?.products.length && <div className={styles.catalogCount}>
          <strong>{catalog.lines.length} <span>linhas</span></strong>
          <span>{catalog.flavors.length} opções de sabores</span>
        </div>}
      </div>

      {!catalog ? <div className={styles.empty} role="alert">
        <BookOpen size={32} aria-hidden="true" /><h2>Não foi possível carregar o catálogo</h2>
        <p>Tente novamente em alguns instantes.</p><a href="/catalogo" className={styles.reset}>Tentar novamente</a>
      </div> : !catalog.products.length ? <div className={styles.empty}>
        <BookOpen size={32} aria-hidden="true" /><h2>Catálogo em atualização</h2><p>Volte em breve para conhecer nossas linhas e sabores.</p>
      </div> : <>
        <div className={styles.toolbar}>
          <div className={styles.lineFilters} role="group" aria-label="Filtrar por linha">
            <button type="button" aria-pressed={lineId === 'all'} onClick={() => setLineId('all')}>Todas as linhas</button>
            {catalog.lines.map(line => <button type="button" key={line.id} aria-pressed={lineId === line.id} onClick={() => setLineId(line.id)}>{line.name}</button>)}
          </div>
          <div className={styles.searchRow}>
            <div className={styles.search}>
              <Search size={19} aria-hidden="true" />
              <input type="search" aria-label="Buscar linha ou sabor" placeholder="Buscar linha ou sabor" value={query} onChange={event => setQuery(event.target.value)} autoComplete="off" />
              {query && <button type="button" aria-label="Limpar busca" onClick={() => setQuery('')}><X size={18} aria-hidden="true" /></button>}
            </div>
            <p role="status" aria-live="polite">{productCount} {productCount === 1 ? 'produto' : 'produtos'}{flavorCount ? ` · ${flavorCount} ${flavorCount === 1 ? 'sabor' : 'sabores'}` : ''}</p>
          </div>
        </div>
        {groups.length ? <div className={styles.groups}>
          {groups.map(({ line, products }, groupIndex) => <section key={line.id} aria-labelledby={`line-${line.id}`}>
            <div className={styles.lineHeading}>
              <span className={styles.lineNumber} aria-hidden="true">{String(catalog.lines.findIndex(item => item.id === line.id) + 1).padStart(2, '0')}</span>
              <div><h2 id={`line-${line.id}`}>{line.name}</h2>{line.description && <p>{line.description}</p>}</div>
            </div>
            <div className={styles.products}>
              {products.map(({ product, flavors, totalFlavors }, productIndex) => <ProductSection key={product.id} product={product} flavors={flavors} totalFlavors={totalFlavors} priority={groupIndex === 0 && productIndex === 0} />)}
            </div>
          </section>)}
        </div> : <div className={styles.empty}>
          <Search size={32} aria-hidden="true" /><h2>Nenhum resultado encontrado</h2>
          <p>Tente outro nome ou consulte todas as linhas.</p><button type="button" onClick={resetFilters} className={styles.reset}>Ver catálogo completo</button>
        </div>}
      </>}
    </main>
    <footer className={styles.footer}><span>Yogomarcas · Grandes resultados começam na base.</span><a href="#top">Voltar ao topo <ArrowUp size={16} aria-hidden="true" /></a></footer>
  </div>;
}
