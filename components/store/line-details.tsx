import type {ReactNode} from 'react';
import {Boxes,Clock3,Droplets,Package,Scale,Utensils} from 'lucide-react';
import type {Flavor,Product} from '@/lib/portal';
import {BUNDLE_UNITS} from '@/lib/retention';

type Preparation={waterLitres?:number;minutes?:number;title:string;steps:string[];note?:string};

// Preparation is transcribed in docs/catalog/prices-2026-09-05.json.
// Prices, weights, flavor counts and yield estimates always come from the live catalog.
function mixPreparation(waterLitres:number):Preparation{
 return {
  waterLitres,minutes:2,title:'Modo de preparo',
  steps:[
   `Misture o conteúdo de 1 pacote com ${waterLitres} litros de água.`,
   'Bata a mistura por 2 minutos.',
   'Utilize a calda na máquina, seguindo as orientações do fabricante para operação e incorporação de ar.',
  ],
 };
}

const PREPARATIONS:Record<string,Preparation>={
 'YOGO-EI':mixPreparation(4),
 'YOGO-FY':mixPreparation(3),
 'YOGO-IG':mixPreparation(4),
 'YOGO-SAB':{
  title:'Como usar com a base neutra',
  steps:[
   'Prepare a base neutra Saborize: misture 1 pacote de base com 4 litros de água e bata por 2 minutos.',
   'Adicione o saborizante à calda. A referência do catálogo é 1 colher de chá para cada 300 ml de calda.',
   'Misture e ajuste a dosagem conforme o sabor e o resultado desejado.',
  ],
  note:'A base neutra é vendida separadamente. O saborizante é utilizado na calda já preparada.',
 },
 'YOGO-SAB-BASE':{
  waterLitres:4,minutes:2,title:'Preparo da base neutra',
  steps:[
   'Misture o conteúdo de 1 pacote de base neutra com 4 litros de água.',
   'Bata a mistura por 2 minutos.',
   'Combine a calda com os saborizantes Saborize. Use como referência 1 colher de chá de saborizante para cada 300 ml de calda, ajustando a dosagem conforme o resultado desejado.',
  ],
  note:'Os saborizantes são vendidos separadamente. Opere a máquina conforme as orientações do fabricante.',
 },
};

const number=(value:number)=>value.toLocaleString('pt-BR',{maximumFractionDigits:2});

export default function LineDetails({product,flavors,children}:{product:Product;flavors:Flavor[];children:ReactNode}){
 const preparation=PREPARATIONS[product.sku];
 const activeFlavors=flavors.filter(flavor=>flavor.product_id===product.id&&flavor.active);
 const weights=(product.has_flavors?activeFlavors.map(flavor=>flavor.package_weight_grams):[product.package_weight_grams]).filter((weight):weight is number=>typeof weight==='number'&&Number.isFinite(weight)&&weight>0);
 const minWeight=weights.length?Math.min(...weights):null,maxWeight=weights.length?Math.max(...weights):null;
 const allWeightsKnown=!product.has_flavors||weights.length===activeFlavors.length;
 const weightLabel=minWeight&&maxWeight&&allWeightsKnown?(minWeight===maxWeight?`${number(minWeight)} g`:`${number(minWeight)} a ${number(maxWeight)} g, conforme o sabor`):'Consulte o peso na seleção do produto.';
 const maxYield=product.yield_grams,minYield=product.yield_min_grams;
 const showYield=product.sku!=='YOGO-SAB'&&typeof maxYield==='number'&&Number.isFinite(maxYield)&&maxYield>0;
 const yieldLabel=showYield?(minYield&&minYield>0&&minYield<maxYield?`${number(minYield/1000)} a ${number(maxYield/1000)} kg`:`Cerca de ${number(maxYield/1000)} kg`):null;

 return <div className="line-about">
  <div className="line-about-intro">
   {children}
   <div><span className="line-about-label">{product.has_flavors?'Conheça a linha':'Conheça o produto'}</span><p>{product.description}</p></div>
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
    {product.has_flavors?<div><dt>Sabores no catálogo</dt><dd>{activeFlavors.length} {activeFlavors.length===1?'opção':'opções'}</dd></div>:null}
    <div><dt>Peso por pacote</dt><dd>{weightLabel}</dd></div>
    <div><dt>Como comprar</dt><dd>{product.bundle_enabled===false?'Por pacote avulso':'Pacotes avulsos ou fardos'}</dd></div>
   </dl>
   {product.bundle_enabled!==false?<div className="line-bundle-note"><Boxes size={19} aria-hidden="true"/><span>1 fardo = <strong>{BUNDLE_UNITS} pacotes</strong>{product.has_flavors?' do mesmo sabor':''}.</span></div>:null}
  </section>
 </div>;
}
