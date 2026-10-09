'use client';
import {useEffect, useRef, useState} from 'react';
import {CalendarClock, Check, Clock3, LoaderCircle, Percent, RefreshCw, X} from 'lucide-react';
import {toast} from 'sonner';
import {Checkbox} from '@/components/ui/checkbox';
import {AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogTitle, AlertDialogDescription, AlertDialogFooter, AlertDialogCancel} from '@/components/ui/alert-dialog';
import {api, dateTime, money, type Catalog} from '@/lib/portal';
import {parsePercentage, type PriceAdjustment, type PriceChange} from '@/lib/catalog-management';
import {Choice} from './controls';

type Preview = {changes: PriceChange[]; fingerprint: string};
const STATUS = {pending: 'Agendado', applied: 'Aplicado', cancelled: 'Cancelado', failed: 'Falhou'};
const percent = (points: number) => (points / 100).toLocaleString('pt-BR', {maximumFractionDigits: 2}) + '%';
export default function AdminPriceAdjustments({catalog, onChanged}: {catalog: Catalog; onChanged: () => Promise<unknown>}) {
  const [percentage, setPercentage] = useState(''), [scope, setScope] = useState('all'), [selected, setSelected] = useState<string[]>([]);
  const [when, setWhen] = useState('now'), [date, setDate] = useState('');
  const [preview, setPreview] = useState<Preview | null>(null), [jobs, setJobs] = useState<PriceAdjustment[]>([]);
  const [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const [confirmation, setConfirmation] = useState(false), [cancelling, setCancelling] = useState<PriceAdjustment | null>(null);
  const [page, setPage] = useState(0), [hasMore, setHasMore] = useState(false);
  const requestId = useRef<string | null>(null), inFlight = useRef(false);
  const points = parsePercentage(percentage);
  const parsedDate = when === 'scheduled' && date ? new Date(date + ':00-03:00') : null;
  const scheduledAt = parsedDate && Number.isFinite(+parsedDate) ? parsedDate.toISOString() : null;
  const ids = scope === 'selected' ? selected : null;
  const formKey = JSON.stringify([percentage, scope, selected, when, date]);
  const previewKey = useRef('');
  const validPreview = previewKey.current === formKey ? preview : null;

  async function load(pageNumber: number) {
    setLoading(true);
    try {const result = await api('price_adjustments', {page: pageNumber}, true); setJobs(result.adjustments); setHasMore(result.has_more); setError('');}
    catch (e) {setError(e instanceof Error ? e.message : 'Não foi possível carregar o histórico.');}
    finally {setLoading(false);}
  }
  useEffect(() => {void load(page);}, [page]);
  useEffect(() => {
    const refresh = () => {if (!inFlight.current) void load(page);};
    const timer = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    return () => {window.clearInterval(timer); window.removeEventListener('focus', refresh);};
  }, [page]);
  async function generatePreview(e: React.FormEvent) {
    e.preventDefault(); if (inFlight.current) return;
    setError('');
    if (!points) {setError('Informe um percentual maior que zero e de até 100%, com até duas casas decimais.'); return;}
    if (ids && !ids.length) {setError('Selecione pelo menos um produto ou linha.'); return;}
    if (when === 'scheduled' && (!scheduledAt || Date.parse(scheduledAt) <= Date.now() + 60000)) {setError('Escolha um horário com pelo menos um minuto de antecedência.'); return;}
    inFlight.current = true; setBusy(true);
    try {
      const result = await api('preview_price_adjustment', {basis_points: points, product_ids: ids}, true);
      if (!result.changes.length) throw new Error('Nenhum preço cadastrado nos produtos selecionados.');
      previewKey.current = formKey; requestId.current = crypto.randomUUID(); setPreview(result);
    } catch (e) {setPreview(null); setError(e instanceof Error ? e.message : 'Não foi possível calcular a prévia.');}
    finally {inFlight.current = false; setBusy(false);}
  }
  async function submit() {
    if (inFlight.current || !validPreview || !points || !requestId.current) return;
    inFlight.current = true; setBusy(true); setError('');
    try {
      const result: PriceAdjustment = await api('create_price_adjustment', {id: requestId.current, basis_points: points, product_ids: ids, scheduled_at: scheduledAt, fingerprint: validPreview.fingerprint}, true);
      setConfirmation(false); setPreview(null); requestId.current = null;
      toast.success(result.status === 'applied' ? 'Reajuste aplicado aos preços do catálogo.' : 'Reajuste agendado. A aplicação será automática.');
      setJobs(current => [result, ...current.filter(j => j.id !== result.id)].slice(0, 20));
      if (result.status === 'applied') {
        try {await onChanged();} catch {setError('O reajuste foi aplicado. Atualize a página para conferir os preços.');}
      }
    } catch (e) {setConfirmation(false); setError(e instanceof Error ? e.message : 'Não foi possível concluir. Tente novamente com a mesma prévia.');}
    finally {inFlight.current = false; setBusy(false);}
  }
  async function cancel() {
    if (!cancelling || inFlight.current) return;
    inFlight.current = true; setBusy(true);
    try {await api('cancel_price_adjustment', {id: cancelling.id}, true); setJobs(current => current.map(j => j.id === cancelling.id ? {...j, status: 'cancelled'} : j)); setCancelling(null); toast.success('Agendamento cancelado.');}
    catch (e) {setCancelling(null); setError(e instanceof Error ? e.message : 'Não foi possível cancelar.');}
    finally {inFlight.current = false; setBusy(false);}
  }
  return <div className="management-stack">
    <section className="admin-panel management-panel"><div className="panel-heading management-panel-heading"><span className="management-heading-icon" aria-hidden="true"><Percent size={22}/></span><div className="management-heading-copy"><h2>Reajuste de preços</h2><p>Defina o percentual, confira a prévia e escolha quando aplicar.</p></div></div>
      <div className="management-panel-body">
      <form onSubmit={generatePreview} className="management-form"><fieldset disabled={busy}>
        <div className="form-grid"><label className="field"><span>Percentual de aumento *</span><div className="percent-input"><input required inputMode="decimal" maxLength={6} value={percentage} onChange={e => setPercentage(e.target.value)} placeholder="Ex.: 3,5"/><span>%</span></div></label><div className="field"><span>Aplicar em</span><Choice label="Produtos do reajuste" value={scope} onChange={setScope} options={[{value: 'all', label: 'Todo o catálogo'}, {value: 'selected', label: 'Produtos e linhas selecionados'}]}/></div></div>
        {scope === 'selected' && <div className="adjustment-product-options" role="group" aria-label="Selecionar produtos para reajuste">{catalog.products.map(p => <label key={p.id}><Checkbox checked={selected.includes(p.id)} onCheckedChange={checked => setSelected(current => checked ? [...current, p.id] : current.filter(id => id !== p.id))}/><span>{p.name}<small>{p.has_flavors ? 'Todos os sabores desta linha' : 'Produto individual'}{!p.active ? ' · Oculto' : ''}</small></span></label>)}</div>}
        <div className="form-grid"><div className="field"><span>Quando aplicar?</span><Choice label="Momento do reajuste" value={when} onChange={setWhen} options={[{value: 'now', label: 'Agora, após confirmar'}, {value: 'scheduled', label: 'Agendar data e horário'}]}/></div>{when === 'scheduled' && <label className="field"><span>Data e horário de Brasília *</span><input required type="datetime-local" value={date} onChange={e => setDate(e.target.value)}/></label>}</div>
        <div className="adjustment-rules"><strong>Como os preços são calculados</strong><p>Preços por pacote, incluindo sabores e itens ocultos. Fardos continuam com 5 pacotes.</p><p>Arredondamento para cima em múltiplos de R$ 0,05. Preços especiais das sugestões no carrinho são mantidos.</p>{when === 'scheduled' && <p>O percentual será aplicado aos preços vigentes na data agendada, mesmo com o admin fechado. Execução em até 1 minuto após o horário.</p>}</div>
        <div className="management-form-footer"><p><Check size={17} aria-hidden="true"/><span>Confira a prévia antes de confirmar o reajuste.</span></p><button className="btn primary" type="submit" disabled={busy}>{busy ? <LoaderCircle className="spin" size={17}/> : <Percent size={17}/>}Calcular prévia</button></div>
      </fieldset></form>
      {validPreview && <div className="adjustment-preview"><div className="panel-heading"><div><h3>Prévia de {points ? percent(points) : ''}</h3><p>{validPreview.changes.length} preços por pacote serão reajustados.</p></div></div><PriceTable changes={validPreview.changes}/><button className="btn primary" disabled={busy} onClick={() => setConfirmation(true)}>{when === 'scheduled' ? <CalendarClock size={18}/> : <Check size={18}/>} {when === 'scheduled' ? 'Agendar reajuste' : 'Aplicar reajuste agora'}</button></div>}
      {error && <p className="error-box" role="alert">{error}</p>}
      </div>
    </section>
    <section className="admin-panel management-panel"><div className="panel-heading management-panel-heading"><span className="management-heading-icon" aria-hidden="true"><CalendarClock size={22}/></span><div className="management-heading-copy"><h2>Agendamentos e histórico</h2><p>Os pedidos anteriores mantêm os valores registrados na compra.</p></div><button className="btn secondary" disabled={busy || loading} onClick={() => void load(page)}><RefreshCw size={16} aria-hidden="true"/>Atualizar</button></div>
      <div className="management-panel-body management-history-body">{loading ? <p className="management-empty" role="status"><LoaderCircle className="spin" size={22}/>Carregando reajustes…</p> : !jobs.length ? <div className="management-empty"><span className="management-empty-icon" aria-hidden="true"><CalendarClock size={24}/></span><strong>Nenhum reajuste cadastrado</strong><p>Os próximos agendamentos e os reajustes aplicados aparecerão aqui.</p></div> : <div className="management-list">{jobs.map(job => <div className="adjustment-history-item" key={job.id}><div className="management-row"><div><span className={`status ${job.status === 'applied' ? 'confirmed' : job.status === 'pending' ? 'prepared' : 'cancelled'}`}>{STATUS[job.status]}</span><h3>Aumento de {percent(job.basis_points)} · {job.product_ids ? `${job.product_ids.length} produtos / linhas` : 'Todo o catálogo'}</h3><p><Clock3 size={15}/><span>{job.status === 'applied' && job.applied_at ? 'Aplicado em ' + dateTime(job.applied_at) : 'Programado para ' + dateTime(job.scheduled_at)}</span></p>{job.error && <p className="error-box">{job.error}</p>}</div>{job.status === 'pending' && <button className="btn secondary" disabled={busy} onClick={() => setCancelling(job)}><X size={16}/>Cancelar agendamento</button>}</div>{job.status === 'applied' && <details className="adjustment-audit"><summary>Ver {job.changes.length} preços alterados</summary><PriceTable changes={job.changes}/></details>}</div>)}</div>}</div>
      <div className="pagination"><button className="btn secondary" disabled={page === 0 || loading || busy} onClick={() => setPage(p => p - 1)}>Anterior</button><span>Página {page + 1}</span><button className="btn secondary" disabled={!hasMore || loading || busy} onClick={() => setPage(p => p + 1)}>Próxima</button></div>
    </section>
    <AlertDialog open={confirmation} onOpenChange={open => {if (!busy) setConfirmation(open);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{when === 'scheduled' ? 'Confirmar agendamento?' : 'Aplicar este reajuste?'}</AlertDialogTitle><AlertDialogDescription>{points && `Aumento de ${percent(points)} em ${validPreview?.changes.length ?? 0} preços por pacote. `}{scheduledAt ? `Agendado para ${dateTime(scheduledAt)}, horário de Brasília. O cálculo usará os preços vigentes nessa data.` : 'Os novos preços entrarão no catálogo imediatamente.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel><button className="btn primary" disabled={busy} onClick={() => void submit()}>{busy ? <LoaderCircle className="spin" size={17}/> : null}Confirmar reajuste</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
    <AlertDialog open={!!cancelling} onOpenChange={open => {if (!busy && !open) setCancelling(null);}}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Cancelar este agendamento?</AlertDialogTitle><AlertDialogDescription>Este reajuste deixará de ser aplicado automaticamente.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel disabled={busy}>Voltar</AlertDialogCancel><button className="btn primary" disabled={busy} onClick={() => void cancel()}>Cancelar agendamento</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}

function PriceTable({changes}: {changes: PriceChange[]}) {
  return <div className="price-table-scroll"><table className="price-adjustment-table"><thead><tr><th>Produto / sabor</th><th>Preço atual</th><th>Novo preço</th></tr></thead><tbody>{changes.map(change => <tr key={`${change.kind}:${change.id}`}><td>{change.name}</td><td>{money(change.before)}</td><td><strong>{money(change.after)}</strong></td></tr>)}</tbody></table></div>;
}
