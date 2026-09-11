'use client';

import {useRef,useState} from 'react';
import {Check,Pencil,Sparkles,Trash2} from 'lucide-react';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
import {CartGroup,CartItem,itemName,money} from '@/lib/portal';
import {DualQuantity} from './controls';

export default function CartRow({group:g,onChange,onRemove}:{group:CartGroup;onChange:(mode:CartItem['mode'],quantity:number)=>void;onRemove:()=>void}){
 const [editing,setEditing]=useState(false);
 const editButton=useRef<HTMLButtonElement>(null);
 const {product}=g.item,name=itemName(g.item);
 const packagePrice=g.item.unit_price/(g.item.mode==='bundle'?5:1);
 const presentation=[g.bundles?`${g.bundles} ${g.bundles===1?'fardo':'fardos'} de 5 pacotes`:'',g.packages?`${g.packages} ${g.packages===1?'pacote avulso':'pacotes avulsos'}`:''].filter(Boolean).join(' + ');
 function finishEditing(){setEditing(false);editButton.current?.focus();}
 return <Collapsible open={editing} onOpenChange={setEditing} asChild>
  <article className="order-review-item" aria-label={name}>
   <div className="order-review-row">
    <div className="order-review-copy"><h3>{name}</h3><p>{presentation}</p></div>
    <strong className="order-review-price">{money(g.total)}</strong>
    <CollapsibleTrigger asChild><button ref={editButton} type="button" className="order-review-edit" aria-label={`${editing?'Fechar edição':'Editar quantidades'} de ${name}`} title={editing?'Fechar edição':'Editar quantidades'}><Pencil size={17} aria-hidden="true"/></button></CollapsibleTrigger>
   </div>
   <CollapsibleContent className="order-product order-review-editor">
    <div className="order-review-editor-heading"><strong>Ajuste as quantidades</strong>{product.package_weight_grams?<span>{product.package_weight_grams.toLocaleString('pt-BR')} g por pacote</span>:null}</div>
    {g.item.upsell&&<span className="order-product-offer"><Sparkles size={13} aria-hidden="true"/>Sugestão adicionada</span>}
    <DualQuantity allowBundle={product.bundle_enabled!==false} name={name} packages={g.packages} bundles={g.bundles} packagePrice={packagePrice} onChange={onChange}/>
    <p className="order-review-unit-total" aria-live="polite">{g.units.toLocaleString('pt-BR')} {g.units===1?'pacote':'pacotes'} no total{product.has_flavors?' deste sabor':''}</p>
    <div className="order-review-editor-actions">
     <button type="button" className="order-review-remove" onClick={onRemove} aria-label={`Remover ${name}`}><Trash2 size={16} aria-hidden="true"/>Remover item</button>
     <button type="button" className="btn secondary order-review-done" onClick={finishEditing}><Check size={16} aria-hidden="true"/>Concluir edição</button>
    </div>
   </CollapsibleContent>
  </article>
 </Collapsible>;
}
