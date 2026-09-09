'use client';

import {useState} from 'react';
import {Package,Plus,Sparkles} from 'lucide-react';
import {Flavor,Product,money} from '@/lib/portal';

export function SuggestionPhoto({product}:{product?:Product}){
 const [failedUrl,setFailedUrl]=useState<string|null>(null);
 return <div className="suggestion-photo">{product?.image_url&&failedUrl!==product.image_url
  ?<img src={product.image_url} alt={product.name} loading="lazy" onError={()=>setFailedUrl(product.image_url)}/>
  :<Package size={28} strokeWidth={1.5} aria-hidden="true"/>}</div>;
}

export default function CartSuggestion({title,description,product,flavor,price,onAdd,disabled=false,preview=false}:{
 title:string;description?:string;product?:Product;flavor?:Flavor;price:number|null;
 onAdd?:()=>void;disabled?:boolean;preview?:boolean;
}){
 const regularPrice=flavor?.package_price??(product?.has_flavors?null:product?.package_price);
 const weight=flavor?.package_weight_grams??product?.package_weight_grams;
 const priced=price!==null&&price>0;
 const savings=priced&&regularPrice&&regularPrice>price?regularPrice-price:0;
 return <section className="cart-suggestion" aria-label="Sugestão para seu pedido">
  <div className="suggestion-label"><Sparkles size={16} aria-hidden="true"/>Sugestão para seu pedido</div>
  <h3>{title.trim()||'Complete seu pedido'}</h3>
  {description?.trim()&&<p className="suggestion-description">{description}</p>}
  {product?<>
   <div className="suggestion-product"><SuggestionPhoto product={product}/><div className="suggestion-product-info"><strong>{product.name}</strong>{flavor&&<span>{flavor.name}</span>}<small>1 {product.package_label.toLowerCase()}{weight?` · ${weight.toLocaleString('pt-BR')} g`:''}</small></div></div>
   <div className="suggestion-purchase"><div className="suggestion-price">{savings>0&&<del aria-label={`Preço do catálogo: ${money(regularPrice!)}`}>{money(regularPrice!)}</del>}<strong>{priced?money(price):'Defina o preço'}</strong></div>{savings>0&&<span className="suggestion-saving">Economize {money(savings)}</span>}</div>
   {preview?<span className="btn primary wide suggestion-add suggestion-preview-button"><Plus size={17} aria-hidden="true"/>Adicionar ao pedido</span>:<button type="button" className="btn primary wide suggestion-add" disabled={disabled||!priced} onClick={onAdd} aria-label={`Adicionar ${product.name}${flavor?` · ${flavor.name}`:''} por ${priced?money(price):'preço pendente'}`}><Plus size={17} aria-hidden="true"/>Adicionar ao pedido</button>}
  </>:<div className="suggestion-placeholder"><Package size={32} strokeWidth={1.5} aria-hidden="true"/><strong>Escolha um complemento</strong><p>O produto selecionado aparecerá aqui.</p></div>}
 </section>;
}
