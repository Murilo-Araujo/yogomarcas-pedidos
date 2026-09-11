'use client';

import {Package,Sparkles,Trash2} from 'lucide-react';
import {CartGroup,CartItem,itemName,money} from '@/lib/portal';
import {DualQuantity} from './controls';
import {SuggestionPhoto} from './cart-suggestion';

export default function CartRow({group:g,onChange,onRemove}:{group:CartGroup;onChange:(mode:CartItem['mode'],quantity:number)=>void;onRemove:()=>void}){
 const {product,flavor}=g.item,name=itemName(g.item);
 const packagePrice=g.item.unit_price/(g.item.mode==='bundle'?5:1);
 const presentation=[g.bundles?`${g.bundles} ${g.bundles===1?'fardo':'fardos'}`:'',g.packages?`${g.packages} ${g.packages===1?'pacote avulso':'pacotes avulsos'}`:''].filter(Boolean).join(' + ');
 return <article className="order-product" aria-label={name}>
  <div className="order-product-heading">
   <div className="order-product-image"><SuggestionPhoto product={product}/></div>
   <div className="order-product-identity">
    {flavor&&<p className="order-product-line">{product.name}</p>}
    <h3>{flavor?.name||product.name}</h3>
    <div className="order-product-meta">{product.package_weight_grams?<span>{product.package_weight_grams.toLocaleString('pt-BR')} g por pacote</span>:null}{g.item.upsell&&<span className="order-product-offer"><Sparkles size={12} aria-hidden="true"/>Sugestão adicionada</span>}</div>
   </div>
   <button type="button" className="order-product-remove" onClick={onRemove} aria-label={`Remover ${name}`}><Trash2 size={17}/></button>
  </div>
  <DualQuantity allowBundle={product.bundle_enabled!==false} name={name} packages={g.packages} bundles={g.bundles} packagePrice={packagePrice} onChange={onChange}/>
  <div className="order-product-total">
   <div className="order-product-equivalence"><Package size={17} aria-hidden="true"/><div><strong>{g.units.toLocaleString('pt-BR')} {g.units===1?'pacote':'pacotes'} no total</strong><small>{presentation}</small></div></div>
   <div className="order-product-amount"><span>Total do item</span><strong>{money(g.total)}</strong></div>
  </div>
 </article>;
}
