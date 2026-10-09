'use client';

import { useMemo, useRef, useState } from 'react';
import { Check, ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { HubIcon } from '@/components/links/hub-icon';
import { tablerIconId, tablerIconLabel, type LinkIcon, type TablerIconId } from '@/lib/tabler-icons';
import { searchTablerIcons, TABLER_CATALOG, type IconFilter } from '@/lib/tabler-search';
import styles from './tabler-icon-picker.module.css';

const PAGE_SIZE = 60;
const filters = [['all', 'Todos'], ['outline', 'Contorno'], ['filled', 'Preenchidos']] as const;
export default function TablerIconPicker({ value, linkTitle, onSelect, onClose, returnFocus }: {
  value: LinkIcon; linkTitle: string; onSelect: (icon: TablerIconId) => void; onClose: () => void; returnFocus: () => void;
}) {
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<IconFilter>('all');
  const [page, setPage] = useState(0);
  const searchRef = useRef<HTMLInputElement>(null), resultsRef = useRef<HTMLDivElement>(null), closeRef = useRef<HTMLButtonElement>(null);
  const matches = useMemo(() => searchTablerIcons(query, filter), [query, filter]);
  const pages = Math.max(1, Math.ceil(matches.length / PAGE_SIZE));
  const selected = tablerIconId(value);
  function resetResults() { setPage(0); resultsRef.current?.scrollTo({ top: 0 }); }
  function search(text: string) { setQuery(text); resetResults(); }
  function changePage(next: number) { setPage(next); resultsRef.current?.scrollTo({ top: 0 }); }
  return <Dialog open onOpenChange={open => { if (!open) onClose(); }}>
    <DialogContent className={styles.dialog} showCloseButton={false}
      onOpenAutoFocus={event => { event.preventDefault(); (window.matchMedia('(max-width: 600px)').matches ? closeRef.current : searchRef.current)?.focus(); }}
      onCloseAutoFocus={event => { event.preventDefault(); returnFocus(); }}>
      <header className={styles.header}>
        <div><span className={styles.eyebrow}>TABLER ICONS</span><DialogTitle className={styles.title}>Escolha um ícone</DialogTitle>
          <DialogDescription className={styles.description}>{TABLER_CATALOG.length.toLocaleString('pt-BR')} opções para dar a sua cara ao link.</DialogDescription></div>
        <button ref={closeRef} className={styles.close} type="button" onClick={onClose} aria-label="Fechar biblioteca de ícones"><X size={20} /></button>
      </header>
      <div className={styles.controls}>
        <div className={styles.search}><Search size={19} aria-hidden="true" />
          <input ref={searchRef} aria-label="Pesquisar ícones pelo nome" placeholder="Buscar por nome: whatsapp, heart, sorvete…" value={query} onChange={event => search(event.target.value)} autoComplete="off" spellCheck={false} />
          {query && <button type="button" aria-label="Limpar pesquisa" onClick={() => { search(''); searchRef.current?.focus(); }}><X size={16} /></button>}
        </div>
        <div className={styles.filterRow}><div className={styles.filters} role="group" aria-label="Estilo do ícone">{filters.map(([id, label]) => <button key={id} type="button" aria-pressed={filter === id} onClick={() => { setFilter(id); resetResults(); }}>{label}</button>)}</div>
          <span className={styles.count} role="status">{matches.length.toLocaleString('pt-BR')} {matches.length === 1 ? 'ícone' : 'ícones'}</span></div>
      </div>
      <div className={styles.results} ref={resultsRef}>
        {matches.length ? <div className={styles.grid}>{matches.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE).map(icon => <button
          key={icon.id} type="button" className={styles.icon} aria-label={`Escolher ${tablerIconLabel(icon.id)}`}
          aria-pressed={selected === icon.id} title={tablerIconLabel(icon.id)} onClick={() => { onSelect(icon.id); onClose(); }}>
          {selected === icon.id && <Check size={13} className={styles.check} aria-hidden="true" />}
          <HubIcon name={icon.id} size={28} /><span>{icon.name}</span><small>{icon.variant === 'filled' ? 'Preenchido' : 'Contorno'}</small>
        </button>)}</div> : <div className={styles.empty}><Search size={28} aria-hidden="true" /><strong>Nenhum ícone encontrado</strong><p>Tente outro nome, como instagram, phone ou star.</p><button type="button" onClick={() => { search(''); setFilter('all'); searchRef.current?.focus(); }}>Mostrar todos os ícones</button></div>}
      </div>
      <footer className={styles.footer}>
        <div className={styles.current}><HubIcon name={value} size={21} /><div><span>Atual em {linkTitle || 'Novo link'}</span><strong>{tablerIconLabel(value)}</strong></div></div>
        <nav className={styles.pagination} aria-label="Páginas de ícones"><button type="button" disabled={page === 0} onClick={() => changePage(page - 1)} aria-label="Página anterior de ícones"><ChevronLeft size={18} /></button>
          <span aria-live="polite">{page + 1} / {pages}</span><button type="button" disabled={page + 1 >= pages} onClick={() => changePage(page + 1)} aria-label="Próxima página de ícones"><ChevronRight size={18} /></button></nav>
      </footer>
      <p className={styles.note}>Escolha um ícone e depois use “Salvar e publicar” para aplicar.</p>
    </DialogContent>
  </Dialog>;
}
