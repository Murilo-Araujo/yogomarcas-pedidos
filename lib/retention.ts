import type {CartItem, Catalog, OrderItem} from './portal';

export const BUNDLE_UNITS = 5;
export const bundlePrice = (price:number|null|undefined) => price == null ? null : price * BUNDLE_UNITS;

/** Use immutable order snapshots, never today's catalogue, for quotations. */
export function orderMessage(o:any){
 const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
 const groups=new Map<string,{code:string;units:number;total:number}>();
 for(const i of o.items){
  const key=`${i.product_id}:${i.flavor_id||''}`;
  const code=i.internal_code||((i.flavor_id&&i.flavor_name)?`${i.sku} · ${i.flavor_name}`:i.sku)||i.name;
  const group=groups.get(key)||{code,units:0,total:0};
  group.units+=i.units??i.quantity*(i.mode==='bundle'?i.bundle_units:1);
  group.total+=i.line_total;groups.set(key,group);
 }
 return [`Olá! Gostaria de fazer o pedido ${o.public_number}.`,'',`Empresa: ${o.company}`,`Responsável: ${o.customer_name}`,`WhatsApp: ${o.phone}`,`Cidade: ${o.city}/${o.state}`,o.customer_code?`Código do cliente: ${o.customer_code}`:'','',...[...groups.values()].map(i=>`${i.code} — ${i.units} ${i.units===1?'pacote':'pacotes'} — ${money(i.total)}`),'',`Subtotal dos produtos: ${money(o.total)}`,o.notes?`Observações: ${o.notes}`:'','Frete, prazo, disponibilidade e pagamento a confirmar.'].join('\n');
}

export type UpsellRule = {id:string;trigger_product_id:string;product_id:string;flavor_id:string|null;title:string;description:string;price:number|null;priority:number;active:boolean};
export type CartOffer = {product_id:string;flavor_id:string|null;rule_id:string|null;title:string;description:string;price:number};

/** Same eligibility and price calculation in the storefront and order endpoint. */
export function cartOffer(catalog:Catalog, cart:CartItem[]):CartOffer|null {
 const regular=cart.filter(i=>!i.upsell&&i.quantity>0);
 if(!regular.length)return null;
 const candidates:CartOffer[]=[];
 const s=catalog.settings;
 if(s.contextual_upsell_enabled){
  for(const rule of [...(catalog.upsell_rules||[])].sort((a,b)=>a.priority-b.priority||a.id.localeCompare(b.id))){
   if(rule.active&&regular.some(i=>i.product_id===rule.trigger_product_id))candidates.push({...rule,rule_id:rule.id,price:rule.price as number});
  }
 }
 if(s.upsell_enabled&&s.upsell_product_id)candidates.push({product_id:s.upsell_product_id,flavor_id:s.upsell_flavor_id||null,rule_id:null,title:s.upsell_title,description:s.upsell_description,price:s.upsell_price as number});
 for(const offer of candidates){
  const p=catalog.products.find(p=>p.id===offer.product_id&&p.active&&p.available);
  if(!p||regular.some(i=>i.product_id===p.id&&(i.flavor_id||null)===(offer.flavor_id||null)))continue;
  const f=catalog.flavors.find(f=>f.id===offer.flavor_id&&f.product_id===p.id&&f.active&&f.available);
  if(p.has_flavors?!f:!!offer.flavor_id)continue;
  const price=f?f.package_price:p.package_price;
  const finalPrice=offer.price??price;
  if(!price||!Number.isInteger(finalPrice)||!finalPrice||finalPrice<1||finalPrice>price)continue;
  return {...offer,price:finalPrice};
 }
 return null;
}

export function matchesOffer(item:CartItem,offer:CartOffer|null){
 return !!offer&&item.mode==='package'&&item.quantity===1&&item.product_id===offer.product_id&&(item.flavor_id||null)===offer.flavor_id&&(item.upsell_rule_id||null)===offer.rule_id;
}

/** Historic discounts never transfer to a new purchase. */
export function repeatOrder(items:OrderItem[],catalog:Catalog){
 const cart:CartItem[]=[],unavailable:string[]=[],changed:string[]=[];
 for(const item of items){
  const p=catalog.products.find(p=>p.id===item.product_id&&p.active&&p.available);
  const f=catalog.flavors.find(f=>f.id===item.flavor_id&&f.product_id===p?.id&&f.active&&f.available);
  const mode=item.mode;
  const price=mode==='bundle'?bundlePrice(f?f.package_price:p?.package_price):(f?f.package_price:p?.package_price);
  if(!p||(p.has_flavors?!f:!!item.flavor_id)||!price||!['package','bundle'].includes(mode)||(mode==='bundle'&&!p.bundle_units)||!Number.isInteger(item.quantity)||item.quantity<1||item.quantity>999){unavailable.push(item.name);continue;}
  if(price!==item.unit_price||(mode==='bundle'&&BUNDLE_UNITS!==item.bundle_units))changed.push(item.name);
  cart.push({product_id:p.id,flavor_id:f?.id||null,mode:mode as CartItem['mode'],quantity:item.quantity,upsell:false});
 }
 return {cart,unavailable,changed};
}

export function mergeRepeat(current:CartItem[],addition:CartItem[]){
 const key=(i:CartItem)=>`${i.product_id}:${i.flavor_id||''}:${i.mode}`;
 const merged=current.map(i=>({...i}));
 for(const i of addition){const prior=merged.find(p=>key(p)===key(i));if(prior){if(prior.quantity+i.quantity>999)throw new Error('A soma ultrapassa 999 unidades de um item. Ajuste o carrinho antes de repetir.');prior.quantity+=i.quantity;prior.upsell=false;delete prior.upsell_rule_id;}else merged.push({...i});}
 if(merged.length>200)throw new Error('O pedido pode ter até 200 itens diferentes.');
 for(const i of merged){if(addition.some(a=>a.product_id===i.product_id&&(a.flavor_id||null)===(i.flavor_id||null))){i.upsell=false;delete i.upsell_rule_id;}}
 return merged;
}
