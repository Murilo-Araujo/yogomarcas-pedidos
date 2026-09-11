import styles from '@/components/store/public-catalog.module.css';

export default function CatalogLoading() {
  return <main className={styles.main} role="status" aria-live="polite">
    <div className={styles.heading}><div><span className={styles.eyebrow}>Yogomarcas</span><h1>Linhas e sabores</h1><p>Carregando catálogo...</p></div></div>
  </main>;
}
