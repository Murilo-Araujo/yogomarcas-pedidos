'use client';
import {useCallback,useEffect,useRef,useState} from 'react';
import {toast} from 'sonner';
import {api,CartItem} from '@/lib/portal';
import {readIdentity} from '@/lib/customer';
const clean=(items:CartItem[])=>items.map(i=>({product_id:i.product_id,flavor_id:i.flavor_id||null,mode:i.mode,quantity:i.quantity,upsell:!!i.upsell,upsell_rule_id:i.upsell_rule_id||null}));
const signature=(items:CartItem[])=>JSON.stringify(clean(items));
type Draft={revision:number;items:CartItem[];total:number;status:string};

export function useCartSync(customerId:string|undefined,ready:boolean,cart:CartItem[],setCart:(items:CartItem[])=>void,paused:boolean){
 const [loaded,setLoaded]=useState(''),[error,setError]=useState(''),[recovery,setRecovery]=useState<CartItem[]|null>(null);
 const state=useRef({owner:'',token:'',revision:0,saved:'',generation:0});
 const queue=useRef<Promise<unknown>>(Promise.resolve());
 const current=useRef({cart,paused});current.current={cart,paused};
 const applyRemote=useCallback((draft:Draft|null)=>{const items=draft?.status==='active'?clean(draft.items):[];state.current.revision=draft?.revision||0;state.current.saved=signature(items);setCart(items);},[setCart]);
 function keepRecovery(items:CartItem[]){setRecovery(clean(items));try{localStorage.setItem('yp-cart-recovery-v1',JSON.stringify({owner:customerId,items:clean(items)}));}catch{}}
 const initialize=useCallback(async()=>{
  if(!customerId||!ready)return;
  const generation=++state.current.generation;const token=readIdentity()?.token||'';
  setLoaded('');setError('');setRecovery(null);state.current.owner=customerId;state.current.token=token;
  try{const result=await api('customer_cart',{device_token:token});if(state.current.generation!==generation)return;
   let local=null;try{local=JSON.parse(localStorage.getItem('yp-cart-sync-v1')||'null');const old=JSON.parse(localStorage.getItem('yp-cart-recovery-v1')||'null');if(old?.owner===customerId&&Array.isArray(old.items))setRecovery(old.items);}catch{}
   if(local?.owner===customerId&&local.dirty&&Array.isArray(local.items)){
    if(local.revision===(result.cart?.revision||0)&&result.cart?.status!=='prepared'){state.current.revision=local.revision;state.current.saved=signature(result.cart?.items||[]);setCart(clean(local.items));}
    else{keepRecovery(local.items);applyRemote(result.cart);}
   }else if(result.cart)applyRemote(result.cart);else{state.current.revision=0;state.current.saved=signature([]);}

   setLoaded(customerId);
  }catch(e){if(state.current.generation===generation)setError(e instanceof Error?e.message:'Não foi possível sincronizar o carrinho.');}
 },[customerId,ready,applyRemote]);
 useEffect(()=>{void initialize();return()=>{state.current.generation++;};},[initialize]);
 function saveSnapshot(items:CartItem[],generation:number){
  const task=queue.current.catch(()=>{}).then(async()=>{
   if(state.current.generation!==generation)throw new Error('O carrinho mudou. Confira os itens antes de continuar.');
   const sig=signature(items);if(state.current.saved===sig)return;
   const result=await api('customer_cart_save',{device_token:state.current.token,revision:state.current.revision,items:clean(items)});
   if(state.current.generation!==generation)throw new Error('O carrinho mudou. Confira os itens antes de continuar.');
   if(!result.saved){keepRecovery(current.current.cart);setError('O carrinho foi atualizado em outro acesso. Carregamos a versão salva; confira os itens.');state.current.generation++;applyRemote(result.cart);throw new Error('O carrinho foi atualizado em outro acesso. Carregamos a versão salva; confira os itens.');}
   state.current.revision=result.cart.revision;state.current.saved=sig;setError('');
   try{localStorage.setItem('yp-cart-sync-v1',JSON.stringify({owner:customerId,revision:state.current.revision,items:clean(current.current.cart),dirty:signature(current.current.cart)!==sig}));}catch{}
  });
  queue.current=task;return task;
 }
 const sig=signature(cart);
 useEffect(()=>{if(!customerId||loaded!==customerId)return;try{localStorage.setItem('yp-cart-sync-v1',JSON.stringify({owner:customerId,revision:state.current.revision,items:clean(cart),dirty:sig!==state.current.saved}));}catch{}},[sig,loaded,customerId]);
 useEffect(()=>{
  if(!customerId||loaded!==customerId||paused||state.current.saved===sig)return;
  const generation=state.current.generation;
  const timer=setTimeout(()=>{if(current.current.paused)return;void saveSnapshot(current.current.cart,generation).catch(e=>{if(state.current.generation===generation)setError(e.message);});},900);
  return()=>clearTimeout(timer);
 },[sig,loaded,customerId,paused]);
 async function flush(){if(loaded!==customerId)throw new Error('Aguarde a sincronização do carrinho ou tente novamente.');const n=state.current.generation;await saveSnapshot(current.current.cart,n);if(n!==state.current.generation)throw new Error('O carrinho mudou. Confira os itens antes de continuar.');return state.current.revision;}
 function close(revision:number){state.current.generation++;state.current.revision=revision;state.current.saved=signature([]);setCart([]);setError('');}
 function recover(){if(!recovery)return;setCart(recovery);setRecovery(null);setError('');try{localStorage.removeItem('yp-cart-recovery-v1');}catch{}}
 return {error,flush,close,recovery,recover,refresh:initialize,retry:()=>{if(loaded!==customerId)void initialize();else void flush().catch(e=>setError(e.message));},loaded:loaded===customerId};
}

export function useFavorites(customerId:string|undefined){
 const [ids,setIds]=useState<Set<string>>(new Set()),[pending,setPending]=useState<Set<string>>(new Set()),[ready,setReady]=useState(false);
 const generation=useRef(0),inflight=useRef(new Set<string>());
 useEffect(()=>{const n=++generation.current;setIds(new Set());setReady(false);setPending(new Set());inflight.current.clear();if(!customerId)return;
  const token=readIdentity()?.token;
  void api('customer_favorites',{device_token:token}).then(r=>{if(n===generation.current){setIds(new Set(r.flavor_ids));setReady(true);}}).catch(()=>{if(n===generation.current)toast.error('Não foi possível carregar os favoritos. Reabra o catálogo para tentar novamente.');});
  return()=>{generation.current++;};
 },[customerId]);
 async function toggle(id:string){if(!ready||inflight.current.has(id))return;const n=generation.current,selected=!ids.has(id),token=readIdentity()?.token;inflight.current.add(id);setPending(new Set(inflight.current));
  try{await api('customer_favorite',{device_token:token,flavor_id:id,selected});if(n===generation.current)setIds(previous=>{const next=new Set(previous);if(selected)next.add(id);else next.delete(id);return next;});}
  catch(e){if(n===generation.current)toast.error(e instanceof Error?e.message:'Não foi possível salvar o favorito.');}
  finally{if(n===generation.current){inflight.current.delete(id);setPending(new Set(inflight.current));}}
 }
 return {ids,pending,ready,toggle};
}
