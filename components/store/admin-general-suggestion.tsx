'use client';

import {useEffect,useRef,useState} from 'react';
import {Check,Eye,LoaderCircle,Package,PenLine,SlidersHorizontal} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import {Catalog,Settings,cents,moneyInput} from '@/lib/portal';
import {Choice} from './controls';
import CartSuggestion from './cart-suggestion';

function PriceInput({value,onChange}:{value:number|null;onChange:(value:number|null)=>void}){
 const [draft,setDraft]=useState(()=>moneyInput(value)),last=useRef(value);
 useEffect(()=>{if(value!==last.current){setDraft(moneyInput(value));last.current=value;}},[value]);
 return <input inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={draft} placeholder="Usar preço do catálogo" onChange={e=>{setDraft(e.target.value);if(e.target.value===''||/^[0-9]+([.,][0-9]{0,2})?$/.test(e.target.value)){last.current=cents(e.target.value);onChange(last.current);}}} onBlur={()=>{if(draft===''||/^[0-9]+([.,][0-9]{0,2})?$/.test(draft))setDraft(moneyInput(cents(draft)));}}/>;
}

export default function AdminGeneralSuggestion({catalog,settings:s,onChange,onSave,busy}:{catalog:Catalog;settings:Settings;onChange:(settings:Settings)=>void;onSave:(e:React.FormEvent)=>void;busy:boolean}){
 const product=catalog.products.find(p=>p.id===s.upsell_product_id);
 const flavor=catalog.flavors.find(f=>f.id===s.upsell_flavor_id&&f.product_id===product?.id);
 const regularPrice=product?.has_flavors?flavor?.package_price:product?.package_price;
 const price=s.upsell_price??regularPrice??null;
 const ready=!!product?.active&&product.available&&(!product.has_flavors||!!flavor?.active&&flavor.available)&&!!regularPrice&&!!price&&price<=regularPrice;
 return <section className="suggestion-general admin-panel">
  <div className="suggestion-panel-heading"><div className="suggestion-heading-icon"><SlidersHorizontal size={21}/></div><div><h2>Sugestão geral</h2><p>Aparece quando nenhuma sugestão por produto se aplica.</p></div><span className={`suggestion-status ${s.upsell_enabled?'is-active':''}`}>{s.upsell_enabled?'Ativa':'Pausada'}</span></div>
  <div className="suggestion-general-layout">
   <form className="suggestion-general-form" onSubmit={onSave}>
    <fieldset className="suggestion-form-fields" disabled={busy}>
     <label className="suggestion-toggle"><div><strong>Exibir no carrinho</strong><p>O cliente escolhe se deseja adicionar.</p></div><Switch checked={s.upsell_enabled} disabled={busy} onCheckedChange={upsell_enabled=>onChange({...s,upsell_enabled})} aria-label="Mostrar sugestão geral no carrinho"/></label>
     <section className="suggestion-form-section"><h3><Package size={17}/>Produto e preço</h3><div className="form-grid">
      <label className="field"><span>Produto sugerido</span><Choice label="Produto da sugestão geral" disabled={busy} value={s.upsell_product_id||'none'} onChange={v=>onChange({...s,upsell_product_id:v==='none'?null:v,upsell_flavor_id:null})} options={[{value:'none',label:'Selecione um produto'},...catalog.products.map(p=>({value:p.id,label:p.name+(!p.active?' (oculto)':'')}))]}/></label>
      <label className="field"><span>Preço especial (R$)</span><PriceInput value={s.upsell_price} onChange={upsell_price=>onChange({...s,upsell_price})}/></label>
     </div>{product?.has_flavors&&<label className="field"><span>Sabor sugerido</span><Choice label="Sabor da sugestão geral" disabled={busy} value={s.upsell_flavor_id||'none'} onChange={v=>onChange({...s,upsell_flavor_id:v==='none'?null:v})} options={[{value:'none',label:'Selecione o sabor'},...catalog.flavors.filter(f=>f.product_id===product.id&&f.active&&f.available).map(f=>({value:f.id,label:f.name}))]}/></label>}<p className="suggestion-field-help">Deixe o preço em branco para usar o valor atual do catálogo.</p></section>
     <section className="suggestion-form-section"><h3><PenLine size={17}/>Mensagem para o cliente</h3><label className="field"><span>Título</span><input maxLength={100} value={s.upsell_title} onChange={e=>onChange({...s,upsell_title:e.target.value})} placeholder="Ex.: Complete seu pedido"/></label><label className="field"><span>Texto de apoio (opcional)</span><textarea rows={3} maxLength={300} value={s.upsell_description} onChange={e=>onChange({...s,upsell_description:e.target.value})} placeholder="Uma frase curta sobre o complemento."/></label></section>
    </fieldset>
    <footer className="suggestion-form-footer"><button type="submit" className="btn primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>}Salvar sugestão</button></footer>
   </form>
   <aside className="suggestion-preview"><div className="suggestion-preview-title"><Eye size={17}/><strong>Prévia no carrinho</strong></div><CartSuggestion title={s.upsell_title} description={s.upsell_description} product={product} flavor={flavor} price={product?.has_flavors&&!flavor?null:price} preview/><p className="suggestion-preview-note">{!s.upsell_enabled?'A sugestão está pausada. Ative e salve para exibir no carrinho.':!ready?'Confira o produto, o sabor, a disponibilidade e o preço para exibir a sugestão.':'Exibida para quem ainda não adicionou este item ao pedido.'}</p></aside>
  </div>
 </section>;
}
