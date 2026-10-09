'use client';
import {useEffect, useState} from 'react';
import {Clock3, LoaderCircle, Sparkles, X} from 'lucide-react';
import {toast} from 'sonner';
import {api, dateTime, type Catalog} from '@/lib/portal';
import {highlightIsActive, type CatalogHighlight} from '@/lib/catalog-management';
import {Choice} from './controls';
import {AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel} from '@/components/ui/alert-dialog';

export default function AdminHighlights({catalog}: {catalog: Catalog}) {
  const [highlights, setHighlights] = useState<CatalogHighlight[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [productId, setProductId] = useState(''), [title, setTitle] = useState(''), [description, setDescription] = useState('');
  const [duration, setDuration] = useState('2'), [unit, setUnit] = useState('months');
  const [stopping, setStopping] = useState<CatalogHighlight | null>(null);
  const products = catalog.products.filter(p => p.active && catalog.lines.some(l => l.id === p.line_id && l.active));
  const product = products.find(p => p.id === productId);
  const alreadyActive = highlights.some(h => h.product_id === productId && highlightIsActive(h));
  async function load() {
    try {const result = await api('admin_highlights', {}, true); setHighlights(result.highlights); setError('');}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível carregar as novidades.');}
    finally {setLoading(false);}
  }
  useEffect(() => {void load();}, []);
  async function save(e: React.FormEvent) {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await api('save_highlight', {product_id: productId, title, description, duration: Number(duration), unit}, true);
      setHighlights(current => [result, ...current.filter(h => h.product_id !== result.product_id)]);
      setProductId(''); setTitle(''); setDescription(''); toast.success('Novidade publicada. O período começou agora.');
    } catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível salvar.');}
    finally {setBusy(false);}
  }
  async function stop() {
    if (!stopping || busy) return;
    setBusy(true);
    try {await api('stop_highlight', {id: stopping.id}, true); setHighlights(current => current.map(h => h.id === stopping.id ? {...h, active: false} : h)); setStopping(null); toast.success('Destaque encerrado.');}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível encerrar.'); setStopping(null);}
    finally {setBusy(false);}
  }
  return <div className="management-stack">
    <section className="admin-panel"><div className="panel-heading"><div><h2>Novidades no catálogo</h2><p>Um banner horizontal acima dos produtos. O prazo começa ao salvar e o destaque sai automaticamente ao terminar.</p></div><Sparkles size={26}/></div>
      <form onSubmit={save} className="management-form"><fieldset disabled={busy || loading}>
        <div className="form-grid"><div className="field"><span>Produto ou linha *</span><Choice label="Produto em destaque" value={productId} onChange={setProductId} options={products.map(p => ({value: p.id, label: p.name}))}/></div><div className="duration-fields"><label className="field"><span>Duração *</span><input required type="number" min="1" max={unit === 'months' ? 24 : 365} step="1" value={duration} onChange={e => setDuration(e.target.value)}/></label><div className="field"><span>Período</span><Choice label="Unidade de duração" value={unit} onChange={setUnit} options={[{value: 'months', label: 'Meses'}, {value: 'days', label: 'Dias'}]}/></div></div></div>
        <label className="field"><span>Título do banner (opcional)</span><input maxLength={120} value={title} onChange={e => setTitle(e.target.value)} placeholder={product?.name || 'Usar o nome do produto'}/></label>
        <label className="field"><span>Texto do banner (opcional)</span><textarea maxLength={400} rows={2} value={description} onChange={e => setDescription(e.target.value)} placeholder="Se ficar vazio, será usada a descrição do produto."/></label>
        {alreadyActive && <p className="editor-hint">Este produto já está em destaque. Ao salvar, o banner será atualizado e o prazo começará novamente.</p>}
        <button className="btn primary" type="submit" disabled={!productId || busy || loading}>{busy ? <LoaderCircle className="spin" size={17}/> : <Sparkles size={17}/>}Salvar e iniciar período</button>
      </fieldset></form>{error && <p className="error-box" role="alert">{error}</p>}
    </section>
    <section className="admin-panel"><div className="panel-heading"><div><h2>Destaques cadastrados</h2><p>Consulte o prazo ou encerre um destaque antes da data final.</p></div><button className="btn secondary" disabled={busy} onClick={() => void load()}>Atualizar</button></div>
      {loading ? <p role="status">Carregando novidades…</p> : !highlights.length ? <p className="management-empty">Cadastre a primeira novidade para destacá-la no catálogo.</p> : <div className="management-list">{highlights.map(h => <div className="management-row" key={h.id}><div><span className={`status ${highlightIsActive(h) ? 'confirmed' : 'cancelled'}`}>{highlightIsActive(h) ? 'Em destaque' : h.active ? 'Prazo encerrado' : 'Encerrado'}</span><h3>{h.title || catalog.products.find(p => p.id === h.product_id)?.name || 'Produto removido'}</h3><p><Clock3 size={15}/>De {dateTime(h.starts_at)} até {dateTime(h.expires_at)}</p></div>{highlightIsActive(h) && <button className="btn secondary" disabled={busy} onClick={() => setStopping(h)}><X size={15}/>Encerrar destaque</button>}</div>)}</div>}
    </section>
    <AlertDialog open={!!stopping} onOpenChange={open => {if (!open && !busy) setStopping(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Encerrar este destaque?</AlertDialogTitle><AlertDialogDescription>O banner sairá do topo. O produto continuará no catálogo.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel><button className="btn primary" disabled={busy} onClick={() => void stop()}>Encerrar destaque</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
