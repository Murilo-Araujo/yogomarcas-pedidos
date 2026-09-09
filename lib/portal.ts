import {BUNDLE_UNITS,bundlePrice,cartOffer,matchesOffer} from './retention';
import {sessionStore} from './browser-storage';
import { API_URL, SUPABASE_KEY, SUPABASE_URL } from './config';
export type Line={id:string;name:string;description:string;position:number;active:boolean};
export type Flavor={sku:string;id:string;product_id:string;name:string;package_weight_grams:number|null;package_price:number|null;bundle_price:number|null;active:boolean;available:boolean;position:number};
export type Product={bundle_enabled?:boolean;has_flavors?:boolean;package_weight_grams?:number|null;id:string;line_id:string;name:string;sku:string;description:string;image_url:string;package_label:string;package_price:number|null;bundle_units:number|null;bundle_price:number|null;active:boolean;available:boolean;position:number;yield_grams:number|null;yield_min_grams:number|null};
export type Settings={contextual_upsell_enabled?:boolean;whatsapp:string;minimum_order:number;notice:string;ordering_enabled:boolean;upsell_enabled:boolean;upsell_product_id:string|null;upsell_flavor_id?:string|null;upsell_title:string;upsell_description:string;upsell_price:number|null};
export type Catalog={upsell_rules?:import('./retention').UpsellRule[];lines:Line[];products:Product[];flavors:Flavor[];settings:Settings};
export type CartItem={upsell_rule_id?:string|null;product_id:string;flavor_id?:string|null;mode:'package'|'bundle';quantity:number;upsell?:boolean};
export type ResolvedItem=CartItem&{product:Product;flavor?:Flavor;unit_price:number;units:number};
export type OrderItem={internal_code?:string;product_id:string;flavor_id?:string|null;flavor_name?:string|null;name:string;sku:string;mode:string;package_label:string;quantity:number;bundle_units:number;units:number;unit_price:number;line_total:number;upsell:boolean};
export type Order={customer_id?:string;projection_snapshot?:import('./projection').Projection|null;id:string;public_number:string;customer_name:string;company:string;phone:string;city:string;state:string;customer_code:string;notes:string;items:OrderItem[];total:number;status:string;status_note:string;created_at:string};
export type Session={access_token:string;refresh_token:string;expires_in:number;expires_at?:number};
export const money=(n:number)=>(n/100).toLocaleString('pt-BR',{style:'currency',currency:'BRL'});
export const moneyInput=(n:number|null)=>n===null?'':(n/100).toFixed(2);
export const cents=(s:string)=>s.trim()===''?null:Math.round(Number(s.replace(',','.'))*100);
export const STATES=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
export const STATUS:Record<string,string>={prepared:'Preparado para WhatsApp',contacted:'Em atendimento',confirmed:'Confirmado',fulfilled:'Concluído',cancelled:'Cancelado'};
export const cartKey=(i:Pick<CartItem,'product_id'|'flavor_id'|'mode'>)=>`${i.product_id}:${i.flavor_id||''}:${i.mode}`;
export const itemName=(i:ResolvedItem)=>i.product.name+(i.flavor?` · ${i.flavor.name}`:'');
export const normalizeSearch=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLocaleLowerCase();
export function variantProduct(p:Product,f?:Flavor):Product{const price=f?f.package_price:p.package_price,allowBundle=p.bundle_enabled!==false;return {...p,bundle_enabled:allowBundle,bundle_units:allowBundle?BUNDLE_UNITS:null,package_price:price,bundle_price:allowBundle?bundlePrice(price):null,...(f?{package_weight_grams:f.package_weight_grams,available:p.available&&f.available&&f.active}:{})};}
export const variantKey=(i:Pick<CartItem,'product_id'|'flavor_id'>)=>`${i.product_id}:${i.flavor_id||''}`;
export type CartGroup={key:string;item:ResolvedItem;packages:number;bundles:number;total:number;units:number};
export function groupCart(items:ResolvedItem[]):CartGroup[]{const groups=new Map<string,CartGroup>();for(const i of items){const key=variantKey(i);const g=groups.get(key)||{key,item:i,packages:0,bundles:0,total:0,units:0};g[i.mode==='bundle'?'bundles':'packages']+=i.quantity;g.total+=i.quantity*i.unit_price;g.units+=i.units;groups.set(key,g);}return [...groups.values()];}
export function setVariantQuantity(cart:CartItem[],item:Pick<CartItem,'product_id'|'flavor_id'>,mode:CartItem['mode'],quantity:number):CartItem[]{
 if(!Number.isInteger(quantity)||quantity<0||quantity>999)throw new Error('Use uma quantidade inteira de 0 a 999.');
 const target={product_id:item.product_id,flavor_id:item.flavor_id||null,mode},key=cartKey(target),group=variantKey(item);
 const next=cart.filter(i=>cartKey(i)!==key).map(i=>variantKey(i)===group?{...i,upsell:false,upsell_rule_id:null}:{...i});
 if(quantity)next.push({...target,quantity,upsell:false});
 if(next.length>200)throw new Error('O pedido pode ter até 200 apresentações.');
 return next.some(i=>!i.upsell)?next:next.map(i=>({...i,upsell:false,upsell_rule_id:null}));
}
export function convertBundleToPackages(cart:CartItem[],item:CartItem):CartItem[]{
 const stored=cart.find(i=>cartKey(i)===cartKey(item));
 if(!stored||stored.mode!=='bundle')throw new Error('Este fardo não está mais no carrinho.');
 const packages=cart.find(i=>variantKey(i)===variantKey(stored)&&i.mode==='package')?.quantity||0;
 const quantity=packages+stored.quantity*BUNDLE_UNITS;
 if(quantity>999)throw new Error('A conversão ultrapassa 999 pacotes. Remova o fardo e ajuste a quantidade.');
 return setVariantQuantity(setVariantQuantity(cart,stored,'bundle',0),stored,'package',quantity);
}
export function startingPrice(p:Product,flavors:Flavor[]){const prices=p.has_flavors?flavors.filter(f=>f.product_id===p.id&&f.active&&f.available&&f.package_price).map(f=>f.package_price!):p.package_price?[p.package_price]:[];return prices.length?Math.min(...prices):null;}
export function resolveCart(cart:CartItem[],catalog:Catalog):ResolvedItem[]{
 const offer=cartOffer(catalog,cart),upsellCount=cart.filter(i=>i.upsell).length;
 return cart.flatMap(i=>{const parent=catalog.products.find(p=>p.id===i.product_id&&p.active);if(!parent||i.mode==='bundle'&&parent.bundle_enabled===false)return[];const f=catalog.flavors?.find(f=>f.id===i.flavor_id&&f.product_id===parent.id&&f.active);if(parent.has_flavors?!f:!!i.flavor_id)return[];const p=variantProduct(parent,f);const price=i.upsell?(upsellCount===1&&matchesOffer(i,offer)?offer!.price:null):i.mode==='bundle'?p.bundle_price:p.package_price;return [{...i,product:p,flavor:f,unit_price:price??0,units:i.quantity*(i.mode==='bundle'?(p.bundle_units??0):1)}];});
}
export class PortalError extends Error{constructor(message:string,public status:number){super(message);}}
async function decode(r:Response){const j=await r.json().catch(()=>({error:'Serviço indisponível. Tente novamente.'}));if(!r.ok)throw new PortalError(j.error||j.msg||j.error_description||'Não foi possível concluir.',r.status);return j;}
export async function getCatalog():Promise<Catalog>{return decode(await fetch(API_URL,{headers:{apikey:SUPABASE_KEY},cache:'no-store'}));}
let refreshTask:Promise<Session>|null=null;
export async function getSession():Promise<Session|null>{
 let s:Session|null=null;try{s=JSON.parse(sessionStore.getItem('yp-auth')||'null');}catch{}
 if(s&&(!s.expires_at||s.expires_at<Date.now()+60000)){
  if(!refreshTask)refreshTask=fetch(SUPABASE_URL+'/auth/v1/token?grant_type=refresh_token',{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json'},body:JSON.stringify({refresh_token:s.refresh_token})}).then(decode).then(saveSession).finally(()=>{refreshTask=null;});
  try{s=await refreshTask;}catch{sessionStore.removeItem('yp-auth');return null;}
 }return s;
}
export function saveSession(s:Session){s.expires_at=Date.now()+s.expires_in*1000;sessionStore.setItem('yp-auth',JSON.stringify(s));return s;}
export async function login(username:string,password:string){return saveSession(await api('admin_login',{username,password}));}
export async function logout(){const s=await getSession();sessionStore.removeItem('yp-auth');if(s)await fetch(SUPABASE_URL+'/auth/v1/logout',{method:'POST',headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${s.access_token}`}}).catch(()=>{});}
export async function api(action:string,data:Record<string,unknown>={},auth=false){
 const s=auth?await getSession():null;if(auth&&!s)throw new PortalError('Sua sessão expirou. Entre novamente.',401);
 return decode(await fetch(API_URL,{method:'POST',headers:{apikey:SUPABASE_KEY,'Content-Type':'application/json',...(s?{Authorization:`Bearer ${s.access_token}`}:{})},body:JSON.stringify({action,...data})}));
}
export function sessionId(){let id=sessionStore.getItem('yp-visitor');if(!id){id=crypto.randomUUID();sessionStore.setItem('yp-visitor',id);}return id;}
export function track(type:string,product_id?:string,once=false,flavor_id?:string){
 if(typeof window==='undefined'||sessionStore.getItem('yp-auth'))return;
 const key=`yp-event:${type}:${product_id||''}:${flavor_id||''}`;if(once&&sessionStore.getItem(key))return;if(once)sessionStore.setItem(key,'1');
 void api('events',{session_id:sessionId(),events:[{id:crypto.randomUUID(),type,product_id,flavor_id}]}).catch(()=>{});
}
export const dateTime=(value:string)=>new Date(value).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'});
export function downloadCSV(name:string,rows:(string|number)[][]){const csv='\uFEFF'+rows.map(row=>row.map(v=>'"'+String(v).replace(/^[=+@\-]/,"'$&").replace(/"/g,'""')+'"').join(';')).join('\r\n');const url=URL.createObjectURL(new Blob([csv],{type:'text/csv;charset=utf-8;'}));const a=document.createElement('a');a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);}
