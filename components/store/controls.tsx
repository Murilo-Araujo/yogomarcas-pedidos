'use client';
import {Select,SelectContent,SelectItem,SelectTrigger,SelectValue} from '@/components/ui/select';
import {useId} from 'react';
import {Boxes,Minus,Package,Plus} from 'lucide-react';
import {money} from '@/lib/portal';
export function Choice({value,onChange,options,label,disabled=false}:{value:string;onChange:(v:string)=>void;options:{value:string;label:string}[];label:string;disabled?:boolean}){return <Select value={value} onValueChange={onChange} disabled={disabled}><SelectTrigger aria-label={label} className="choice"><SelectValue placeholder={label}/></SelectTrigger><SelectContent position="popper" align="start" sideOffset={6} collisionPadding={12} className="choice-menu">{options.map(o=><SelectItem className="choice-menu-item" key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>;}
export function Quantity({value,onChange,max=999}:{value:number;onChange:(n:number)=>void;max?:number}){return <div className="quantity"><button type="button" aria-label="Diminuir quantidade" onClick={()=>onChange(Math.max(1,value-1))} disabled={value<=1}><Minus size={15}/></button><input aria-label="Quantidade" type="number" min={1} max={max} value={value} onChange={e=>onChange(Math.max(1,Math.min(max,Number(e.target.value)||1)))}/><button type="button" aria-label="Aumentar quantidade" onClick={()=>onChange(Math.min(max,value+1))} disabled={value>=max}><Plus size={15}/></button></div>;}
export function Brand(){return <a href="/" className="brand" aria-label="Yogomarcas, catálogo"><img src="/assets/logo.png" alt="Yogomarcas" width="191" height="44"/></a>;}

export function DualQuantity({name,packages,bundles,onChange,disabled=false,allowBundle=true,packagePrice}:{name:string;packages:number;bundles:number;allowBundle?:boolean;onChange:(mode:'package'|'bundle',quantity:number)=>void;disabled?:boolean;packagePrice?:number|null}){
 const id=useId(),showPrices=packagePrice!==undefined;
 return <div className={`dual-quantity${showPrices?' dual-quantity-priced':''}`}>
  {(allowBundle?(['bundle','package'] as const):(['package'] as const)).map(mode=>{
   const isBundle=mode==='bundle',value=isBundle?bundles:packages,label=isBundle?'Fardos':'Pacotes';
   const price=packagePrice?packagePrice*(isBundle?5:1):null;
   const descriptionId=`${id}-${mode}-description`;
   const change=(n:number)=>onChange(mode,Math.max(0,Math.min(999,Math.floor(n)||0)));
   return <div className="quantity-field" data-selected={value>0} key={mode}>
    {showPrices?<>
     <div className="quantity-option-title">{isBundle?<Boxes size={18} aria-hidden="true"/>:<Package size={18} aria-hidden="true"/>}<span>{label}</span></div>
     <div className="quantity-option-description" id={descriptionId}>
      <span className="quantity-option-unit">{isBundle?'5 pacotes cada':'1 pacote avulso'}</span>
      <strong className="quantity-option-price">{price?money(price):'Sob consulta'}{price&&<span>/{isBundle?'fardo':'pacote'}</span>}</strong>
     </div>
    </>:<span>{label}</span>}
    <div className="quantity">
     <button type="button" aria-label={`Diminuir ${label.toLowerCase()} de ${name}`} disabled={disabled||value===0} onClick={()=>change(value-1)}><Minus size={15}/></button>
     <input type="number" inputMode="numeric" min={0} max={999} step={1} aria-label={`${label} de ${name}`} aria-describedby={showPrices?descriptionId:undefined} disabled={disabled} value={value} onChange={e=>change(Number(e.target.value))}/>
     <button type="button" aria-label={`Adicionar ${label.toLowerCase()} de ${name}`} disabled={disabled||value===999} onClick={()=>change(value+1)}><Plus size={15}/></button>
    </div>
   </div>;
  })}
 </div>;
}
