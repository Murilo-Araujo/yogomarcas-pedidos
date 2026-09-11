import type {ReactNode} from 'react';
import {Boxes,Clock3,Droplets,Package,Scale,Utensils} from 'lucide-react';
import type {Flavor,Product} from '@/lib/portal';
import {getLineDetails, type LineDetailsData} from '@/lib/line-details';

export default function LineDetails({product,flavors,children}:{product:Product;flavors:Flavor[];children:ReactNode}){
 return <LineDetailsContent details={getLineDetails(product,flavors)}>{children}</LineDetailsContent>;
}

export function LineDetailsContent({details,children}:{details:LineDetailsData;children:ReactNode}){
 const {preparation,yieldLabel,weightLabel}=details;
 return <div className="line-about">
  <div className="line-about-intro">
   {children}
   <div><span className="line-about-label">{details.hasFlavors?'Conheça a linha':'Conheça o produto'}</span><p>{details.description}</p></div>
  </div>

  {preparation?.waterLitres&&preparation.minutes?<dl className="line-prep-facts" aria-label="Preparo por pacote">
   <div><Droplets size={21} aria-hidden="true"/><div><dt>Água por pacote</dt><dd>{preparation.waterLitres} <span>litros</span></dd></div></div>
   <div><Clock3 size={21} aria-hidden="true"/><div><dt>Tempo de mistura</dt><dd>{preparation.minutes} <span>minutos</span></dd></div></div>
  </dl>:null}

  {preparation?<section className="line-preparation" aria-label={preparation.title}>
   <h3><Utensils size={18} aria-hidden="true"/>{preparation.title}</h3>
   <ol role="list">{preparation.steps.map((step,index)=><li key={step}><span className="line-step-number" aria-hidden="true">{index+1}</span><p>{step}</p></li>)}</ol>
   {preparation.note?<p className="line-preparation-note">{preparation.note}</p>:null}
  </section>:null}

  {yieldLabel?<section className="line-yield" aria-label="Rendimento estimado">
   <Scale size={22} aria-hidden="true"/>
   <div><h3>Rendimento estimado</h3><strong>{yieldLabel} <span>de calda por pacote</span></strong><p>Referência para planejamento. O rendimento varia conforme o sabor e as condições de preparo e operação.</p></div>
  </section>:null}

  <section className="line-packaging" aria-label="Embalagem e opções">
   <h3><Package size={18} aria-hidden="true"/>Embalagem e opções</h3>
   <dl>
    {details.hasFlavors?<div><dt>Sabores no catálogo</dt><dd>{details.flavorCount} {details.flavorCount===1?'opção':'opções'}</dd></div>:null}
    <div><dt>Peso por pacote</dt><dd>{weightLabel}</dd></div>
    <div><dt>Como comprar</dt><dd>{!details.bundleEnabled?'Por pacote avulso':'Pacotes avulsos ou fardos'}</dd></div>
   </dl>
   {details.bundleEnabled?<div className="line-bundle-note"><Boxes size={19} aria-hidden="true"/><span>1 fardo = <strong>{details.bundleUnits} pacotes</strong>{details.hasFlavors?' do mesmo sabor':''}.</span></div>:null}
  </section>
 </div>;
}
