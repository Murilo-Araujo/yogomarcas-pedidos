'use client';

import {useState} from 'react';
import {ArrowRight,Check,Layers,LoaderCircle,PenLine,Plus} from 'lucide-react';
import {Dialog,DialogContent,DialogDescription,DialogHeader,DialogTitle} from '@/components/ui/dialog';
import {Switch} from '@/components/ui/switch';
import {toast} from 'sonner';
import {api,Catalog,money,moneyInput,cents} from '@/lib/portal';
import {UpsellRule} from '@/lib/retention';
import {Choice} from './controls';
import {SuggestionPhoto} from './cart-suggestion';

export default function AdminUpsellRules({catalog,onSaved}:{catalog:Catalog;onSaved:()=>Promise<unknown>}){
 const [editing,setEditing]=useState<Partial<UpsellRule>|null>(null),[price,setPrice]=useState(''),[busy,setBusy]=useState(false);
 const products=catalog.products.filter(p=>p.active),selected=products.find(p=>p.id===editing?.product_id);
 const enabled=!!catalog.settings.contextual_upsell_enabled;
 const rules=[...(catalog.upsell_rules||[])].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id));
 function edit(rule:Partial<UpsellRule>){setEditing({...rule});setPrice(moneyInput(rule.price??null));}
 async function save(e:React.FormEvent){
  e.preventDefault();if(!editing)return;
  if(!editing.trigger_product_id||!editing.product_id||editing.active&&(!selected||selected.has_flavors&&!editing.flavor_id)){toast.error('Selecione os produtos e o sabor do complemento.');return;}
  setBusy(true);try{await api('save_upsell_rule',{rule:{...editing,price:cents(price)}},true);await onSaved();setEditing(null);toast.success('Sugestão salva.');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}
 }
 async function toggle(enabled:boolean){setBusy(true);try{await api('toggle_contextual_upsell',{enabled},true);await onSaved();toast.success(enabled?'Sugestões ativadas.':'Sugestões desativadas.');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível salvar.');}finally{setBusy(false);}}
 return <>
  <section className="admin-panel suggestion-rules">
   <div className="suggestion-panel-heading"><div className="suggestion-heading-icon"><Layers size={21}/></div><div><h2>Sugestões por produto</h2><p>Escolha o complemento ideal para cada produto no pedido.</p></div><button type="button" className="btn primary" disabled={busy} onClick={()=>edit({trigger_product_id:'',product_id:'',flavor_id:null,title:'Complete seu pedido',description:'',price:null,priority:10,active:true})}><Plus size={17}/>Nova sugestão</button></div>
   <label className="suggestion-toggle suggestion-master-toggle"><div><strong>Ativar sugestões por produto</strong><p>Uma por vez, começando pela menor prioridade.</p></div><span className={`suggestion-status ${enabled?'is-active':''}`}>{enabled?'Ativas':'Pausadas'}</span><Switch aria-label="Ativar sugestões conforme o carrinho" checked={enabled} disabled={busy} onCheckedChange={toggle}/></label>
   <div className="suggestion-rule-list">{rules.map(r=>{
    const trigger=catalog.products.find(p=>p.id===r.trigger_product_id),product=catalog.products.find(p=>p.id===r.product_id),flavor=catalog.flavors.find(f=>f.id===r.flavor_id&&f.product_id===product?.id);
    const currentPrice=product?.has_flavors?flavor?.package_price:product?.package_price;
    const value=r.price??currentPrice;
    return <article className={`suggestion-rule-card ${!r.active?'is-paused':''}`} key={r.id}>
     <div className="suggestion-rule-route"><div className="suggestion-rule-product"><SuggestionPhoto product={trigger}/><div><span className="suggestion-route-label">No carrinho</span><strong>{trigger?.name||'Produto indisponível'}</strong></div></div><ArrowRight className="suggestion-route-arrow" size={20} aria-hidden="true"/><div className="suggestion-rule-product suggestion-rule-complement"><SuggestionPhoto product={product}/><div><span className="suggestion-route-label">Sugerir</span><strong>{product?.name||'Produto indisponível'}</strong>{r.flavor_id&&<small>{flavor?.name||'Sabor indisponível'}</small>}</div></div></div>
     <div className="suggestion-rule-bottom"><div className="suggestion-rule-meta"><span className={`suggestion-status ${r.active?'is-active':''}`}>{r.active?'Ativa':'Pausada'}</span><span>Prioridade {r.priority}</span><span className="suggestion-rule-price">{value?money(value):'Sem preço'}<small>{r.price!==null?'Preço especial':'Preço do catálogo'}</small></span></div><button type="button" className="btn secondary" disabled={busy} onClick={()=>edit(r)} aria-label={`Editar sugestão de ${product?.name||'complemento'} para ${trigger?.name||'produto'}`}><PenLine size={16}/>Editar</button></div>
    </article>;
   })}{!rules.length&&<div className="suggestion-rules-empty"><Layers size={28} strokeWidth={1.5}/><div><h3>Seu primeiro complemento</h3><p>Crie uma sugestão para combinar os produtos do seu catálogo.</p></div></div>}</div>
  </section>
  <Dialog open={!!editing} onOpenChange={v=>{if(!v&&!busy)setEditing(null);}}><DialogContent className="admin-dialog catalog-editor suggestion-rule-editor sm:max-w-2xl" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}} onPointerDownOutside={e=>{if(busy)e.preventDefault();}}>
   <DialogHeader><div className="editor-kicker"><Layers size={17}/>SUGESTÃO POR PRODUTO</div><DialogTitle>{editing?.id?'Editar sugestão':'Nova sugestão'}</DialogTitle><DialogDescription>Defina quando o complemento deve aparecer no carrinho.</DialogDescription></DialogHeader>
   {editing&&<form className="catalog-editor-form" onSubmit={save}><div className="catalog-editor-scroll"><fieldset className="editor-fields" disabled={busy}>
    <section className="editor-section"><div className="editor-section-heading"><h3>Combine os produtos</h3></div><label className="field"><span>Quando o carrinho tiver</span><Choice label="Produto que ativa a sugestão" disabled={busy} value={editing.trigger_product_id||'none'} onChange={v=>{const trigger_product_id=v==='none'?'':v;setEditing({...editing,trigger_product_id,...(trigger_product_id===editing.product_id?{product_id:'',flavor_id:null}:{})});}} options={[{value:'none',label:'Selecione o produto'},...products.map(p=>({value:p.id,label:p.name}))]}/></label><label className="field"><span>Sugerir este complemento</span><Choice label="Complemento sugerido" disabled={busy} value={editing.product_id||'none'} onChange={v=>setEditing({...editing,product_id:v==='none'?'':v,flavor_id:null})} options={[{value:'none',label:'Selecione o complemento'},...products.filter(p=>p.id!==editing.trigger_product_id).map(p=>({value:p.id,label:p.name}))]}/></label>{selected?.has_flavors&&<label className="field"><span>Sabor do complemento</span><Choice label="Sabor sugerido" disabled={busy} value={editing.flavor_id||'none'} onChange={v=>setEditing({...editing,flavor_id:v==='none'?null:v})} options={[{value:'none',label:'Selecione o sabor'},...catalog.flavors.filter(f=>f.product_id===selected.id&&f.active).map(f=>({value:f.id,label:f.name}))]}/></label>}</section>
    <section className="editor-section"><div className="editor-section-heading"><h3>Mensagem para o cliente</h3></div><label className="field"><span>Título</span><input required maxLength={100} value={editing.title||''} onChange={e=>setEditing({...editing,title:e.target.value})} placeholder="Ex.: Complete seu pedido"/></label><label className="field"><span>Texto de apoio (opcional)</span><textarea rows={3} maxLength={300} value={editing.description||''} onChange={e=>setEditing({...editing,description:e.target.value})} placeholder="Uma frase curta sobre o complemento."/></label></section>
    <section className="editor-section"><div className="editor-section-heading"><h3>Preço e exibição</h3></div><div className="form-grid"><label className="field"><span>Preço especial (R$, opcional)</span><input inputMode="decimal" pattern="[0-9]+([.,][0-9]{1,2})?" value={price} onChange={e=>setPrice(e.target.value)} placeholder="Preço do catálogo"/></label><label className="field"><span>Prioridade</span><input type="number" min={0} max={999} step={1} required value={editing.priority??0} onChange={e=>setEditing({...editing,priority:Number(e.target.value)})}/></label></div><p className="suggestion-field-help">Quanto menor o número, antes a sugestão será considerada.</p><label className="toggle-row"><strong>Sugestão ativa</strong><Switch disabled={busy} checked={!!editing.active} onCheckedChange={active=>setEditing({...editing,active})} aria-label="Regra ativa"/></label></section>
   </fieldset></div><footer className="editor-footer"><div className="editor-primary-actions"><button type="button" className="btn secondary" disabled={busy} onClick={()=>setEditing(null)}>Cancelar</button><button type="submit" className="btn primary" disabled={busy}>{busy?<LoaderCircle size={17} className="spin"/>:<Check size={17}/>}Salvar sugestão</button></div></footer></form>}
  </DialogContent></Dialog>
 </>;
}
