'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {Archive,ArrowUpRight,CalendarClock,Check,ChevronLeft,ChevronRight,Clock3,LoaderCircle,MessageCircle,RefreshCw,Search,Settings2,ShoppingBag,Store,X} from 'lucide-react';
import {Tabs,TabsContent,TabsList,TabsTrigger} from '@/components/ui/tabs';
import {Sheet,SheetClose,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {Skeleton} from '@/components/ui/skeleton';
import {toast} from 'sonner';
import {api,dateTime,money} from '@/lib/portal';
import {Choice} from './controls';

type Kind='reorder'|'carts'|'frequency';
type Opportunity={customer_id:string;store_name:string;phone:string;contact_name:string;cycle_days:number|null;manual_days:number|null;cycle_source:string;last_purchase:string|null;due_at:string|null;days_overdue?:number;revision?:number;updated_at?:string;total?:number;items?:{name:string;quantity:number;mode:string;bundle_units:number;unit_price:number}[]};
type Queue={rows:Opportunity[];total:number;has_more:boolean};
const VIEWS=[
 {id:'reorder' as const,title:'Recompra',description:'Hora de repor o estoque',icon:CalendarClock},
 {id:'carts' as const,title:'Carrinhos pendentes',description:'Ajude a concluir o pedido',icon:ShoppingBag},
 {id:'frequency' as const,title:'Frequência dos clientes',description:'Ajuste os próximos lembretes',icon:Settings2},
];
const INTERVALS=[{value:'auto',label:'Calcular pelo histórico'},{value:'7',label:'1 semana · 7 dias'},{value:'14',label:'2 semanas · 14 dias'},{value:'30',label:'1 mês · 30 dias'},{value:'60',label:'2 meses · 60 dias'},{value:'90',label:'3 meses · 90 dias'},{value:'custom',label:'Personalizar intervalo'}];
const shortDate=(value:string|null|undefined)=>value?new Date(value).toLocaleDateString('pt-BR',{timeZone:'America/Sao_Paulo',day:'2-digit',month:'short',year:'numeric'}):'Sem compra confirmada';
const phoneLabel=(phone:string)=>phone.replace(/^55(\d{2})(\d{4,5})(\d{4})$/,'($1) $2-$3');
const cycleLabel=(r:Opportunity)=>r.cycle_days?`A cada ${r.cycle_days} dias`:'Não definida';
function situation(r:Opportunity,kind:Kind){
 if(kind==='carts')return 'Pedido em aberto';
 if(kind==='frequency')return r.cycle_source==='manual'?'Definida pela equipe':r.cycle_source==='history'?'Pelo histórico':'Sem frequência';
 const days=r.days_overdue||0;return days>0?`${days} ${days===1?'dia':'dias'} além do previsto`:'Reposição prevista';
}
function whatsapp(r:Opportunity,kind:Kind){
 const message=kind==='carts'?`Olá! Tudo bem? Aqui é da Yogomarcas. Precisa de ajuda para concluir o pedido da ${r.store_name}?`:`Olá! Tudo bem? Aqui é da Yogomarcas. Como está o estoque da ${r.store_name}? Podemos ajudar a montar seu próximo pedido?`;
 return `https://wa.me/${r.phone}?text=${encodeURIComponent(message)}`;
}
function QueueRow({row:r,kind,onSelect}:{row:Opportunity;kind:Kind;onSelect:()=>void}){
 return <li className={`opportunity-row opportunity-${kind}`}>
  <div className="opportunity-customer"><span className="opportunity-avatar" aria-hidden="true"><Store size={20}/></span><div><h3>{r.store_name}</h3>{r.contact_name&&<p>{r.contact_name}</p>}<span>{phoneLabel(r.phone)}</span></div></div>
  <div className="opportunity-facts"><span className={`opportunity-status ${kind==='reorder'?'amber':kind==='carts'?'teal':r.cycle_days?'purple':'neutral'}`}>{situation(r,kind)}</span><dl>
   <div><dt>{kind==='carts'?'Valor do carrinho':'Última compra'}</dt><dd className={kind==='carts'?'opportunity-value':''}>{kind==='carts'?money(r.total||0):shortDate(r.last_purchase)}</dd></div>
   <div><dt>{kind==='carts'?'Última alteração':kind==='reorder'?'Reposição prevista':'Intervalo de compra'}</dt><dd>{kind==='carts'?r.updated_at?dateTime(r.updated_at):'—':kind==='reorder'?r.due_at?shortDate(r.due_at):'—':cycleLabel(r)}</dd></div>
  </dl></div>
  <div className="opportunity-row-actions"><button type="button" className="btn secondary" onClick={onSelect} aria-label={`${kind==='frequency'?'Ajustar frequência de':'Ver detalhes de'} ${r.store_name}`}>{kind==='frequency'?'Ajustar frequência':'Ver detalhes'}<ChevronRight size={16}/></button>{kind!=='frequency'&&<a className="opportunity-contact" href={whatsapp(r,kind)} target="_blank" rel="noreferrer" aria-label={`Abrir WhatsApp de ${r.store_name}`}><MessageCircle size={17}/>Conversar<ArrowUpRight size={14}/></a>}</div>
 </li>;
}

export default function AdminRetention(){
 const [kind,setKind]=useState<Kind>('reorder'),[search,setSearch]=useState(''),[page,setPage]=useState(0);
 const [result,setResult]=useState<{key:string;queue:Queue}|null>(null),[pending,setPending]=useState<string|null>(null),[failure,setFailure]=useState<{key:string;message:string}|null>(null);
 const [selected,setSelected]=useState<Opportunity|null>(null),[days,setDays]=useState(''),[interval,setInterval]=useState('auto'),[savingAction,setSavingAction]=useState<string|null>(null);
 const saving=savingAction!==null;
 const seq=useRef(0),queryKey=JSON.stringify({kind,search,page});
 const data=result?.key===queryKey?result.queue:null,error=failure?.key===queryKey?failure.message:'';
 const busy=pending===queryKey||!data&&!error;
 const load=useCallback(async()=>{
  const n=++seq.current;setPending(queryKey);setFailure(null);
  try{const queue:Queue=await api('retention_queue',{kind,search,page},true);if(n!==seq.current)return;
   if(page>0&&!queue.rows.length&&queue.total<=page*50){setPage(Math.max(0,Math.ceil(queue.total/50)-1));return;}
   setResult({key:queryKey,queue});
  }catch(e){if(n===seq.current)setFailure({key:queryKey,message:e instanceof Error?e.message:'Não foi possível carregar as oportunidades.'});}
  finally{if(n===seq.current)setPending(null);}
 },[kind,search,page,queryKey]);
 useEffect(()=>{const t=setTimeout(()=>void load(),250);return()=>{clearTimeout(t);seq.current++;};},[load]);
 function select(row:Opportunity){const value=row.manual_days?.toString()||'';setSelected(row);setDays(value);setInterval(!value?'auto':INTERVALS.some(i=>i.value===value)?value:'custom');}
 function chooseInterval(value:string){setInterval(value);if(value==='auto')setDays('');else if(value!=='custom')setDays(value);}
 async function action(name:string,values:Record<string,unknown>){
  if(saving)return;setSavingAction(name);
  try{await api(name,values,true);setSelected(null);await load();toast.success(name==='dismiss_cart'?'Carrinho arquivado. Se o cliente alterar os itens, ele reaparece aqui.':name==='snooze_reorder'?'Lembrete adiado por 7 dias.':'Frequência salva.');}
  catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setSavingAction(null);}
 }
 function saveFrequency(e:React.FormEvent){e.preventDefault();if(!selected)return;const value=interval==='auto'?null:Number(days);if(value!==null&&(!Number.isInteger(value)||value<1||value>365)){toast.error('Informe um intervalo de 1 a 365 dias.');return;}void action('save_customer_cycle',{customer_id:selected.customer_id,cycle_days:value});}
 const view=VIEWS.find(v=>v.id===kind)!;
 const explanation=kind==='reorder'?'Clientes com reposição prevista, começando pelos que esperam há mais tempo.':kind==='carts'?'Carrinhos sem alteração há pelo menos 2 horas, começando pelos mais antigos.':'Organize quando cada cliente deve receber um novo lembrete de compra.';
 return <>
  <section className="opportunities-workspace" aria-label="Oportunidades de atendimento">
   <header className="opportunities-heading"><div><span className="opportunities-eyebrow">Relacionamento com clientes</span><h2>Oportunidades de atendimento</h2></div><button type="button" className="btn secondary" disabled={busy} onClick={()=>void load()}><RefreshCw size={16} className={busy?'spin':''}/>Atualizar</button></header>
   <Tabs value={kind} onValueChange={v=>{setKind(v as Kind);setPage(0);setSelected(null);}} className="opportunities-tabs">
    <TabsList className="opportunities-view-picker" aria-label="Tipo de oportunidade">{VIEWS.map(v=><TabsTrigger value={v.id} key={v.id}><span className={`opportunities-tab-icon ${v.id}`}><v.icon size={21}/></span><span><strong>{v.title}</strong><small>{v.description}</small></span></TabsTrigger>)}</TabsList>
    <TabsContent value={kind} className="opportunities-panel">
     <div className="opportunities-toolbar"><div className="opportunities-list-title"><h3>{view.title}{data&&!busy&&!error&&<span>{data.total}</span>}</h3><p>{explanation}</p></div><label className="opportunities-search"><Search size={18}/><input type="search" aria-label="Buscar oportunidades por loja ou telefone" maxLength={100} placeholder="Buscar loja ou telefone" value={search} onChange={e=>{setSearch(e.target.value);setPage(0);}}/>{search&&<button type="button" onClick={()=>{setSearch('');setPage(0);}} aria-label="Limpar busca"><X size={17}/></button>}</label></div>
     <div className="opportunities-results" aria-busy={busy}>
      {error?<div className="opportunities-empty" role="alert"><span className="opportunities-empty-icon"><RefreshCw size={26}/></span><h3>Não foi possível carregar</h3><p>{error}</p><button type="button" className="btn secondary" onClick={()=>void load()}>Tentar novamente</button></div>:busy?<div className="opportunities-loading" role="status"><span className="sr-only">Carregando oportunidades…</span>{[0,1,2].map(i=><div className="opportunity-placeholder" key={i} aria-hidden="true"><Skeleton className="opportunity-placeholder-avatar"/><div><Skeleton/><Skeleton/></div><Skeleton className="opportunity-placeholder-fact"/></div>)}</div>:data?.rows.length?<ul className="opportunities-list">{data.rows.map(row=><QueueRow key={row.customer_id} row={row} kind={kind} onSelect={()=>select(row)}/>)}</ul>:<div className="opportunities-empty"><span className={`opportunities-empty-icon ${kind}`}><view.icon size={28}/></span><h3>{search?'Nenhuma loja encontrada':kind==='reorder'?'Tudo em dia por aqui':kind==='carts'?'Nenhum carrinho pendente':'As próximas compras começam aqui'}</h3><p>{search?'Tente outro nome ou telefone, ou limpe a busca para ver a lista completa.':kind==='reorder'?'As lojas aparecerão quando chegar o momento previsto de repor o estoque.':kind==='carts'?'Quando um cliente deixar o carrinho sem concluir, você poderá acompanhar por aqui. Pedidos preparados para WhatsApp ficam em Pedidos.':'Os clientes cadastrados aparecerão aqui para você ajustar a frequência de compra.'}</p>{search?<button type="button" className="btn secondary" onClick={()=>{setSearch('');setPage(0);}}>Limpar busca</button>:kind==='reorder'?<button type="button" className="btn secondary" onClick={()=>{setKind('frequency');setPage(0);}}>Ajustar frequência dos clientes<ChevronRight size={16}/></button>:null}</div>}
     </div>
     {data&&!busy&&!error&&data.total>0&&<footer className="opportunities-pagination"><p><strong>{page*50+1}–{page*50+data.rows.length}</strong> de {data.total} {data.total===1?'loja':'lojas'}{search?' na busca':''}</p><div><button type="button" className="btn secondary" disabled={!page} onClick={()=>setPage(p=>p-1)} aria-label="Página anterior"><ChevronLeft size={16}/><span>Anterior</span></button><span>Página {page+1}</span><button type="button" className="btn secondary" disabled={!data.has_more} onClick={()=>setPage(p=>p+1)} aria-label="Próxima página"><span>Próxima</span><ChevronRight size={16}/></button></div></footer>}
    </TabsContent>
   </Tabs>
  </section>
  <Sheet open={!!selected} onOpenChange={open=>{if(!open&&!saving)setSelected(null);}}><SheetContent className="opportunity-sheet w-full sm:max-w-xl" showCloseButton={false} onEscapeKeyDown={e=>{if(saving)e.preventDefault();}} onPointerDownOutside={e=>{if(saving)e.preventDefault();}}>
   <SheetHeader><span className="opportunity-sheet-kicker">{view.title}</span><SheetTitle>{selected?.store_name}</SheetTitle><SheetDescription>{kind==='carts'?'Acompanhe os itens que o cliente deixou no carrinho.':'Prepare o próximo contato e ajuste o intervalo de recompra.'}</SheetDescription><SheetClose asChild><button type="button" className="opportunity-close" disabled={saving} aria-label="Fechar oportunidade"><X size={20}/></button></SheetClose></SheetHeader>
   {selected&&<><div className="opportunity-sheet-body">
    <div className="opportunity-contact-card"><span className="opportunity-avatar" aria-hidden="true"><Store size={21}/></span><div><strong>{selected.contact_name||selected.store_name}</strong><span>{phoneLabel(selected.phone)}</span></div></div>
    <section className={`opportunity-situation ${kind}`}><div><span>{kind==='carts'?<ShoppingBag size={18}/>:<CalendarClock size={18}/>}{situation(selected,kind)}</span><strong>{kind==='carts'?money(selected.total||0):cycleLabel(selected)}</strong></div><p>{kind==='carts'?`Última alteração: ${selected.updated_at?dateTime(selected.updated_at):'—'}`:selected.last_purchase?`Última compra: ${shortDate(selected.last_purchase)}`:'Nenhuma compra confirmada até o momento.'}</p></section>
    {kind==='carts'?<section className="opportunity-detail-section"><div className="opportunity-section-title"><h3>Itens do carrinho</h3><span>{selected.items?.length||0} {selected.items?.length===1?'item':'itens'}</span></div><div className="opportunity-cart-lines">{selected.items?.map((i,n)=><div key={n}><div><strong>{i.name}</strong><small>{i.quantity} × {i.mode==='bundle'?`fardo de ${i.bundle_units} pacotes`:'pacote'}</small></div><b>{money(i.quantity*i.unit_price)}</b></div>)}</div><p className="opportunity-note">Valores registrados na última alteração. Preços e disponibilidade podem mudar.</p></section>:<form id="opportunity-frequency-form" className="opportunity-detail-section" onSubmit={saveFrequency}><div className="opportunity-section-title"><h3>Frequência de compra</h3><Settings2 size={18}/></div><p className="opportunity-note">Escolha o intervalo para prever a próxima reposição desta loja.</p><fieldset disabled={saving} className="opportunity-frequency-fields"><label className="field"><span>Quando lembrar da recompra?</span><Choice label="Frequência de recompra" value={interval} onChange={chooseInterval} options={INTERVALS}/></label>{interval==='custom'&&<label className="field"><span>Intervalo em dias</span><div className="opportunity-days-input"><input type="number" inputMode="numeric" min={1} max={365} step={1} required value={days} onChange={e=>setDays(e.target.value)} placeholder="Ex.: 21"/><span>dias</span></div><small>Use um valor entre 1 e 365 dias.</small></label>}</fieldset>{interval==='auto'?<details className="opportunity-auto-help"><summary>Como o cálculo automático funciona?</summary><p>Considera os intervalos das últimas 6 datas de compra e usa o valor central. A loja precisa ter compras confirmadas ou concluídas em pelo menos 3 datas diferentes.</p></details>:<p className="opportunity-note">O intervalo definido pela equipe será usado no lugar do cálculo pelo histórico.</p>}</form>}
   </div><footer className="opportunity-sheet-footer">
    {kind!=='carts'&&<button type="submit" form="opportunity-frequency-form" className={`btn ${kind==='frequency'?'primary':'secondary'} wide`} disabled={saving}>{savingAction==='save_customer_cycle'?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>}{savingAction==='save_customer_cycle'?'Salvando…':'Salvar frequência'}</button>}
    <a className={`btn ${kind==='frequency'?'secondary':'whatsapp'} wide`} href={whatsapp(selected,kind)} target="_blank" rel="noreferrer"><MessageCircle size={18}/>Conversar no WhatsApp<ArrowUpRight size={16}/></a>
    {kind==='carts'?<><button type="button" className="btn text-button wide" disabled={saving} onClick={()=>void action('dismiss_cart',{customer_id:selected.customer_id,revision:selected.revision})}>{savingAction==='dismiss_cart'?<LoaderCircle size={16} className="spin"/>:<Archive size={16}/>}{savingAction==='dismiss_cart'?'Arquivando…':'Arquivar carrinho'}</button><p>Se o cliente alterar os itens, o carrinho reaparece.</p></>:kind==='reorder'?<button type="button" className="btn text-button wide" disabled={saving} onClick={()=>void action('snooze_reorder',{customer_id:selected.customer_id})}>{savingAction==='snooze_reorder'?<LoaderCircle size={16} className="spin"/>:<Clock3 size={16}/>}{savingAction==='snooze_reorder'?'Adiando…':'Lembrar novamente em 7 dias'}</button>:null}
   </footer></>}
  </SheetContent></Sheet>
 </>;
}
