'use client';
import type {ReactNode} from 'react';
import {Calculator} from 'lucide-react';
import {calculateProjection,Projection,SalePortion} from '@/lib/projection';
import {money,ResolvedItem} from '@/lib/portal';
import {Choice} from './controls';
import Disclosure from './disclosure';
const number=(n:number)=>n.toLocaleString('pt-BR',{maximumFractionDigits:1});
export function ProjectionValues({projection:p,controls,compact=false}:{projection:Projection;controls?:ReactNode;compact?:boolean}){
 return <>
  <div className="forecast-highlight"><span>Após o custo da base</span><strong className={p.surplus_max<0?'negative':''}><small>Até </small>{money(p.surplus_max)}</strong></div>
  {!compact&&<><p className="forecast-scenario">{p.portion.name} a {money(p.portion.price)}</p>
  <div className="forecast-key-facts"><span><b>{number(p.servings_max)}</b> porções</span><span>{p.margin_max===null?'Sem porções completas':<><b>{number(p.margin_max)}%</b> de margem</>}</span></div>
  <p className="forecast-disclaimer">Estimativa máxima. Desconta apenas a base; não é lucro líquido.</p>
  {p.excluded_cost>0&&<p className="forecast-excluded">Há itens do pedido fora desta estimativa.</p>}
  <Disclosure title={controls?'Ver cálculo e ajustar':'Ver cálculo'}>
   {controls}
   <dl className="forecast-numbers">
    <div><dt>Receita estimada</dt><dd>{money(p.revenue_max)}</dd></div>
    <div><dt>Custo das bases</dt><dd>{money(p.base_cost)}</dd></div>
    <div><dt>Rendimento considerado</dt><dd>{number(p.grams_max/1000)} kg</dd></div>
    <div><dt>Peso por porção</dt><dd>{number(p.portion.grams)} g</dd></div>
    {p.excluded_cost>0&&<div><dt>Itens fora do cálculo</dt><dd>{money(p.excluded_cost)}</dd></div>}
   </dl>
   <p className="forecast-assumption">Considera a venda de todo o rendimento estimado. Preparo e perdas podem reduzir o resultado. Embalagens, coberturas, frete e demais custos não estão incluídos.</p>
  </Disclosure></>}
 </>;
}
export default function ProjectionCard({items,portions,selected,onSelect,onEdit,compact=false}:{items:ResolvedItem[];portions:SalePortion[];selected:string;onSelect:(id:string)=>void;onEdit:()=>void;compact?:boolean}){
 const portion=portions.find(p=>p.id===selected)||portions[0];
 const projection=portion?calculateProjection(items.map(i=>({...i,yield_grams:i.product.yield_grams,yield_min_grams:i.product.yield_min_grams})),portion):null;
 if(!items.length)return null;
 return <section className={`projection-card ${compact?'compact-projection':''}`} aria-label={compact?'Lucro estimado':'Lucro'}><div className="projection-heading"><Calculator size={18}/><h3>{compact?'Lucro estimado':'Lucro'}</h3></div>
  {projection?<ProjectionValues projection={projection} compact={compact} controls={<><label className="field"><span>Simular a venda como</span><Choice label="Formato para a previsão" value={portion.id} onChange={onSelect} options={portions.map(p=>({value:p.id,label:p.name}))}/></label><button className="btn text-button" type="button" onClick={onEdit}>Editar meus preços</button></>}/>:portions.length?<p className="small muted">Estimativa indisponível para os itens deste pedido.</p>:<button className="btn secondary wide" type="button" onClick={onEdit}>Informar meus preços de venda</button>}
 </section>;
}
