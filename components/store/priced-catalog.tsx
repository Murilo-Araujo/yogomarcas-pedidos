import Image from 'next/image';
import { ArrowUp, BookOpen } from 'lucide-react';
import { PRICED_CATALOGS, formatCatalogPrice, type PricedCatalog, type PricedCatalogKey } from '@/lib/priced-catalog';
import shared from './public-catalog.module.css';
import styles from './priced-catalog.module.css';

export default function PricedCatalogView({ catalog, catalogKey }: { catalog: PricedCatalog | null; catalogKey: PricedCatalogKey }) {
  const definition = PRICED_CATALOGS[catalogKey];
  return <div className={shared.catalog} id="top">
    <a className={shared.skipLink} href="#priced-catalog-content">Ir para sabores e preços</a>
    <header className={shared.header}>
      <div className={shared.headerInner}>
        <a href="/catalogo" aria-label="Yogomarcas, catálogo de produtos" className={shared.logo}>
          <Image src="/assets/logo.png" alt="Yogomarcas" width={191} height={44} priority unoptimized />
        </a>
        <span className={shared.headerLabel}><BookOpen size={18} aria-hidden="true" />Catálogo com preços</span>
      </div>
    </header>
    <main className={`${shared.main} ${styles.content}`} id="priced-catalog-content">
      <div className={shared.heading}>
        <div><span className={shared.eyebrow}>Yogomarcas</span><h1>{definition.name}</h1><p>Sabores e preços por pacote.</p></div>
      </div>
      {!catalog ? <div className={shared.empty} role="alert">
        <BookOpen size={32} aria-hidden="true" /><h2>Não foi possível carregar o catálogo</h2>
        <p>Tente novamente em alguns instantes.</p><a href={definition.path} className={shared.reset}>Tentar novamente</a>
      </div> : !catalog.groups.length ? <div className={shared.empty}>
        <BookOpen size={32} aria-hidden="true" /><h2>Catálogo em atualização</h2><p>As opções desta linha serão disponibilizadas em breve.</p>
      </div> : <div className={styles.groups}>
        {catalog.groups.map(group => <section key={group.id} className={styles.group} aria-labelledby={`priced-product-${group.id}`}>
          <div className={styles.groupHeading}>
            <h2 id={`priced-product-${group.id}`}>{group.name}</h2>
            <span>{group.items.length} {group.items.length === 1 ? 'opção' : 'opções'}</span>
          </div>
          <table className={styles.table}>
            <caption className="sr-only">{group.name}: {group.hasFlavors ? 'sabores' : 'produtos'} e preços por pacote</caption>
            <thead><tr><th scope="col">{group.hasFlavors ? 'Sabor' : 'Produto'}</th><th scope="col">Preço por pacote</th></tr></thead>
            <tbody>{group.items.map(item => <tr key={item.id}>
              <th scope="row"><span>{item.name}</span>{item.preparationLabel && <small className={styles.preparation}>{item.preparationLabel}</small>}{!item.available && <small className={styles.unavailable}>Temporariamente indisponível</small>}</th>
              <td className={item.price === null ? styles.onRequest : undefined}>{formatCatalogPrice(item.price)}</td>
            </tr>)}</tbody>
          </table>
        </section>)}
        <p className={styles.note}>Valores por pacote. Frete não incluso. Preços sujeitos a alteração.</p>
      </div>}
    </main>
    <footer className={shared.footer}><span>Yogomarcas · Grandes resultados começam na base.</span><a href="#top">Voltar ao topo <ArrowUp size={16} aria-hidden="true" /></a></footer>
  </div>;
}
