'use client';
import {Plus, Trash2} from 'lucide-react';
import {Switch} from '@/components/ui/switch';
import type {Product} from '@/lib/portal';
import {getProductPreparation} from '@/lib/line-details';
import type {Preparation} from '@/lib/catalog-management';

export default function AdminProductInformation({product, onChange}: {product: Product; onChange: (product: Product) => void}) {
  const preparation = getProductPreparation(product);
  const information = product.additional_info ?? [];
  const changePreparation = (change: Partial<Preparation>) => onChange({...product, preparation: {...(preparation ?? {title: 'Modo de preparo', steps: ['']}), ...change}});
  return <>
    <section className="editor-section">
      <div className="editor-section-heading"><h3>Modo de preparo</h3><span>Sobre {product.has_flavors ? 'esta linha' : 'este produto'}</span></div>
      <p className="editor-hint">{product.has_flavors ? 'As informações desta linha aparecem para todos os seus sabores.' : 'As informações aparecem nos detalhes do produto.'}</p>
      <label className="toggle-row"><div><strong>Exibir modo de preparo</strong><p>Cadastre as etapas e as orientações para o cliente.</p></div><Switch aria-label="Exibir modo de preparo" checked={!!preparation} onCheckedChange={checked => onChange({...product, preparation: checked ? {title: 'Modo de preparo', steps: ['']} : null})}/></label>
      {preparation && <div className="information-fields">
        <label className="field"><span>Título do preparo</span><input required maxLength={100} value={preparation.title} onChange={e => changePreparation({title: e.target.value})}/></label>
        <div className="form-grid">
          <label className="field"><span>Água por pacote (litros, opcional)</span><input type="number" min="0.01" max="1000" step="0.01" value={preparation.waterLitres ?? ''} onChange={e => changePreparation({waterLitres: e.target.value ? Number(e.target.value) : undefined})} placeholder="Ex.: 4"/></label>
          <label className="field"><span>Tempo de mistura (minutos, opcional)</span><input type="number" min="0.1" max="1000" step="0.1" value={preparation.minutes ?? ''} onChange={e => changePreparation({minutes: e.target.value ? Number(e.target.value) : undefined})} placeholder="Ex.: 2"/></label>
        </div>
        <label className="field"><span>Etapas de preparo *</span><textarea required rows={5} maxLength={20000} value={preparation.steps.join('\n')} onChange={e => changePreparation({steps: e.target.value.split('\n')})} placeholder={'Uma etapa por linha.\nEx.: Misture o conteúdo do pacote com água.\nBata até obter uma mistura homogênea.'}/><small>Escreva uma etapa por linha. Até 20 etapas.</small></label>
        <label className="field"><span>Observações de preparo (opcional)</span><textarea rows={2} maxLength={2000} value={preparation.note ?? ''} onChange={e => changePreparation({note: e.target.value})} placeholder="Orientações sobre dosagem, ingredientes ou uso na máquina."/></label>
      </div>}
    </section>
    <section className="editor-section">
      <div className="editor-section-heading"><h3>Informações adicionais</h3><span>Opcional</span></div>
      <p className="editor-hint">Inclua diferenciais, conservação, ingredientes ou informações nutricionais conforme a ficha do produto.</p>
      <div className="additional-info-editor">{information.map((item, index) => <div className="additional-info-row" key={index}>
        <label className="field"><span>Título {index + 1}</span><input required maxLength={100} value={item.title} placeholder="Ex.: Proteína" onChange={e => onChange({...product, additional_info: information.map((v, i) => i === index ? {...v, title: e.target.value} : v)})}/></label>
        <label className="field"><span>Informação</span><textarea required rows={2} maxLength={2000} value={item.text} placeholder="Ex.: Quantidade de proteína por 100 g de sorvete pronto." onChange={e => onChange({...product, additional_info: information.map((v, i) => i === index ? {...v, text: e.target.value} : v)})}/></label>
        <button type="button" className="icon-button danger-icon" aria-label={`Remover informação ${index + 1}`} onClick={() => onChange({...product, additional_info: information.filter((_, i) => i !== index)})}><Trash2 size={17}/></button>
      </div>)}</div>
      <button type="button" className="btn secondary" disabled={information.length >= 12} onClick={() => onChange({...product, additional_info: [...information, {title: '', text: ''}]})}><Plus size={16}/>Adicionar informação</button>
    </section>
  </>;
}
