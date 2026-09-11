'use client';
import {sessionStore} from '@/lib/browser-storage';
import {clearCheckoutDetails,readCheckoutDetails,rememberCheckoutDetails,type CheckoutDetails} from '@/lib/checkout-details';
import {useEffect,useMemo,useRef,useState} from 'react';
import {ArrowRight,ArrowRightLeft,ArrowUpRight,Check,ChevronDown,ChevronRight,Clock3,Headphones,Layers3,Package,Plus,Search,Settings2,ShoppingBag,Store,Truck,X} from 'lucide-react';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {RadioGroup,RadioGroupItem} from '@/components/ui/radio-group';
import {Skeleton} from '@/components/ui/skeleton';
import {Toaster,toast} from 'sonner';
import {Brand,Choice,Quantity,DualQuantity} from './controls';
import {api,cartKey,groupCart,convertBundleToPackages,variantKey,setVariantQuantity,normalizeSearch,startingPrice,variantProduct,Flavor,CartItem,Catalog,getCatalog,money,PortalError,Product,ResolvedItem,resolveCart,sessionId,STATES,track} from '@/lib/portal';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from '@/components/ui/dropdown-menu';
import Disclosure from './disclosure';
import FlavorPicker from './flavor-picker';
import LineDetails from './line-details';
import CustomerHistory from './customer-history';
import CartSuggestion from './cart-suggestion';
import CartRow from './cart-row';
import OrderDrawer,{ORDER_CHECKOUT_FORM_ID} from './order-drawer';
import {useCartSync,useFavorites} from '@/hooks/use-shopping';
import {CartOffer,cartOffers,reconcileCartOffers,mergeRepeat} from '@/lib/retention';
import CustomerOnboarding from './customer-onboarding';
import ProjectionCard from './projection-card';
import {CustomerProfile,customerApi,forgetIdentity,readIdentity,restoreCustomer} from '@/lib/customer';
const CART_KEY='yogomarcas-cart-v1';
const EMPTY_CUSTOMER={name:'',company:'',phone:'',city:'',state:'PR',code:'',notes:''};
function Photo({product,large=false}:{product:Product;large?:boolean}){const [failed,setFailed]=useState(false);return <div className={`product-photo ${large?'large':''} ${product.sku==='LUB'?'support':''} ${product.image_url.startsWith('/assets/catalog-')?'catalog-photo':''}`}>{product.image_url&&!failed?<img src={product.image_url} alt={product.name} loading="lazy" onError={()=>setFailed(true)}/>:<div className="no-photo"><Package size={large?60:40} strokeWidth={1}/><span>{product.package_label}</span></div>}</div>;}
function PackPicker({p,mode,setMode}:{p:Product;mode:'package'|'bundle';setMode:(m:'package'|'bundle')=>void}){if(p.bundle_enabled===false||!p.bundle_price||!p.bundle_units)return null;return <RadioGroup value={mode} onValueChange={v=>setMode(v as 'package'|'bundle')} className="pack-picker" aria-label={`Apresentação de ${p.name}`}>{(['package','bundle'] as const).map(m=><label key={m} className={`pack-option ${mode===m?'selected':''} ${m==='bundle'&&(!p.bundle_price||!p.bundle_units)?'unavailable':''}`}><RadioGroupItem value={m} disabled={m==='bundle'&&(!p.bundle_price||!p.bundle_units)}/><span>{m==='package'?p.package_label:'Fardo'}{m==='bundle'&&p.bundle_units?<small>{p.bundle_units} pacotes</small>:null}</span></label>)}</RadioGroup>;}
function ProductCard({p,flavors,onAdd,onDetails,enabled}:{p:Product;flavors:Flavor[];onAdd:(p:Product,m:'package'|'bundle',q:number)=>void;onDetails:(p:Product)=>void;enabled:boolean}){
 const [selectedMode,setMode]=useState<'package'|'bundle'>('package'),[qty,setQty]=useState(1);const ref=useRef<HTMLElement>(null);
 const mode=p.bundle_enabled===false?'package':selectedMode;
 useEffect(()=>{const el=ref.current;if(!el)return;const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){track('product_view',p.id,true);observer.disconnect();}},{threshold:.4});observer.observe(el);return()=>observer.disconnect();},[p.id]);
 const price=p.has_flavors?startingPrice(p,flavors):mode==='package'?p.package_price:p.bundle_price;const available=enabled&&p.available&&!!price;
 const flavorCount=flavors.filter(f=>f.product_id===p.id&&f.active).length;
 const badge=p.has_flavors?`${flavorCount} ${flavorCount===1?'sabor':'sabores'}`:p.package_weight_grams?`${p.package_weight_grams.toLocaleString('pt-BR')} g por pacote`:p.package_label;
 const description=p.description.split(/(?<=[.!?])\s+/)[0];
 return <article className={`product-card catalog-product${!p.available?' catalog-product-unavailable':''}`} ref={ref}>
  <div className="product-media">
   <button type="button" className="photo-button" onClick={()=>onDetails(p)} aria-label={`Ver detalhes de ${p.name}`}><Photo product={p}/><span className="product-photo-open" aria-hidden="true"><ArrowUpRight size={18}/></span></button>
   <span className="product-badge">{p.available?badge:'Indisponível'}</span>
  </div>
  <div className="product-body">
   <button type="button" onClick={()=>onDetails(p)} className="product-name">{p.name}</button>
   <p className="product-description">{description}</p>
   <div className="product-purchase">
    {!p.has_flavors&&<PackPicker p={p} mode={mode} setMode={setMode}/>}
    <div className="price-row"><div className="product-price">{price?<small className="product-price-label">{p.has_flavors?'A partir de':mode==='bundle'?'Fardo com 5 pacotes':'Preço por pacote'}</small>:null}<div className="product-price-value"><strong>{price?money(price):'Sob consulta'}</strong>{price?<span>/{mode==='package'?p.package_label.toLowerCase():'fardo'}</span>:null}</div></div>{!p.has_flavors&&price?<Quantity value={qty} onChange={setQty}/>:null}</div>
    <button type="button" className="btn add-button" disabled={p.has_flavors?!p.available:!available} onClick={()=>p.has_flavors?onDetails(p):onAdd(p,mode,qty)}><span>{!p.available?'Indisponível':p.has_flavors?'Escolher sabores':!price?'Sob consulta':'Adicionar ao pedido'}</span>{p.has_flavors?<ArrowRight size={18}/>:<PlusMark/>}</button>
   </div>
  </div>
 </article>;

}
function PlusMark(){return <span className="plus-mark">+</span>;}
export default function Storefront(){
 const [data,setData]=useState<Catalog|null>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[storedCart,setCart]=useState<CartItem[]>([]),[ready,setReady]=useState(false);
 const cart=useMemo(()=>data?reconcileCartOffers(storedCart,data):storedCart,[data,storedCart]);
 useEffect(()=>{if(cart!==storedCart){setCart(cart);toast.info('Atualizamos as sugestões. Os itens continuam no pedido com o preço do catálogo.');}},[cart,storedCart]);
 const [line,setLine]=useState('all'),[search,setSearch]=useState(''),[sort,setSort]=useState('default'),[cartOpen,setCartOpen]=useState(false),[detailSelection,setDetail]=useState<Product|null>(null),[detailMode,setDetailMode]=useState<'package'|'bundle'>('package'),[detailQty,setDetailQty]=useState(1),[detailBundles,setDetailBundles]=useState(0);
 const [checkout,setCheckout]=useState(false),[customer,setCustomer]=useState(EMPTY_CUSTOMER),[sending,setSending]=useState(false),[receipt,setReceipt]=useState<{number:string;whatsapp_url:string;message:string;customer_id:string}|null>(null);
 const [profile,setProfile]=useState<CustomerProfile|null>(null),[onboardingOpen,setOnboardingOpen]=useState(false),[restoreError,setRestoreError]=useState(''),[adminView,setAdminView]=useState(false),[portionId,setPortionId]=useState('');
 const [historyOpen,setHistoryOpen]=useState(false),[allSuggestions,setAllSuggestions]=useState(false);
 const favorites=useFavorites(profile?.id);
 const cartSync=useCartSync(profile?.id,ready,cart,setCart,sending||!!receipt);
 const detail=detailSelection?(data?.products.find(p=>p.id===detailSelection.id)||null):null;
 const detailBundleQty=detail?.bundle_enabled===false?0:detailBundles;
 useEffect(()=>{if(!cartSync.error)return;let cancelled=false;getCatalog().then(c=>{if(!cancelled)setData(c);}).catch(()=>{});return()=>{cancelled=true;};},[cartSync.error]);
 const preferenceQueue=useRef(Promise.resolve());
 function acceptProfile(p:CustomerProfile){try{const owner=localStorage.getItem('yp-cart-owner');if(owner&&owner!==p.id)setCart([]);localStorage.setItem('yp-cart-owner',p.id);}catch{}let old=null,saved=null;try{old=JSON.parse(sessionStore.getItem('yp-submission')||'null');saved=JSON.parse(sessionStore.getItem('yp-receipt')||'null');}catch{}submission.current=old?.customer_id===p.id?old:null;setReceipt(saved?.customer_id===p.id?saved:null);setProfile(p);setPortionId(p.preferred_portion_id||p.portions[0]?.id||'');const details=readCheckoutDetails(p);setCustomer(c=>({...(profile?.id===p.id?c:EMPTY_CUSTOMER),...details,company:p.store_name,phone:p.phone}));setRestoreError('');}
 async function restore(){setRestoreError('');try{const p=await restoreCustomer();if(p){acceptProfile(p);setOnboardingOpen(false);}else{setProfile(null);setCustomer(EMPTY_CUSTOMER);setReceipt(null);submission.current=null;sessionStore.removeItem('yp-receipt');sessionStore.removeItem('yp-submission');let admin=false;try{admin=!!sessionStore.getItem('yp-auth');}catch{}setAdminView(admin);setOnboardingOpen(!admin);}}catch{setRestoreError('Não foi possível carregar os dados da sua loja. Confira a conexão e tente novamente.');setOnboardingOpen(true);}}
 useEffect(()=>{void restore();const sync=(e:StorageEvent)=>{if(e.key==='yp-shop-v1')window.location.reload();};window.addEventListener('storage',sync);return()=>window.removeEventListener('storage',sync);},[]);
 function editProfile(){setCartOpen(false);setDetail(null);setOnboardingOpen(true);}
 function selectPortion(id:string){setPortionId(id);setProfile(p=>p?{...p,preferred_portion_id:id}:p);resetReceipt();const device_token=readIdentity()?.token;if(profile)preferenceQueue.current=preferenceQueue.current.then(async()=>{await api('customer_preference',{portion_id:id,device_token});}).catch(()=>{toast.error('A simulação foi alterada, mas não foi possível salvar sua preferência para a próxima visita.');});}
 async function switchStore(){try{await customerApi('customer_forget');}catch{toast.error('Não foi possível encerrar este acesso. Tente novamente.');return;}if(profile)clearCheckoutDetails(profile.id);forgetIdentity();setProfile(null);setCart([]);setCustomer(EMPTY_CUSTOMER);resetReceipt();submission.current=null;try{sessionStore.removeItem('yp-submission');}catch{}setCheckout(false);setCartOpen(false);setRestoreError('');setOnboardingOpen(true);}
 const projection=(compact=false)=><ProjectionCard items={resolved} portions={profile?.portions||[]} selected={portionId} onSelect={selectPortion} onEdit={editProfile} compact={compact}/>;
 const submission=useRef<{fingerprint:string;id:string;client_token:string;customer_id:string}|null>(null);
 const load=async()=>{setLoading(true);setError('');try{setData(await getCatalog());}catch{setError('Não foi possível carregar o catálogo. Tente novamente.');}finally{setLoading(false);}};
 useEffect(()=>{void load();try{const stored=JSON.parse(localStorage.getItem(CART_KEY)||'[]');if(Array.isArray(stored))setCart(stored.filter(i=>typeof i.product_id==='string'&&(!i.flavor_id||typeof i.flavor_id==='string')&&['package','bundle'].includes(i.mode)&&Number.isInteger(i.quantity)&&i.quantity>0&&i.quantity<=999));}catch{}setReady(true);track('visit',undefined,true);},[]);
 useEffect(()=>{if(ready)try{localStorage.setItem(CART_KEY,JSON.stringify(cart));}catch{}},[cart,ready]);
 const resolved=useMemo(()=>data?resolveCart(cart,data):[],[cart,data]);const subtotal=resolved.reduce((s,i)=>s+i.unit_price*i.quantity,0);
 const grouped=groupCart(resolved);
 const unresolved=cart.filter(i=>!resolved.some(r=>cartKey(r)===cartKey(i)));
 const cartCount=grouped.length+unresolved.length;
 const invalid=!!data&&(resolved.length!==cart.length||resolved.some(i=>!i.product.available||!i.unit_price||i.mode==='bundle'&&!i.product.bundle_units));
 const products=useMemo(()=>{let list=data?.products.filter(p=>(line==='all'||p.line_id===line)&&normalizeSearch(`${p.name} ${p.sku} ${p.description} ${data.flavors.filter(f=>f.product_id===p.id).map(f=>`${f.name} ${f.sku||''}`).join(' ')}`).includes(normalizeSearch(search)))||[];if(sort==='name')list=list.toSorted((a,b)=>a.name.localeCompare(b.name));if(sort==='price')list=list.toSorted((a,b)=>(startingPrice(a,data!.flavors)??Infinity)-(startingPrice(b,data!.flavors)??Infinity));return list;},[data,line,search,sort]);
 const offers=useMemo(()=>data?cartOffers(data,cart).filter(o=>!cart.some(i=>variantKey(i)===variantKey(o))).slice(0,3):[],[data,cart]);
 const visibleOffers=useMemo(()=>offers.slice(0,allSuggestions?3:1),[offers,allSuggestions]);
 useEffect(()=>{if(cartOpen&&!checkout)visibleOffers.forEach(offer=>track('upsell_view',offer.product_id,true,offer.flavor_id||undefined));},[cartOpen,checkout,visibleOffers]);
 function addSuggested(offer:CartOffer,selection:{packages:number;bundles:number}){
  const entries:CartItem[]=(['bundle','package'] as const).flatMap(mode=>{const quantity=mode==='bundle'?selection.bundles:selection.packages;return quantity?[{product_id:offer.product_id,flavor_id:offer.flavor_id,mode,quantity,upsell:true,upsell_rule_id:offer.rule_id}]:[];});
  if(!entries.length||!addSelection(entries))return;
  track('upsell_add',offer.product_id,false,offer.flavor_id||undefined);
  toast.success('Sugestão adicionada ao pedido.');
 }
 function resetReceipt(){if(receipt){submission.current=null;sessionStore.removeItem('yp-submission');}setReceipt(null);sessionStore.removeItem('yp-receipt');}
 function addSelection(entries:CartItem[]){
  if(profile&&!cartSync.loaded){toast.error('Aguarde o carregamento do carrinho.');return false;}
  try{let next=cart;for(const entry of entries){if(entry.mode==='bundle'&&data?.products.find(p=>p.id===entry.product_id)?.bundle_enabled===false)throw new Error('Este produto está disponível apenas por pacote.');const previous=next.find(i=>cartKey(i)===cartKey(entry));next=setVariantQuantity(next,entry,entry.mode,(previous?.quantity||0)+entry.quantity);if(entry.upsell&&!previous)next=next.map(i=>cartKey(i)===cartKey(entry)?{...i,upsell:true,upsell_rule_id:entry.upsell_rule_id}:i);}resetReceipt();setCart(next);entries.forEach(i=>track('add_to_cart',i.product_id,false,i.flavor_id||undefined));return true;}catch(e){toast.error(e instanceof Error?e.message:'Confira as quantidades.');return false;}
 }
 function add(p:Product,mode:'package'|'bundle',quantity:number,isUpsell=false,flavor_id?:string,silent=false,upsell_rule_id?:string|null){if(!addSelection([{product_id:p.id,flavor_id:flavor_id||null,mode,quantity,upsell:isUpsell,upsell_rule_id:upsell_rule_id||null}]))return;if(isUpsell)track('upsell_add',p.id,false,flavor_id);if(!silent)toast.success(`${p.name} adicionado ao pedido`,{action:{label:'Ver pedido',onClick:()=>setCartOpen(true)}});}
 function updateGroup(i:CartItem,mode:CartItem['mode'],quantity:number){if(!cartSync.loaded)return;try{if(mode==='bundle'&&quantity>0&&data?.products.find(p=>p.id===i.product_id)?.bundle_enabled===false)throw new Error('Este produto está disponível apenas por pacote.');const next=setVariantQuantity(cart,i,mode,quantity);resetReceipt();setCart(next);}catch(e){toast.error(e instanceof Error?e.message:'Confira a quantidade.');}}
 function removeGroup(i:CartItem){if(!cartSync.loaded)return;resetReceipt();setCart(c=>{const next=c.filter(x=>variantKey(x)!==variantKey(i));return next.some(x=>!x.upsell)?next:next.map(x=>({...x,upsell:false,upsell_rule_id:null}));});}
 function remove(i:CartItem){if(!cartSync.loaded)return;resetReceipt();setCart(c=>{const next=c.filter(x=>cartKey(x)!==cartKey(i));return next.some(x=>!x.upsell)?next:next.map(x=>({...x,upsell:false,upsell_rule_id:null}));});}
 function convertBundle(i:CartItem){if(profile&&!cartSync.loaded)return;try{const next=convertBundleToPackages(cart,i);resetReceipt();setCart(next);toast.success('Fardos convertidos em pacotes. Confira o pedido.');}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível converter.');}}
 const showDetails=(p:Product)=>{setDetail(p);setDetailMode('package');setDetailQty(1);setDetailBundles(0);track('product_click',p.id);};
 async function send(e:React.FormEvent){e.preventDefault();if(!data||sending||invalid)return;setSending(true);
 try{const cartRevision=await cartSync.flush();const items=resolved.map(i=>({product_id:i.product_id,flavor_id:i.flavor_id||null,mode:i.mode,quantity:i.quantity,unit_price:i.unit_price,upsell:!!i.upsell,upsell_rule_id:i.upsell_rule_id||null}));const fingerprint=JSON.stringify({items,customer,profile:profile?.id,profileVersion:profile?.updated_at,portionId,yields:resolved.map(i=>[i.product.yield_min_grams,i.product.yield_grams])});if(submission.current?.fingerprint!==fingerprint){submission.current={fingerprint,customer_id:profile!.id,id:crypto.randomUUID(),client_token:crypto.randomUUID()};sessionStore.setItem('yp-submission',JSON.stringify(submission.current));}
 const result=await api('order',{...submission.current,cart_revision:cartRevision,session_id:sessionId(),items,customer,customer_device_token:readIdentity()?.token,portion_id:portionId,profile_version:profile?.updated_at});const checkout_details={order_id:result.id,name:customer.name.trim(),city:customer.city.trim(),state:customer.state};clearCheckoutDetails(profile!.id);setProfile(p=>p?.id===profile!.id?{...p,checkout_details}:p);const saved={...result,customer_id:profile!.id};setReceipt(saved);sessionStore.setItem('yp-receipt',JSON.stringify(saved));setCheckout(false);cartSync.close(result.cart_revision);window.location.assign(result.whatsapp_url);
 }catch(e){toast.error(e instanceof Error?e.message:'Não foi possível preparar o pedido.');if(e instanceof PortalError&&(e.status===401||e.status===409)){setCartOpen(false);setCheckout(false);await restore();if(e.status===409)await cartSync.refresh();}try{setData(await getCatalog());}catch{}}finally{setSending(false);}}
 function updateCheckout(field:keyof CheckoutDetails,value:string){const next={...customer,[field]:value};setCustomer(next);if(profile)rememberCheckoutDetails(profile,next);}
 function startCheckout(){if(!profile){editProfile();return;}setCartOpen(true);setCheckout(true);track('checkout',undefined,true);}
 function summary(){return <>
  <div className="summary-top"><span className="summary-icon"><ShoppingBag size={20} aria-hidden="true"/></span><h2>Seu pedido</h2><span className="count" aria-label={`${cartCount} ${cartCount===1?'item':'itens'} no pedido`}>{cartCount}</span></div>
  {!cart.length?<div className="empty-cart"><span className="summary-empty-icon"><ShoppingBag size={30} strokeWidth={1.5} aria-hidden="true"/></span><h3>Nenhum produto selecionado</h3><p>Escolha uma linha e adicione os sabores ao seu pedido.</p></div>:<>
   <div className="summary-list">{grouped.map(g=><div className="summary-item" key={g.key}><div className="summary-item-info">{g.item.flavor?<span className="summary-line-name">{g.item.product.name}</span>:null}<strong>{g.item.flavor?.name||g.item.product.name}</strong><small>{[g.bundles?`${g.bundles} ${g.bundles===1?'fardo':'fardos'}`:'',g.packages?`${g.packages} ${g.packages===1?'pacote avulso':'pacotes avulsos'}`:''].filter(Boolean).join(' + ')}</small>{g.bundles>0?<span className="summary-package-total">{g.units} pacotes no total</span>:null}</div><b>{money(g.total)}</b></div>)}{unresolved.length>0?<p className="summary-unavailable">{unresolved.length} {unresolved.length===1?'item precisa':'itens precisam'} de revisão.</p>:null}</div>
   <div className="summary-footer"><div className="summary-subtotal"><span>Subtotal</span><strong>{money(subtotal)}</strong></div>{projection(true)}<button type="button" className="btn primary wide" onClick={()=>setCartOpen(true)} disabled={!data?.settings.ordering_enabled}>Revisar pedido<ArrowRight size={18}/></button></div>
  </>}
 </>;}


 return <><Toaster richColors position="top-center"/><header className="site-header catalog-header"><div className="header-inner"><Brand/><div className="header-actions">
 {profile?<DropdownMenu><DropdownMenuTrigger asChild><button type="button" className="shop-menu-button" aria-label="Minha loja"><Store size={18}/><span>Minha loja</span><ChevronDown size={14}/></button></DropdownMenuTrigger><DropdownMenuContent align="end" sideOffset={10} collisionPadding={12} className="shop-menu-content">
  <DropdownMenuLabel className="shop-menu-identity"><span className="shop-menu-avatar" aria-hidden="true"><Store size={20}/></span><span><small>Minha loja</small><strong>{profile.store_name}</strong></span></DropdownMenuLabel>
  <DropdownMenuSeparator className="shop-menu-separator"/>
  <DropdownMenuItem className="shop-menu-item" onSelect={()=>{setCartOpen(false);setDetail(null);setHistoryOpen(true);}}><ShoppingBag aria-hidden="true"/><span>Meus pedidos</span><ChevronRight className="shop-menu-arrow" aria-hidden="true"/></DropdownMenuItem>
  <DropdownMenuItem className="shop-menu-item" onSelect={editProfile}><Settings2 aria-hidden="true"/><span>Meus preços e dados</span><ChevronRight className="shop-menu-arrow" aria-hidden="true"/></DropdownMenuItem>
  <DropdownMenuSeparator className="shop-menu-separator"/>
  <DropdownMenuItem className="shop-menu-item shop-menu-switch" onSelect={()=>void switchStore()}><ArrowRightLeft aria-hidden="true"/><span>Trocar loja</span></DropdownMenuItem>
 </DropdownMenuContent></DropdownMenu>:adminView?<button className="btn text-button" onClick={editProfile}>Cadastrar loja</button>:null}
 <button type="button" className="header-cart" aria-label={`Abrir pedido com ${cartCount} ${cartCount===1?'item':'itens'}`} onClick={()=>setCartOpen(true)}><ShoppingBag size={20}/><span>Meu pedido</span><b>{cartCount}</b></button></div></div></header><main className="store-main catalog-page"><section className="catalog-heading"><div><h1>Monte seu pedido</h1><p>Bases e complementos para sua sorveteria.</p></div><a className="catalog-help" aria-label="Falar com a Yogomarcas pelo WhatsApp" href={`https://wa.me/${data?.settings.whatsapp||'554532541200'}`} target="_blank" rel="noreferrer"><Headphones size={19}/><span>Precisa de ajuda?</span><ArrowUpRight size={16} aria-hidden="true"/></a></section>
 {receipt&&<div className="receipt-banner"><Check size={20}/><div><strong>Pedido {receipt.number} preparado</strong><p>Envie a mensagem no WhatsApp para nossa equipe receber seu pedido.</p></div><a className="btn secondary" href={receipt.whatsapp_url}>Abrir WhatsApp</a><button className="btn secondary" onClick={()=>{resetReceipt();submission.current=null;sessionStore.removeItem("yp-submission");setCart([]);setCustomer({...EMPTY_CUSTOMER,...(profile?readCheckoutDetails(profile):{}),company:profile?.store_name||'',phone:profile?.phone||''});}}>Novo pedido</button><button className="icon-button" onClick={resetReceipt} aria-label="Fechar aviso"><X size={17}/></button></div>}
 {data&&!data.settings.ordering_enabled&&<div className="notice-bar"><Clock3 size={18}/><span>Estamos atualizando nosso catálogo. Para fazer um pedido agora, fale com nossa equipe pelo WhatsApp.</span></div>}
 <div className="catalog-layout"><section className="catalog-content">
  <div className="catalog-filters">
   <div className="catalog-filter-label"><Layers3 size={17} aria-hidden="true"/><span>Linhas de produtos</span></div>
   <div className="line-tabs" role="group" aria-label="Filtrar linha"><button type="button" aria-pressed={line==='all'} className={line==='all'?'selected':''} onClick={()=>setLine('all')}>Todas as linhas</button>{data?.lines.map(l=><button type="button" aria-pressed={line===l.id} key={l.id} className={line===l.id?'selected':''} onClick={()=>setLine(l.id)}>{l.name}</button>)}</div>
   <div className="catalog-toolbar"><label className="search-box"><Search size={19} aria-hidden="true"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Buscar linha ou sabor" aria-label="Buscar linha ou sabor"/>{search&&<button type="button" onClick={()=>setSearch('')} aria-label="Limpar busca"><X size={17}/></button>}</label><div className="sort-control"><Choice value={sort} onChange={setSort} label="Ordenar produtos" options={[{value:'default',label:'Ordem do catálogo'},{value:'name',label:'Nome do produto'},{value:'price',label:'Menor preço'}]}/></div></div>
  </div>
  {!loading&&!error?<div className="catalog-results"><h2>{search.trim()?'Resultados da busca':line==='all'?'Todos os produtos':data?.lines.find(l=>l.id===line)?.name||'Produtos'}</h2><span role="status" aria-live="polite">{products.length} {products.length===1?'produto':'produtos'}</span></div>:null}
 {loading?<div className="products-grid">{[0,1,2].map(i=><Skeleton key={i} className="h-[360px] rounded-2xl"/>)}</div>:error?<div className="empty-state"><Package size={36}/><h2>Não foi possível abrir o catálogo</h2><p>{error}</p><button className="btn primary" onClick={load}>Tentar novamente</button></div>:products.length?<div className="products-grid">{products.map(p=><ProductCard key={p.id} p={p} flavors={data?.flavors||[]} onAdd={add} onDetails={showDetails} enabled={!!data?.settings.ordering_enabled&&(!profile||cartSync.loaded)}/>)}</div>:<div className="empty-state"><Search size={32}/><h2>Nenhum produto encontrado</h2><p>Tente outro nome ou selecione todas as linhas.</p><button className="btn secondary" onClick={()=>{setSearch('');setLine('all');}}>Limpar filtros</button></div>}
 </section><aside className="order-sidebar"><div className="order-summary">{summary()}</div></aside></div></main><footer className="site-footer"><span>Yogomarcas</span><div><a href="/privacidade">Privacidade</a></div></footer>{cart.length>0&&<button className="mobile-cart btn primary" onClick={()=>setCartOpen(true)}><ShoppingBag size={19}/>{cartCount} {cartCount===1?'item':'itens'} no pedido<strong>{money(subtotal)}</strong><ChevronRight size={19}/></button>}
 <Sheet open={!!detail} onOpenChange={v=>{if(!v)setDetail(null);}}><SheetContent className="product-sheet overflow-y-auto w-full sm:max-w-xl"><SheetHeader><SheetTitle>{detail?.name}</SheetTitle><SheetDescription>{detail?.has_flavors?'Escolha os sabores e as quantidades.':'Escolha a quantidade para o pedido.'}</SheetDescription></SheetHeader>{detail&&<div className="detail-body"><Disclosure className="product-about" title={detail.has_flavors?'Sobre esta linha':'Sobre este produto'}><LineDetails product={detail} flavors={data?.flavors||[]}><Photo product={detail} large/></LineDetails></Disclosure>{detail.has_flavors?<FlavorPicker key={detail.id} product={detail} flavors={data?.flavors||[]} enabled={!!data?.settings.ordering_enabled&&(!profile||cartSync.loaded)} favorites={favorites.ids} favoritePending={favorites.pending} favoritesReady={favorites.ready} onFavorite={profile?favorites.toggle:undefined} initialSearch={data?.flavors.some(f=>f.product_id===detail.id&&normalizeSearch(f.name).includes(normalizeSearch(search)))?search:''} onAdd={items=>{if(!addSelection(items.map(i=>({product_id:detail.id,flavor_id:i.flavor.id,mode:i.mode,quantity:i.quantity}))))return false;setDetail(null);toast.success('Seleção adicionada ao pedido',{action:{label:'Ver pedido',onClick:()=>setCartOpen(true)}});return true;}}/>:<><p className="small muted">{detail.bundle_enabled===false?'Disponível apenas por pacote.':'1 fardo = 5 pacotes.'}</p><div className="price-row"><strong className="detail-price">{detail.package_price?money(detail.package_price):'Preço sob consulta'}<small className="detail-unit"> / pacote</small></strong></div><DualQuantity allowBundle={detail.bundle_enabled!==false} name={detail.name} packages={detailQty} bundles={detailBundleQty} disabled={!detail.available||!detail.package_price} onChange={(mode,n)=>mode==='bundle'?setDetailBundles(n):setDetailQty(n)}/><button className="btn primary wide" disabled={!data?.settings.ordering_enabled||!!profile&&!cartSync.loaded||!detail.available||!detail.package_price||!detailQty&&!detailBundleQty} onClick={()=>{if(addSelection(([{product_id:detail.id,mode:'package' as const,quantity:detailQty},{product_id:detail.id,mode:'bundle' as const,quantity:detailBundleQty}]).filter(i=>i.quantity>0&&(i.mode!=='bundle'||detail.bundle_enabled!==false)))){setDetail(null);toast.success('Produto adicionado ao pedido');}}}><ShoppingBag size={18}/>Adicionar {money((detailQty+detailBundleQty*5)*(detail.package_price||0))} ao pedido</button></>}</div>}</SheetContent></Sheet>
 <OrderDrawer
  open={cartOpen} onOpenChange={value=>{setCartOpen(value);if(!value)setCheckout(false);}}
  checkout={checkout} itemCount={cartCount} packageCount={resolved.reduce((sum,item)=>sum+item.units,0)}
  subtotal={subtotal} minimumOrder={data?.settings.minimum_order||0}
  disabled={invalid||!data?.settings.ordering_enabled||!!profile&&!cartSync.loaded}
  sending={sending} onContinue={startCheckout} onBack={()=>setCheckout(false)}
 >
  {cartSync.recovery&&<div className="notice-bar"><div><p>Há alterações deste aparelho que não foram sincronizadas. Você pode substituir os itens exibidos pelos itens recuperados.</p><button className="btn secondary" onClick={cartSync.recover}>Usar itens deste aparelho</button></div></div>}
  {profile&&cartSync.error&&<div className="error-box" role="alert">{cartSync.error}<button className="btn secondary" onClick={cartSync.retry}>Sincronizar carrinho</button></div>}
  {!cart.length?<div className="empty-cart order-empty"><span className="order-empty-icon"><ShoppingBag size={38} strokeWidth={1.5} aria-hidden="true"/></span><h3>Seu próximo pedido começa aqui</h3><p>Explore as linhas e escolha os sabores para sua loja.</p><button type="button" className="btn primary" onClick={()=>setCartOpen(false)}>Escolher produtos<ArrowRight size={18}/></button></div>:<>
   {!checkout&&<>
    <div className="order-items-heading"><h2>Itens selecionados</h2><button type="button" onClick={()=>setCartOpen(false)}><Plus size={16} aria-hidden="true"/>Adicionar itens</button></div>
    {grouped.some(group=>group.item.product.bundle_enabled!==false)&&<p className="order-pack-note"><Package size={17} aria-hidden="true"/><span><strong>1 fardo = 5 pacotes</strong> do mesmo sabor. Combine com pacotes avulsos.</span></p>}
    <fieldset className="cart-fieldset order-product-list" disabled={!!profile&&!cartSync.loaded||sending} aria-label="Itens do pedido">
     {grouped.map(group=><CartRow key={group.key} group={group} onChange={(mode,quantity)=>updateGroup(group.item,mode,quantity)} onRemove={()=>removeGroup(group.item)}/>)}
     {unresolved.map(item=>{
      const product=data?.products.find(p=>p.id===item.product_id),flavor=data?.flavors.find(f=>f.id===item.flavor_id&&f.product_id===product?.id),packageVariant=data?resolveCart([{...item,mode:'package',upsell:false}],data)[0]:undefined;
      const blocked=item.mode==='bundle'&&product?.bundle_enabled===false&&!!packageVariant?.product.available&&packageVariant.unit_price>0;
      return <div className="order-unavailable" key={cartKey(item)}>{blocked?<><strong>{product.name}{flavor?` · ${flavor.name}`:''}</strong><p>Este produto agora é vendido apenas por pacote. {item.quantity} {item.quantity===1?'fardo equivale':'fardos equivalem'} a {item.quantity*5} pacotes.</p></>:<p>Este produto ou sabor saiu do catálogo.</p>}<div className="unavailable-cart-actions">{blocked&&<button type="button" className="btn secondary" onClick={()=>convertBundle(item)}>Trocar por {item.quantity*5} pacotes</button>}<button type="button" className="btn secondary" onClick={()=>remove(item)}>Remover</button></div></div>;
     })}
    </fieldset>
    {offers.length>0&&<div className="cart-offers"><div className="cart-offers-heading"><h3>Complete seu pedido</h3><p>Combinações para os produtos que você escolheu.</p></div>{visibleOffers.map(offer=>{const parent=data!.products.find(p=>p.id===offer.product_id)!,flavor=data!.flavors.find(f=>f.id===offer.flavor_id);return <CartSuggestion key={`${offer.rule_id||'general'}:${offer.product_id}:${offer.flavor_id||''}`} title={offer.title} description={offer.description} product={variantProduct(parent,flavor)} flavor={flavor} price={offer.price} disabled={!cartSync.loaded} onAdd={selection=>addSuggested(offer,selection)}/>;})}{offers.length>1&&<button type="button" className="btn secondary wide" aria-expanded={allSuggestions} onClick={()=>setAllSuggestions(value=>!value)}>{allSuggestions?'Mostrar menos sugestões':`Ver mais ${offers.length-1} ${offers.length===2?'sugestão':'sugestões'}`}<ChevronDown size={16}/></button>}</div>}
   </>}
   {invalid&&<p className="error-box" role="alert">Um item ficou indisponível ou mudou de condição. Remova o item e selecione novamente no catálogo.</p>}
   {!checkout&&projection()}
   {checkout&&<form id={ORDER_CHECKOUT_FORM_ID} onSubmit={send} className="checkout-form order-checkout-form">
    <div className="order-checkout-heading"><h2 tabIndex={-1} data-order-step-heading>Dados para atendimento</h2><p>Nome, cidade e estado ficam preenchidos nos próximos pedidos. Você pode editar quando precisar.</p></div>
    <div className="checkout-identity"><span className="order-store-icon"><Store size={21} strokeWidth={1.7} aria-hidden="true"/></span><div><small>Sua loja</small><strong>{customer.company}</strong><span>{customer.phone}</span></div><button type="button" onClick={editProfile} disabled={sending}>Editar</button></div>
    <fieldset className="order-contact-fields" disabled={sending}>
     <legend className="sr-only">Contato e endereço</legend>
     <div className="form-grid"><Field label="Seu nome" required value={customer.name} onChange={value=>updateCheckout('name',value)} autoComplete="name"/><Field label="Cidade" required value={customer.city} onChange={value=>updateCheckout('city',value)} autoComplete="address-level2"/><label className="field"><span>Estado</span><Choice value={customer.state} onChange={value=>updateCheckout('state',value)} options={STATES.map(state=>({label:state,value:state}))} label="Estado" disabled={sending}/></label></div>
     <Disclosure title="Adicionar observação ou código"><Field label="Código do cliente" value={customer.code} onChange={value=>setCustomer({...customer,code:value})}/><label className="field"><span>Observações</span><textarea rows={3} maxLength={1000} value={customer.notes} onChange={event=>setCustomer({...customer,notes:event.target.value})} placeholder="O que precisamos saber?"/></label></Disclosure>
    </fieldset>
    <p className="order-privacy">Seus dados serão usados para o atendimento deste pedido. <a href="/privacidade" target="_blank" rel="noreferrer">Privacidade</a></p>
    <button type="button" className="btn text-button wide order-back" disabled={sending} onClick={()=>setCheckout(false)}>Voltar à revisão do pedido</button>
   </form>}
   {data?.settings.notice&&<div className="order-delivery-note"><Truck size={20} strokeWidth={1.6} aria-hidden="true"/><p>{data.settings.notice}</p></div>}
  </>}
 </OrderDrawer>{profile&&<CustomerHistory key={profile.id} customerId={profile.id} open={historyOpen} onOpenChange={setHistoryOpen} hasCart={cart.length>0} onRepeat={(items,catalog)=>{if(!cartSync.loaded){toast.error('Aguarde o carregamento do carrinho.');return false;}try{const merged=mergeRepeat(cart,items);resetReceipt();setData(catalog);setCart(merged);setCartOpen(true);setCheckout(false);items.forEach(i=>track('add_to_cart',i.product_id,false,i.flavor_id||undefined));toast.success('Pedido carregado. Confira os itens antes de continuar.');return true;}catch(e){toast.error(e instanceof Error?e.message:'Não foi possível repetir.');return false;}}}/>}<CustomerOnboarding open={onboardingOpen} profile={profile} onOpenChange={setOnboardingOpen} onSaved={p=>{resetReceipt();submission.current=null;sessionStore.removeItem('yp-submission');acceptProfile(p);}} restoreError={restoreError} onRetry={()=>void restore()} allowClose={adminView}/></>;
}
function Field({label,value,onChange,required=false,type='text',autoComplete,readOnly=false}:{label:string;value:string;onChange:(v:string)=>void;required?:boolean;type?:string;autoComplete?:string;readOnly?:boolean}){return <label className="field"><span>{label}{required?' *':''}</span><input readOnly={readOnly} required={required} type={type} value={value} onChange={e=>onChange(e.target.value)} autoComplete={autoComplete} maxLength={200} minLength={required&&type==='text'?2:undefined}/></label>;}
