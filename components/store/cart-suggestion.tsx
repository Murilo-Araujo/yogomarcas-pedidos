'use client';

import {useState} from 'react';
import {Package,Plus,Sparkles} from 'lucide-react';
import {Flavor,Product,money} from '@/lib/portal';
import {DualQuantity} from './controls';

export function SuggestionPhoto({product}:{product?:Product}){
 const [failedUrl,setFailedUrl]=useState<string|null>(null);
 return <div className="suggestion-photo">{product?.image_url&&failedUrl!==product.image_url
  ?<img src={product.image_url} alt={product.name} loading="lazy" onError={()=>setFailedUrl(product.image_url)}/>
  :<Package size={28} strokeWidth={1.5} aria-hidden="true"/>}</div>;
}

export default function CartSuggestion({title,description,product,flavor,price,onAdd,disabled=false,preview=false}:{
 title:string;description?:string;product?:Product;flavor?:Flavor;price:number|null;
 onAdd?:(selection:{packages:number;bundles:number})=>void;disabled?:boolean;preview?:boolean;
}){
 const [packages,setPackages]=useState(1),[bundles,setBundles]=useState(0);
 const allowBundle=product?.bundle_enabled!==false,selectedBundles=allowBundle?bundles:0;
 const units=packages+selectedBundles*5,total=units*(price||0);
 const regularPrice=flavor?.package_price??(product?.has_flavors?null:product?.package_price);
 const weight=flavor?.package_weight_grams??product?.package_weight_grams;
 const priced=price!==null&&price>0;
 const savings=priced&&regularPrice&&regularPrice>price?regularPrice-price:0;
 return <section className="cart-suggestion" aria-label="Sugestão para seu pedido">
  <div className="suggestion-label"><Sparkles size={16} aria-hidden="true"/>Sugestão para seu pedido</div>
  <h3>{title.trim()||'Complete seu pedido'}</h3>
  {description?.trim()&&<p className="suggestion-description">{description}</p>}
  {product?<>
   <div className="suggestion-product"><SuggestionPhoto product={product}/><div className="suggestion-product-info"><strong>{product.name}</strong>{flavor&&<span>{flavor.name}</span>}<small>{weight?`${weight.toLocaleString('pt-BR')} g por pacote`:product.package_label}</small></div></div>
   {savings>0&&<div className="suggestion-discount"><del>{money(regularPrice!)} por pacote</del><span className="suggestion-saving">Economize {money(savings)} por pacote</span></div>}
   <DualQuantity name={`${product.name}${flavor?` · ${flavor.name}`:''} na sugestão`} packages={packages} bundles={selectedBundles} allowBundle={allowBundle} packagePrice={price} disabled={disabled||preview||!priced} onChange={(mode,value)=>mode==='bundle'?setBundles(value):setPackages(value)}/>
   <div className="suggestion-selection-total" aria-live="polite"><div><span>Total da sugestão</span><small>{units?`${units} ${units===1?'pacote':'pacotes'} no total`:'Escolha uma quantidade'}</small></div><strong>{money(total)}</strong></div>
   {preview?<span className="btn primary wide suggestion-add suggestion-preview-button"><Plus size={17} aria-hidden="true"/>Adicionar ao pedido</span>:<button type="button" className="btn primary wide suggestion-add" disabled={disabled||!priced||units===0} onClick={()=>onAdd?.({packages,bundles:selectedBundles})} aria-label={`Adicionar ${units} ${units===1?'pacote':'pacotes'} de ${product.name}${flavor?` · ${flavor.name}`:''} por ${money(total)}`}><Plus size={17} aria-hidden="true"/>Adicionar ao pedido<span>{money(total)}</span></button>}
  </>:<div className="suggestion-placeholder"><Package size={32} strokeWidth={1.5} aria-hidden="true"/><strong>Escolha um complemento</strong><p>O produto selecionado aparecerá aqui.</p></div>}
 </section>;
}
