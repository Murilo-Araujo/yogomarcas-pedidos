'use client';
import {useMemo,useState} from 'react';
import {Heart,Minus,Plus,Search,ShoppingBag,X} from 'lucide-react';
import {Flavor,money,normalizeSearch,Product,track} from '@/lib/portal';
import {DualQuantity} from './controls';
export default function FlavorPicker({product,flavors,enabled,onAdd,initialSearch='',favorites=new Set<string>(),favoritePending=new Set<string>(),favoritesReady=false,onFavorite}:{product:Product;flavors:Flavor[];enabled:boolean;onAdd:(items:{flavor:Flavor;quantity:number;mode:'package'|'bundle'}[])=>boolean;initialSearch?:string;favorites?:Set<string>;favoritePending?:Set<string>;favoritesReady?:boolean;onFavorite?:(id:string)=>void}){
 const [search,setSearch]=useState(initialSearch),[quantities,setQuantities]=useState<Record<string,{package:number;bundle:number}>>({});
 const list=useMemo(()=>flavors.filter(f=>f.product_id===product.id&&f.active),[flavors,product.id]);
 const selected=list.flatMap(flavor=>(['bundle','package'] as const).map(mode=>({flavor,mode,quantity:quantities[flavor.id]?.[mode]||0}))).filter(i=>i.quantity>0);
 const total=selected.reduce((s,i)=>s+i.quantity*(i.flavor.package_price||0)*(i.mode==='bundle'?5:1),0);
 const totalQuantity=selected.reduce((s,i)=>s+i.quantity*(i.mode==='bundle'?5:1),0);
 const visible=list.filter(f=>normalizeSearch(`${f.name} ${f.sku||''}`).includes(normalizeSearch(search))).sort((a,b)=>Number(favorites.has(b.id))-Number(favorites.has(a.id)));
 function quantity(f:Flavor,mode:'package'|'bundle',value:number){if(value>0&&!quantities[f.id]?.package&&!quantities[f.id]?.bundle)track('product_click',product.id,true,f.id);setQuantities(q=>({...q,[f.id]:{package:q[f.id]?.package||0,bundle:q[f.id]?.bundle||0,[mode]:value}}));}
 return <section className="flavor-picker" aria-label={`Sabores de ${product.name}`}>
  <p className="small muted">1 fardo = 5 pacotes do mesmo sabor.</p>
  <label className="search-box flavor-search"><Search size={18}/><input aria-label="Buscar sabor nesta linha" placeholder="Buscar sabor" value={search} onChange={e=>setSearch(e.target.value)}/>{search&&<button type="button" aria-label="Limpar busca de sabor" onClick={()=>setSearch('')}><X size={16}/></button>}</label>
  <div className="flavor-list-heading"><span>Sabores</span><span>Preço por pacote</span></div>
  <div className="flavor-list">{visible.map(f=>{
   const price=f.package_price,available=enabled&&product.available&&f.available&&!!price;
   return <div className={`flavor-row ${quantities[f.id]?.package||quantities[f.id]?.bundle?'picked':''}`} key={f.id}>
    <div className="flavor-info"><div className="flavor-name-row">{onFavorite&&<button type="button" className={`favorite-button ${favorites.has(f.id)?'selected':''}`} aria-label={`${favorites.has(f.id)?'Remover':'Salvar'} ${f.name} ${favorites.has(f.id)?'dos':'nos'} favoritos`} aria-pressed={favorites.has(f.id)} disabled={!favoritesReady||favoritePending.has(f.id)} onClick={()=>onFavorite(f.id)}><Heart size={17} fill={favorites.has(f.id)?'currentColor':'none'}/></button>}<strong>{f.name}</strong></div><small>{f.package_weight_grams?`${f.package_weight_grams.toLocaleString('pt-BR')} g`:'Peso a confirmar'}{!f.available?' · Indisponível':''}</small></div>
    <div className="flavor-row-controls"><b>{price?money(price):'Sob consulta'}</b><DualQuantity name={f.name} packages={quantities[f.id]?.package||0} bundles={quantities[f.id]?.bundle||0} disabled={!available} onChange={(mode,n)=>quantity(f,mode,n)}/></div>
   </div>;
  })}{!visible.length&&<p className="flavor-empty">Nenhum sabor encontrado. Tente outro nome.</p>}</div>
  {selected.length>0&&<div className="flavor-selection-footer"><div aria-live="polite"><span>{totalQuantity} {totalQuantity===1?'pacote':'pacotes'} no total</span><b>{money(total)}</b></div><button className="btn primary wide" disabled={!enabled||selected.some(i=>!i.flavor.available||!i.flavor.package_price)} onClick={()=>{if(onAdd(selected))setQuantities({});}}><ShoppingBag size={18}/>Adicionar ao pedido</button></div>}
 </section>;
}
