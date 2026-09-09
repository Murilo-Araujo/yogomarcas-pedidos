'use client';
import {useEffect,useRef,useState} from 'react';
import {ChevronLeft,ChevronRight,History,RotateCcw} from 'lucide-react';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {api,Catalog,CartItem,dateTime,getCatalog,money,OrderItem,STATUS,resolveCart} from '@/lib/portal';
import {readIdentity} from '@/lib/customer';
import {repeatOrder} from '@/lib/retention';
import Disclosure from './disclosure';
type PastOrder={id:string;public_number:string;items:OrderItem[];total:number;status:string;created_at:string};
type Review=ReturnType<typeof repeatOrder>&{catalog:Catalog};
export default function CustomerHistory({open,onOpenChange,customerId,hasCart,onRepeat}:{open:boolean;onOpenChange:(v:boolean)=>void;customerId:string;hasCart:boolean;onRepeat:(items:CartItem[],catalog:Catalog)=>boolean}){
 const [orders,setOrders]=useState<PastOrder[]>([]),[page,setPage]=useState(0),[more,setMore]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(''),[review,setReview]=useState<Review|null>(null);const seq=useRef(0);
 async function load(){const n=++seq.current;setBusy(true);setError('');const token=readIdentity()?.token;
  try{const r=await api('customer_history',{page,device_token:token});if(n===seq.current){setOrders(r.orders);setMore(r.has_more);}}catch(e){if(n===seq.current)setError(e instanceof Error?e.message:'Não foi possível carregar os pedidos.');}finally{if(n===seq.current)setBusy(false);}}
 useEffect(()=>{if(open)void load();else setReview(null);return()=>{seq.current++;};},[open,page,customerId]);
 async function prepare(o:PastOrder){const n=++seq.current;setBusy(true);setError('');try{const catalog=await getCatalog();if(n===seq.current)setReview({...repeatOrder(o.items,catalog),catalog});}catch(e){if(n===seq.current)setError(e instanceof Error?e.message:'Não foi possível atualizar os preços.');}finally{if(n===seq.current)setBusy(false);}}
 const total=review?resolveCart(review.cart,review.catalog).reduce((n,i)=>n+i.unit_price*i.quantity,0):0;
 return <Sheet open={open} onOpenChange={onOpenChange}><SheetContent className="order-detail overflow-y-auto w-full sm:max-w-xl"><SheetHeader><SheetTitle>{review?'Revisar repetição':'Meus pedidos'}</SheetTitle><SheetDescription>{review?'Preços e disponibilidade atualizados.':'Consulte seu histórico ou monte um pedido novamente.'}</SheetDescription></SheetHeader><div className="detail-body">
 {error&&<div className="error-box" role="alert">{error}<button className="btn secondary" onClick={()=>void load()}>Tentar novamente</button></div>}
 {busy?<p role="status">Carregando…</p>:review?<>
 {review.cart.length>0&&<><div className="order-lines">{resolveCart(review.cart,review.catalog).map((i,index)=><div key={index}><div><strong>{i.product.name}{i.flavor?' · '+i.flavor.name:''}</strong><small>{i.quantity} × {i.mode==='bundle'?`fardo de ${i.product.bundle_units} pacotes`:i.product.package_label.toLowerCase()}</small></div><b>{money(i.unit_price*i.quantity)}</b></div>)}</div><div className="checkout-total"><span>Total atual destes itens</span><strong>{money(total)}</strong></div></>}
 {review.changed.length>0&&<p className="small muted">{review.changed.length} {review.changed.length===1?'item teve preço ou apresentação atualizados.':'itens tiveram preço ou apresentação atualizados.'}</p>}
 {review.unavailable.length>0&&<div className="error-box"><strong>Não disponíveis para repetir:</strong><ul>{review.unavailable.map((n,i)=><li key={i}>{n}</li>)}</ul></div>}
 {hasCart&&<p>Os itens serão somados ao seu carrinho atual.</p>}
 <button className="btn primary wide" disabled={!review.cart.length||!review.catalog.settings.ordering_enabled} onClick={()=>{if(onRepeat(review.cart,review.catalog)){setReview(null);onOpenChange(false);}}}><RotateCcw size={17}/>{hasCart?'Adicionar ao carrinho atual':'Usar este pedido'}</button>
 <button className="btn text-button" onClick={()=>setReview(null)}>Voltar ao histórico</button>
 </>:orders.length?<>{orders.map(o=><article className="history-card" key={o.id}><div className="history-top"><div><strong>{o.public_number}</strong><small>{dateTime(o.created_at)}</small></div><span className="status-pill">{STATUS[o.status]||o.status}</span></div><div className="history-total"><span>{o.items.length} itens</span><b>{money(o.total)}</b></div><Disclosure title="Ver itens"><div className="order-lines">{o.items.map((i,n)=><div key={n}><span>{i.quantity} × {i.name}<small className="table-sub">{i.mode==='bundle'?`Fardo com ${i.bundle_units} pacotes`:i.package_label}</small></span><b>{money(i.line_total)}</b></div>)}</div></Disclosure><button className="btn secondary wide" onClick={()=>void prepare(o)}><RotateCcw size={16}/>Repetir pedido</button></article>)}<div className="pagination"><button className="btn secondary" disabled={!page} onClick={()=>setPage(p=>p-1)}><ChevronLeft size={16}/>Anterior</button><span>{page+1}</span><button className="btn secondary" disabled={!more} onClick={()=>setPage(p=>p+1)}>Próxima<ChevronRight size={16}/></button></div></>:!error?<div className="empty-state compact"><History size={30}/><h3>Seus pedidos aparecerão aqui</h3><p>Depois do primeiro pedido, você poderá repeti-lo por este atalho.</p></div>:null}
 </div></SheetContent></Sheet>;
}
