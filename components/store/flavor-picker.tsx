'use client';
import {useMemo,useState} from 'react';
import {Boxes,Heart,Package,Search,ShoppingBag,X} from 'lucide-react';
import {Flavor,money,normalizeSearch,Product,track} from '@/lib/portal';
import {DualQuantity} from './controls';
export default function FlavorPicker({product,flavors,enabled,onAdd,initialSearch='',favorites=new Set<string>(),favoritePending=new Set<string>(),favoritesReady=false,onFavorite}:{product:Product;flavors:Flavor[];enabled:boolean;onAdd:(items:{flavor:Flavor;quantity:number;mode:'package'|'bundle'}[])=>boolean;initialSearch?:string;favorites?:Set<string>;favoritePending?:Set<string>;favoritesReady?:boolean;onFavorite?:(id:string)=>void}){
 const [search,setSearch]=useState(initialSearch),[quantities,setQuantities]=useState<Record<string,{package:number;bundle:number}>>({});
 const list=useMemo(()=>flavors.filter(f=>f.product_id===product.id&&f.active),[flavors,product.id]);
 const allowBundle=product.bundle_enabled!==false;
 const selected=list.flatMap(flavor=>(allowBundle?(['bundle','package'] as const):(['package'] as const)).map(mode=>({flavor,mode,quantity:quantities[flavor.id]?.[mode]||0}))).filter(i=>i.quantity>0);
 const total=selected.reduce((s,i)=>s+i.quantity*(i.flavor.package_price||0)*(i.mode==='bundle'?5:1),0);
 const totalQuantity=selected.reduce((s,i)=>s+i.quantity*(i.mode==='bundle'?5:1),0);
 const visible=list.filter(f=>normalizeSearch(`${f.name} ${f.sku||''}`).includes(normalizeSearch(search))).sort((a,b)=>Number(favorites.has(b.id))-Number(favorites.has(a.id)));
 function quantity(f:Flavor,mode:'package'|'bundle',value:number){if(mode==='bundle'&&!allowBundle)return;if(value>0&&!quantities[f.id]?.package&&!quantities[f.id]?.bundle)track('product_click',product.id,true,f.id);setQuantities(q=>({...q,[f.id]:{package:q[f.id]?.package||0,bundle:q[f.id]?.bundle||0,[mode]:value}}));}
 return <section className="flavor-picker" aria-label={`Sabores de ${product.name}`}>
  <div className="flavor-purchase-guide">{allowBundle?<Boxes size={22} aria-hidden="true"/>:<Package size={22} aria-hidden="true"/>}<div><strong>{allowBundle?'1 fardo = 5 pacotes':'Venda por pacote'}</strong><p>{allowBundle?'Do mesmo sabor. Você também pode pedir pacotes avulsos.':'Esta linha está disponível apenas em pacotes avulsos.'}</p></div></div>
  <label className="search-box flavor-search"><Search size={18}/><input aria-label="Buscar sabor nesta linha" placeholder="Buscar sabor" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Limpar busca de sabor" onClick={()=>setSearch('')}><X size={16}/></button>}</label>
  <div className="flavor-list-heading"><h3>Sabores</h3><span>{visible.length} {visible.length===1?'opção':'opções'}</span></div>
  <div className="flavor-list">{visible.map(f=>{
   const price=f.package_price,available=enabled&&product.available&&f.available&&!!price;
   const packages=quantities[f.id]?.package||0,bundles=allowBundle?quantities[f.id]?.bundle||0:0,units=packages+bundles*5;
   const selection=[bundles?`${bundles} ${bundles===1?'fardo':'fardos'}`:'',packages?`${packages} ${packages===1?'pacote avulso':'pacotes avulsos'}`:''].filter(Boolean).join(' + ');
   return <div className={`flavor-row ${units?'picked':''}`} key={f.id}>
    <div className="flavor-card-heading"><div className="flavor-info"><strong>{f.name}</strong><small>{f.package_weight_grams?`${f.package_weight_grams.toLocaleString('pt-BR')} g por pacote`:'Peso por pacote a confirmar'}{!f.available||!product.available?' · Indisponível':''}</small></div>{onFavorite&&<button type="button" className={`favorite-button ${favorites.has(f.id)?'selected':''}`} aria-label={`${favorites.has(f.id)?'Remover':'Salvar'} ${f.name} ${favorites.has(f.id)?'dos':'nos'} favoritos`} aria-pressed={favorites.has(f.id)} disabled={!favoritesReady||favoritePending.has(f.id)} onClick={()=>onFavorite(f.id)}><Heart size={18} fill={favorites.has(f.id)?'currentColor':'none'}/></button>}</div>
    <DualQuantity allowBundle={allowBundle} name={f.name} packagePrice={price??null} packages={packages} bundles={bundles} disabled={!available} onChange={(mode,n)=>quantity(f,mode,n)}/>
    {units>0&&<div className="flavor-row-total" aria-live="polite" aria-atomic="true"><div><span>{selection}</span>{bundles>0&&<small>{units} pacotes no total</small>}</div><div><span>Subtotal</span><strong>{money(units*(price||0))}</strong></div></div>}
   </div>;
  })}{!visible.length&&<p className="flavor-empty">Nenhum sabor encontrado. Tente outro nome.</p>}</div>
  {selected.length>0&&<div className="flavor-selection-footer"><div aria-live="polite"><span>{totalQuantity} {totalQuantity===1?'pacote':'pacotes'} no total</span><b>{money(total)}</b></div><button className="btn primary wide" disabled={!enabled||selected.some(i=>!i.flavor.available||!i.flavor.package_price)} onClick={()=>{if(onAdd(selected))setQuantities({});}}><ShoppingBag size={18}/>Adicionar ao pedido</button></div>}
 </section>;
}
