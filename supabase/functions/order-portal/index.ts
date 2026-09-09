import {BUNDLE_UNITS,bundlePrice,orderMessage,cartOffer,matchesOffer} from '../../../lib/retention.ts';
import {calculateProjection} from '../../../lib/projection.ts';
// Public catalogue/actions and explicitly authenticated administration.
// Service credentials stay in this Supabase Edge Function.
const BASE = Deno.env.get('SUPABASE_URL')!;
const SECRET = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const cors = {'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'authorization, apikey, content-type, x-client-info','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Cache-Control':'no-store'};
class ApiError extends Error { constructor(message:string,public status=400){super(message);} }
const json=(value:unknown,status=200)=>new Response(JSON.stringify(value),{status,headers:{...cors,'Content-Type':'application/json'}});
const uuid=(s:unknown)=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(s);
const str=(v:unknown,max=200)=>typeof v==='string'?v.trim().slice(0,max):'';
const integer=(v:unknown,min=0,max=100000000)=>typeof v==='number'&&Number.isInteger(v)&&v>=min&&v<=max;
async function hash(s:string){return [...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(s)))].map(x=>x.toString(16).padStart(2,'0')).join('');}
async function request(path:string,init:RequestInit={}) {
 const r=await fetch(BASE+path,{...init,headers:{apikey:SECRET,Authorization:`Bearer ${SECRET}`,'Content-Type':'application/json',...init.headers}});
 const txt=await r.text(); let data; try{data=txt?JSON.parse(txt):null;}catch{data=null;}
 if(!r.ok&&data?.code==='40001')throw new ApiError('O carrinho foi atualizado em outro acesso. Confira os itens antes de continuar.',409);
 if(!r.ok) throw new ApiError(r.status===409?'Este registro já existe.':r.status===400?'Confira os dados informados.':'Não foi possível concluir. Tente novamente.',r.status===401?401:400);
 return data;
}
const db=(table:string,query='',method='GET',body?:unknown)=>request(`/rest/v1/${table}${query?`?${query}`:''}`,{method,headers:{Prefer:'return=representation'},...(body!==undefined?{body:JSON.stringify(body)}:{})});
const rpc=(name:string,args:unknown)=>request('/rest/v1/rpc/'+name,{method:'POST',body:JSON.stringify(args)});
async function admin(req:Request){
 const token=req.headers.get('authorization'); if(!token?.startsWith('Bearer '))throw new ApiError('Entre na sua conta para continuar.',401);
 const r=await fetch(BASE+'/auth/v1/user',{headers:{apikey:SECRET,Authorization:token}}); if(!r.ok)throw new ApiError('Sua sessão expirou. Entre novamente.',401);
 const user=await r.json(); const rows=await db('yp_admins',`user_id=eq.${user.id}&select=user_id,username,role,active,must_change_password`);
 if(!rows?.[0]?.active)throw new ApiError('Este acesso administrativo está desativado.',401);
 let sessionId='';try{sessionId=JSON.parse(atob(token.slice(7).split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).session_id;}catch{}
 if(!uuid(sessionId)||!await rpc('yp_admin_session_valid',{p_user:user.id,p_session:sessionId}))throw new ApiError('Sua sessão expirou. Entre novamente.',401);
 return rows[0];
}
const username=(v:unknown)=>typeof v==='string'?v.trim().toLowerCase():'';
const validUsername=(v:string)=>/^[a-z0-9][a-z0-9._-]{2,39}$/.test(v);
const validPassword=(v:unknown)=>typeof v==='string'&&v.length>=12&&new TextEncoder().encode(v).length<=72;
const internalEmail=()=>`staff-${crypto.randomUUID()}@accounts.yogomarcas.invalid`;
async function passwordSession(email:string,password:string){
 const r=await fetch(BASE+'/auth/v1/token?grant_type=password',{method:'POST',headers:{apikey:SECRET,'Content-Type':'application/json'},body:JSON.stringify({email,password})});
 if(!r.ok)throw new ApiError('Login ou senha inválidos.',401);
 return r.json();
}
async function loginAdmin(req:Request,b:any){
 await rate(req,b,'admin_login');const name=username(b.username),hour=Math.floor(Date.now()/3600000);
 if(!validUsername(name)||typeof b.password!=='string'||b.password.length>72)throw new ApiError('Login ou senha inválidos.',401);
 if(!await rpc('yp_check_rate',{p_key:await hash('admin:'+name+':'+hour),p_limit:20,p_expiry:new Date((hour+2)*3600000).toISOString()}))throw new ApiError('Muitas tentativas. Aguarde e tente novamente.',429);
 const account=(await db('yp_admins',`username=eq.${encodeURIComponent(name)}&select=user_id,email,active`))[0];
 // Run the same Auth request even for an unknown/disabled login; never expose its email.
 const session=await passwordSession(account?.active?account.email:'unknown@accounts.yogomarcas.invalid',b.password);
 if(!account?.active||session.user?.id!==account.user_id)throw new ApiError('Login ou senha inválidos.',401);
 return {access_token:session.access_token,refresh_token:session.refresh_token,expires_in:session.expires_in,token_type:'bearer'};
}

async function rate(req:Request,b:any,action:string){
 const ip=(req.headers.get('x-forwarded-for')||req.headers.get('cf-connecting-ip')||'unknown').split(',')[0];
 const hour=Math.floor(Date.now()/3600000); const ipKey=await hash(ip+':'+action+':'+hour);
 const limit=action==='admin_login'?60:action==='setup'?10:action==='order'?100:action==='customer_cart_save'?1000:action.startsWith('customer_')?300:1000;
 const allowed=await rpc('yp_check_rate',{p_key:ipKey,p_limit:limit,p_expiry:new Date((hour+2)*3600000).toISOString()});
 if(!allowed)throw new ApiError('Muitas tentativas. Aguarde um pouco e tente novamente.',429);
 if(uuid(b.session_id)){
  const ok=await rpc('yp_check_rate',{p_key:`${b.session_id}:${action}:${hour}`,p_limit:action==='order'?15:300,p_expiry:new Date((hour+2)*3600000).toISOString()});
  if(!ok)throw new ApiError('Aguarde antes de tentar novamente.',429);
 }
}
async function catalog(){
 const [lines,products,s,flavors,upsell_rules]=await Promise.all([db('yp_lines','active=eq.true&order=position,name'),db('yp_products','deleted_at=is.null&active=eq.true&order=position,name'),db('yp_settings','id=eq.1'),db('yp_flavors','deleted_at=is.null&active=eq.true&order=position,name&limit=10000'),db('yp_upsell_rules','active=eq.true&order=priority,id')]);
 const ids=new Set(lines.map((l:any)=>l.id));return {lines,upsell_rules,products:products.filter((p:any)=>ids.has(p.line_id)).map((p:any)=>({...p,bundle_units:p.bundle_enabled===false?null:BUNDLE_UNITS,bundle_price:p.bundle_enabled===false?null:bundlePrice(p.package_price)})),flavors:flavors.filter((f:any)=>products.some((p:any)=>p.id===f.product_id&&ids.has(p.line_id))).map((f:any)=>({...f,bundle_price:products.find((p:any)=>p.id===f.product_id)?.bundle_enabled===false?null:bundlePrice(f.package_price)})),settings:s[0]};
}
async function createUser(email:string,password:string){return request('/auth/v1/admin/users',{method:'POST',body:JSON.stringify({email,password,email_confirm:true})});}

function phoneNumber(value:unknown){let n=str(value,40).replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;if(!/^55[1-9]\d{9,10}$/.test(n))throw new ApiError('Informe um telefone brasileiro com DDD.');return n;}
function publicCustomer(c:any){const {pin_hash,pin_salt,...profile}=c;return profile;}
function profileInput(b:any){
 const store=str(b.store_name,160),contact=str(b.contact_name,120);if(store.length<2)throw new ApiError('Informe o nome da loja.');
 if(!Array.isArray(b.portions)||b.portions.length<1||b.portions.length>12)throw new ApiError('Cadastre pelo menos um formato de venda.');
 const ids=new Set(),formats=new Set();const portions=b.portions.map((p:any)=>{const id=str(p.id,60),name=str(p.name,80);if(!/^[a-zA-Z0-9_-]{1,60}$/.test(id)||ids.has(id)||name.length<2||!integer(p.grams,10,10000)||!integer(p.price,1,1000000))throw new ApiError('Confira nome, peso em gramas e preço de cada formato.');const format=name.toLocaleLowerCase()+'|'+p.grams;if(formats.has(format))throw new ApiError('Não repita o mesmo formato e peso.');formats.add(format);ids.add(id);return {id,name,grams:p.grams,price:p.price};});
 const preferred=portions.some((p:any)=>p.id===b.preferred_portion_id)?b.preferred_portion_id:portions[0].id;
 return {store_name:store,contact_name:contact,portions,preferred_portion_id:preferred};
}
async function pinDigest(pin:unknown,salt:string){if(typeof pin!=='string'||!/^\d{6}$/.test(pin))throw new ApiError('Use um PIN com 6 números.');const key=await crypto.subtle.importKey('raw',new TextEncoder().encode(pin),'PBKDF2',false,['deriveBits']);const bits=await crypto.subtle.deriveBits({name:'PBKDF2',hash:'SHA-256',salt:new TextEncoder().encode(salt),iterations:210000},key,256);return [...new Uint8Array(bits)].map(x=>x.toString(16).padStart(2,'0')).join('');}
function equalSecret(a:string,b:string){if(a.length!==b.length)return false;let x=0;for(let i=0;i<a.length;i++)x|=a.charCodeAt(i)^b.charCodeAt(i);return x===0;}
async function deviceHash(token:unknown){if(typeof token!=='string'||!/^[0-9a-f]{64}$/.test(token))throw new ApiError('Identifique sua loja para continuar.',401);return hash(token);}
async function customerAuth(token:unknown){const digest=await deviceHash(token);const devices=await db('yp_customer_devices',`token_hash=eq.${digest}&revoked_at=is.null`);if(!devices.length)throw new ApiError('Entre novamente com telefone e PIN.',401);const customer=(await db('yp_customers',`id=eq.${devices[0].customer_id}`))[0];if(!customer)throw new ApiError('Cadastro indisponível.',401);return customer;}
async function issueDevice(customer_id:string,digest:string){const old=await db('yp_customer_devices',`token_hash=eq.${digest}`);if(old.length){if(old[0].customer_id!==customer_id||old[0].revoked_at)throw new ApiError('Tente entrar novamente.',409);return;}await db('yp_customer_devices','','POST',{token_hash:digest,customer_id});}
async function shoppingAction(req:Request,b:any,action:string){
 const c=await customerAuth(b.device_token);await rate(req,b,action);
 if(action==='customer_history'){
  const page=integer(b.page,0,100000)?b.page:0;
  const rows=await db('yp_orders',`customer_id=eq.${c.id}&is_test=eq.false&select=id,public_number,items,total,status,created_at&order=created_at.desc,id.desc&limit=21&offset=${page*20}`);
  return {orders:rows.slice(0,20).map((o:any)=>({id:o.id,public_number:o.public_number,items:o.items,total:o.total,status:o.status,created_at:o.created_at})),has_more:rows.length>20};
 }
 if(action==='customer_favorites')return {flavor_ids:(await db('yp_customer_favorites',`customer_id=eq.${c.id}&select=flavor_id&limit=10000`)).map((f:any)=>f.flavor_id)};
 if(action==='customer_favorite'){
  if(!uuid(b.flavor_id)||typeof b.selected!=='boolean')throw new ApiError('Sabor inválido.');
  if(b.selected){const cat=await catalog();if(!cat.flavors.some((f:any)=>f.id===b.flavor_id))throw new ApiError('Este sabor não está no catálogo.',409);
   await request('/rest/v1/yp_customer_favorites?on_conflict=customer_id,flavor_id',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify({customer_id:c.id,flavor_id:b.flavor_id})});
  }else await db('yp_customer_favorites',`customer_id=eq.${c.id}&flavor_id=eq.${b.flavor_id}`,'DELETE');
  return {ok:true};
 }
 if(action==='customer_cart')return {cart:(await db('yp_customer_carts',`customer_id=eq.${c.id}&select=revision,items,total,status,updated_at`))[0]||null};
 if(action==='customer_cart_save'){
  if(!integer(b.revision,0,Number.MAX_SAFE_INTEGER)||!Array.isArray(b.items)||b.items.length>200)throw new ApiError('Carrinho inválido.');
  const cat=await catalog(),offer=cartOffer(cat,b.items),seen=new Set();let offers=0;
  const items=b.items.map((i:any)=>{
   if(!uuid(i.product_id)||(i.flavor_id&&!uuid(i.flavor_id))||!['package','bundle'].includes(i.mode)||!integer(i.quantity,1,999))throw new ApiError('Confira os itens do carrinho.');
   const key=i.product_id+':'+(i.flavor_id||'')+':'+i.mode;if(seen.has(key))throw new ApiError('Item repetido no carrinho.');seen.add(key);
   const p=cat.products.find((p:any)=>p.id===i.product_id),f=cat.flavors.find((f:any)=>f.id===i.flavor_id&&f.product_id===p?.id);
   if(!p||(p.has_flavors?!f:!!i.flavor_id))throw new ApiError('Um item saiu do catálogo. Revise o pedido.',409);
   if(i.mode==='bundle'&&p.bundle_enabled===false)throw new ApiError(`${p.name} está disponível apenas por pacote. Revise os fardos do carrinho.`,409);
   const source=f||p;let price=i.mode==='bundle'?source.bundle_price:source.package_price;
   if(i.upsell===true){if(++offers>1||!matchesOffer(i,offer))throw new ApiError('A sugestão mudou. Revise o pedido.',409);price=offer!.price;}
   if(!integer(price,1)||(i.mode==='bundle'&&!integer(p.bundle_units,2,1000)))throw new ApiError('Um preço mudou. Revise o pedido.',409);
   return {product_id:p.id,flavor_id:f?.id||null,mode:i.mode,quantity:i.quantity,upsell:i.upsell===true,upsell_rule_id:i.upsell===true?offer!.rule_id:null,name:p.name+(f?' · '+f.name:''),unit_price:price,bundle_units:i.mode==='bundle'?p.bundle_units:1};
  });
  const total=items.reduce((sum:number,i:any)=>sum+i.unit_price*i.quantity,0);if(!integer(total,0,100000000))throw new ApiError('Carrinho acima do limite.');
  return rpc('yp_save_customer_cart',{p_customer:c.id,p_revision:b.revision,p_items:items,p_total:total});
 }
 throw new ApiError('Ação não encontrada.',404);
}

async function customerAction(req:Request,b:any,action:string){
 if(['customer_history','customer_favorites','customer_favorite','customer_cart','customer_cart_save'].includes(action))return shoppingAction(req,b,action);
 if(action==='customer_start'){await rate(req,b,'customer_start');const phone=phoneNumber(b.phone);const existing=await db('yp_customers',`phone=eq.${phone}&select=id`);return {exists:existing.length>0};}
 if(action==='customer_restore'){await rate(req,b,'customer_restore');return {profile:publicCustomer(await customerAuth(b.device_token))};}
 if(action==='customer_register'){
  await rate(req,b,'customer_register');const phone=phoneNumber(b.phone),digest=await deviceHash(b.device_token),input=profileInput(b);
  const prior=await db('yp_customer_devices',`token_hash=eq.${digest}&revoked_at=is.null`);
  if(prior.length){const c=await customerAuth(b.device_token);if(c.phone!==phone)throw new ApiError('Aparelho associado a outro cadastro.',403);return {profile:publicCustomer(c)};}
  const salt=crypto.randomUUID(),pin_hash=await pinDigest(b.pin,salt),id=crypto.randomUUID();
  if((await db('yp_customers',`phone=eq.${phone}&select=id`)).length)throw new ApiError('Este telefone já tem cadastro. Volte e entre com seu PIN.',409);
  await rpc('yp_register_customer',{p_id:id,p_phone:phone,p_store:input.store_name,p_contact:input.contact_name,p_portions:input.portions,p_preferred:input.preferred_portion_id,p_pin_hash:pin_hash,p_salt:salt,p_token_hash:digest});
  return {profile:publicCustomer((await db('yp_customers',`id=eq.${id}`))[0])};
 }
 if(action==='customer_login'){
  await rate(req,b,'customer_login');const phone=phoneNumber(b.phone),digest=await deviceHash(b.device_token);
  const slot=Math.floor(Date.now()/900000),key=await hash('customer-pin:'+phone+':'+slot);
  const allowed=await rpc('yp_check_rate',{p_key:key,p_limit:8,p_expiry:new Date((slot+2)*900000).toISOString()});if(!allowed)throw new ApiError('Muitas tentativas. Tente novamente em 15 minutos.',429);
  const c=(await db('yp_customers',`phone=eq.${phone}`))[0];
  const supplied=await pinDigest(b.pin,c?.pin_salt||'unknown-profile');if(!c||!equalSecret(supplied,c.pin_hash))throw new ApiError('Telefone ou PIN incorreto.',401);
  await issueDevice(c.id,digest);return {profile:publicCustomer(c)};
 }
 if(action==='customer_update'){const c=await customerAuth(b.device_token),input=profileInput(b);return {profile:publicCustomer((await db('yp_customers',`id=eq.${c.id}`,'PATCH',{...input,updated_at:new Date().toISOString()}))[0])};}
 if(action==='customer_preference'){const c=await customerAuth(b.device_token);if(!c.portions.some((p:any)=>p.id===b.portion_id))throw new ApiError('Formato inválido.');await db('yp_customers',`id=eq.${c.id}`,'PATCH',{preferred_portion_id:b.portion_id});return {ok:true};}
 if(action==='customer_forget'){const digest=await deviceHash(b.device_token);await db('yp_customer_devices',`token_hash=eq.${digest}`,'PATCH',{revoked_at:new Date().toISOString()});return {ok:true};}
 throw new ApiError('Ação não encontrada.',404);
}

async function saveOrder(b:any){
 if(!uuid(b.id)||!uuid(b.session_id)||!uuid(b.client_token))throw new ApiError('Pedido inválido. Atualize a página.');
 const profile=await customerAuth(b.customer_device_token);
 const tokenHash=await hash(b.client_token); const old=await db('yp_orders',`id=eq.${b.id}`);
 if(old.length){if(old[0].client_token_hash!==tokenHash||old[0].customer_id!==profile.id)throw new ApiError('Pedido indisponível.',403);return old[0];}
 if(b.profile_version!==profile.updated_at)throw new ApiError('Os dados da loja mudaram. Atualize seu cadastro e confira a previsão antes de continuar.',409);
 const c={...(b.customer||{}),company:profile.store_name,phone:profile.phone}; const phone=profile.phone;
 if(str(c.name).length<2||str(c.company).length<2||phone.length<10||phone.length>13||str(c.city).length<2||!['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'].includes(c.state))throw new ApiError('Preencha nome, empresa, WhatsApp, cidade e estado.');
 if(!Array.isArray(b.items)||!b.items.length||b.items.length>200)throw new ApiError('Adicione produtos ao pedido.');
 const cat=await catalog();const {products,flavors,settings}=cat;const offer=cartOffer(cat,b.items); if(!settings.ordering_enabled)throw new ApiError('O catálogo está sendo atualizado. Fale com nossa equipe.',409);
 const seen=new Set(); let upsells=0;
 const items=b.items.map((item:any)=>{
  if(!uuid(item.product_id)||!['package','bundle'].includes(item.mode)||!integer(item.quantity,1,999))throw new ApiError('Confira as quantidades do pedido.');
  if(item.flavor_id&&!uuid(item.flavor_id))throw new ApiError('Sabor inválido.');
  const key=item.product_id+':'+(item.flavor_id||'')+':'+item.mode;if(seen.has(key))throw new ApiError('Produto repetido no pedido.');seen.add(key);
  const parent=products.find((p:any)=>p.id===item.product_id);if(!parent?.available)throw new ApiError('Um produto ficou indisponível. Revise o carrinho.',409);
  if(item.mode==='bundle'&&parent.bundle_enabled===false)throw new ApiError(`${parent.name} está disponível apenas por pacote. Revise os fardos do carrinho.`,409);
  const f=flavors.find((f:any)=>f.id===item.flavor_id&&f.product_id===parent.id);
  if(parent.has_flavors?(!f||!f.available):!!item.flavor_id)throw new ApiError('Escolha um sabor disponível desta linha.',409);
  const p=f?{...parent,package_price:f.package_price,bundle_price:f.bundle_price,package_weight_grams:f.package_weight_grams}:parent;
  let price=item.mode==='bundle'?p.bundle_price:p.package_price;
  const upsell=item.upsell===true;
  if(upsell){
   upsells++;if(upsells>1||!matchesOffer(item,offer))throw new ApiError('A sugestão do carrinho mudou. Revise seu pedido.',409);
   price=offer!.price;
  }
  if(!integer(price,1)||item.mode==='bundle'&&!integer(p.bundle_units,2,1000))throw new ApiError('Um preço está em atualização. Revise o carrinho.',409);
  if(item.unit_price!==price)throw new ApiError('Os preços foram atualizados. Revise os novos valores antes de continuar.',409);
  return {product_id:p.id,flavor_id:f?.id||null,flavor_name:f?.name||null,product_name:p.name,package_weight_grams:p.package_weight_grams??null,name:p.name+(f?` · ${f.name}`:''),sku:p.sku,internal_code:f?.sku||p.sku,mode:item.mode,package_label:p.package_label,quantity:item.quantity,bundle_units:item.mode==='bundle'?p.bundle_units:1,units:item.quantity*(item.mode==='bundle'?p.bundle_units:1),unit_price:price,line_total:price*item.quantity,upsell,upsell_rule_id:upsell?offer!.rule_id:null,yield_grams:p.yield_grams,yield_min_grams:p.yield_min_grams};
 });
 if(upsells&&!items.some((i:any)=>!i.upsell))throw new ApiError('Adicione outro produto para incluir a sugestão.',409);
 const total=items.reduce((s:number,i:any)=>s+i.line_total,0); if(!Number.isSafeInteger(total)||total>100000000)throw new ApiError('Pedido acima do limite. Fale com nossa equipe.');
 if(total<settings.minimum_order)throw new ApiError('O pedido ainda não atingiu o valor mínimo.');
 const portion=profile.portions.find((p:any)=>p.id===b.portion_id)||profile.portions.find((p:any)=>p.id===profile.preferred_portion_id)||profile.portions[0];
 const projection=portion?calculateProjection(items,portion):null;
 if(b.cart_revision!==undefined&&!integer(b.cart_revision,0,Number.MAX_SAFE_INTEGER))throw new ApiError('Versão do carrinho inválida.');
 const order={cart_revision:b.cart_revision??null,customer_id:profile.id,projection_snapshot:projection,id:b.id,public_number:'YG-'+crypto.randomUUID().replaceAll('-','').slice(0,16).toUpperCase(),client_token_hash:tokenHash,session_id:b.session_id,customer_name:str(c.name),company:str(c.company),phone,city:str(c.city),state:c.state,customer_code:str(c.code,50),notes:str(c.notes,1000),items,total};
 try{return (await db('yp_orders','','POST',order))[0];}catch(err){
  const retry=await db('yp_orders',`id=eq.${b.id}`);if(retry[0]?.client_token_hash===tokenHash&&retry[0]?.customer_id===profile.id)return retry[0];throw err;
 }
}
const message=orderMessage;
Deno.serve(async(req:Request)=>{
 if(req.method==='OPTIONS')return new Response('ok',{headers:cors});
 try{
  if(req.method==='GET')return json(await catalog());
  if(req.method!=='POST')throw new ApiError('Método não permitido.',405);
  if(Number(req.headers.get('content-length')||0)>7500000)throw new ApiError('Arquivo muito grande.');
  const reader=req.body?.getReader();let size=0;const chunks:Uint8Array[]=[];
  if(reader){while(true){const part=await reader.read();if(part.done)break;size+=part.value.byteLength;if(size>7500000){await reader.cancel();throw new ApiError('Arquivo muito grande.');}chunks.push(part.value);}}
  const bytes=new Uint8Array(size);let offset=0;for(const part of chunks){bytes.set(part,offset);offset+=part.length;}const raw=new TextDecoder().decode(bytes);
  let b:any;try{b=JSON.parse(raw);}catch{throw new ApiError('Dados inválidos.');}
  if(!b||typeof b!=='object')throw new ApiError('Dados inválidos.');
  const action=str(b.action,40);
  if(action.startsWith('customer_'))return json(await customerAction(req,b,action));
  if(action==='admin_login')return json(await loginAdmin(req,b));
  if(action==='setup'){
   await rate(req,b,'setup'); const token=str(b.setup_token,128);const email=internalEmail();
   if(token.length<40||!validPassword(b.password))throw new ApiError('Use uma senha de 12 a 72 caracteres.');
   const tokenHash=await hash(token);const setup=await db('yp_setup',`id=eq.1&token_hash=eq.${tokenHash}&used_at=is.null&expires_at=gt.${encodeURIComponent(new Date().toISOString())}`);
   if(!setup.length)throw new ApiError('O link de ativação é inválido, já foi usado ou expirou.',403);
   const user=await createUser(email,b.password);
   let ok=false;try{ok=await rpc('yp_claim_owner',{p_hash:tokenHash,p_user:user.id,p_email:email});}catch(error){
    const bound=await db('yp_admins',`user_id=eq.${user.id}`);if(bound.length)return json({ok:true});
    await request('/auth/v1/admin/users/'+user.id,{method:'DELETE'});throw error;
   }
   if(!ok){await request('/auth/v1/admin/users/'+user.id,{method:'DELETE'});throw new ApiError('A administração já foi ativada.',409);}
   return json({ok:true});
  }
  if(action==='events'){
   await rate(req,b,'events');if(!uuid(b.session_id)||!Array.isArray(b.events)||b.events.length>20)throw new ApiError('Eventos inválidos.');
   const types=['visit','product_view','product_click','add_to_cart','checkout','upsell_view','upsell_add'];
   const events=b.events.filter((e:any)=>uuid(e.id)&&types.includes(e.type)&&(!e.product_id||uuid(e.product_id))&&(!e.flavor_id||uuid(e.flavor_id))).map((e:any)=>({id:e.id,session_id:b.session_id,type:e.type,product_id:e.product_id||null,flavor_id:e.flavor_id||null}));
   if(events.some((e:any)=>e.flavor_id)){const ids=events.filter((e:any)=>e.flavor_id).map((e:any)=>e.flavor_id);const fs=await db('yp_flavors',`id=in.(${ids.join(',')})&select=id,product_id`);if(events.some((e:any)=>e.flavor_id&&!fs.some((f:any)=>f.id===e.flavor_id&&f.product_id===e.product_id)))throw new ApiError('Sabor inválido.');}
   if(events.length)await request('/rest/v1/yp_events',{method:'POST',headers:{Prefer:'resolution=ignore-duplicates'},body:JSON.stringify(events)});
   return json({ok:true});
  }
  if(action==='order'){
   await rate(req,b,'order');const o=await saveOrder(b);const settings=(await db('yp_settings','id=eq.1'))[0];
   return json({cart_revision:o.cart_revision===null?0:o.cart_revision+1,id:o.id,number:o.public_number,total:o.total,message:message(o),whatsapp_url:`https://wa.me/${settings.whatsapp}?text=${encodeURIComponent(message(o))}`});
  }
  const who=await admin(req);
  if(who.must_change_password&&!['admin_data','change_password'].includes(action))throw new ApiError('Defina sua nova senha para continuar.',403);
  if(action==='retention_queue'){
   if(!['reorder','carts','frequency'].includes(b.kind))throw new ApiError('Filtro inválido.');
   const result=await rpc('yp_retention_queue',{p_kind:b.kind,p_page:integer(b.page,0,100000)?b.page:0,p_search:str(b.search,100)});
   return json({...result,has_more:result.rows.length>50,rows:result.rows.slice(0,50)});
  }
  if(action==='save_customer_cycle'){
   if(!uuid(b.customer_id)||!(b.cycle_days===null||integer(b.cycle_days,1,365)))throw new ApiError('Informe uma frequência de 1 a 365 dias.');
   await request('/rest/v1/yp_customer_followups?on_conflict=customer_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({customer_id:b.customer_id,cycle_days:b.cycle_days})});return json({ok:true});
  }
  if(action==='snooze_reorder'){
   if(!uuid(b.customer_id))throw new ApiError('Cliente inválido.');
   await request('/rest/v1/yp_customer_followups?on_conflict=customer_id',{method:'POST',headers:{Prefer:'resolution=merge-duplicates'},body:JSON.stringify({customer_id:b.customer_id,snoozed_until:new Date(Date.now()+7*86400000).toISOString()})});return json({ok:true});
  }
  if(action==='dismiss_cart'){
   if(!uuid(b.customer_id)||!integer(b.revision,0,Number.MAX_SAFE_INTEGER))throw new ApiError('Carrinho inválido.');
   const rows=await db('yp_customer_carts',`customer_id=eq.${b.customer_id}&revision=eq.${b.revision}&status=eq.active`,'PATCH',{dismissed_revision:b.revision});
   if(!rows.length)throw new ApiError('Este carrinho foi atualizado. Recarregue a lista.',409);return json({ok:true});
  }
  if(action==='save_upsell_rule'){
   const r=b.rule||{};if(r.id&&!uuid(r.id)||!uuid(r.trigger_product_id)||!uuid(r.product_id)||r.trigger_product_id===r.product_id||r.flavor_id&&!uuid(r.flavor_id)||!(r.price===null||integer(r.price,1))||!integer(r.priority,0,999))throw new ApiError('Confira a regra de sugestão.');
   const cat=await catalog(),p=cat.products.find((p:any)=>p.id===r.product_id),trigger=cat.products.find((p:any)=>p.id===r.trigger_product_id),f=cat.flavors.find((f:any)=>f.id===r.flavor_id&&f.product_id===p?.id);
   if(r.active&&(!trigger||!p?.available||(p.has_flavors?!f?.available:!!r.flavor_id)))throw new ApiError('Escolha produtos e sabores disponíveis.');
   const price=f?.package_price??p?.package_price;if(r.active&&(!price||r.price&&r.price>price))throw new ApiError('A sugestão precisa de preço válido, até o preço regular.');
   const value={trigger_product_id:r.trigger_product_id,product_id:r.product_id,flavor_id:r.flavor_id||null,title:str(r.title,100)||'Complete seu pedido',description:str(r.description,300),price:r.price,priority:r.priority,active:r.active===true};
   return json((await db('yp_upsell_rules',r.id?`id=eq.${r.id}`:'',r.id?'PATCH':'POST',value))[0]);
  }
  if(action==='toggle_contextual_upsell'){await db('yp_settings','id=eq.1','PATCH',{contextual_upsell_enabled:b.enabled===true});return json({ok:true});}
  if(action==='admin_customers'){const result=await rpc('yp_customer_directory',{p_search:str(b.search,100),p_page:integer(b.page,0,100000)?b.page:0});return json({...result,has_more:result.customers.length>50,customers:result.customers.slice(0,50)});}
  if(action==='reset_customer_pin'){if(!uuid(b.customer_id))throw new ApiError('Cadastro inválido.');const salt=crypto.randomUUID(),pin_hash=await pinDigest(b.pin,salt);await rpc('yp_reset_customer_pin',{p_customer:b.customer_id,p_hash:pin_hash,p_salt:salt});return json({ok:true});}
  if(action==='admin_data'){
   const [lines,products,settings,admins,flavors,upsell_rules]=await Promise.all([db('yp_lines','order=position,name'),db('yp_products','deleted_at=is.null&order=position,name'),db('yp_settings','id=eq.1'),who.role==='owner'?db('yp_admins','select=user_id,username,role,active,must_change_password,created_at'):Promise.resolve([]),db('yp_flavors','deleted_at=is.null&order=position,name&limit=10000'),db('yp_upsell_rules','order=priority,id')]);
   return json({lines,products,flavors,upsell_rules,settings:settings[0],admins,me:who});
  }
  if(action==='metrics'){
   const from=new Date(b.from),to=new Date(b.to);if(!Number.isFinite(+from)||!Number.isFinite(+to)||from>=to||+to-+from>366*86400000)throw new ApiError('Selecione um período de até um ano.');
   const args={p_from:from.toISOString(),p_to:to.toISOString()};const [metrics,flavors]=await Promise.all([rpc('yp_metrics',args),rpc('yp_flavor_metrics',args)]);return json({...metrics,flavors});
  }
  if(action==='orders'){
   const page=integer(b.page,0,100000)?b.page:0;const status=['prepared','contacted','confirmed','fulfilled','cancelled'].includes(b.status)?`&status=eq.${b.status}`:'';
   const from=new Date(b.from),to=new Date(b.to);if(!Number.isFinite(+from)||!Number.isFinite(+to))throw new ApiError('Período inválido.');
   const rows=await db('yp_orders',`select=id,public_number,customer_name,company,phone,city,state,customer_code,notes,items,total,status,status_note,created_at,customer_id,projection_snapshot&is_test=eq.false&created_at=gte.${encodeURIComponent(from.toISOString())}&created_at=lt.${encodeURIComponent(to.toISOString())}${status}&order=created_at.desc&limit=51&offset=${page*50}`);
   return json({orders:rows.slice(0,50),has_more:rows.length>50});
  }
  if(action==='delete_product'||action==='delete_flavor'){
   if(!uuid(b.id)||(action==='delete_flavor'&&!uuid(b.product_id)))throw new ApiError('Selecione um produto ou sabor válido.');
   const result=await rpc('yp_delete_catalog_item',{p_kind:action==='delete_product'?'product':'flavor',p_id:b.id,p_product:action==='delete_flavor'?b.product_id:null});
   if(!result.deleted)throw new ApiError('Este item já foi excluído ou não pertence a esta linha. Atualize o catálogo.',409);
   return json(result);
  }
  if(action==='save_product'){
   const p=b.product||{};if(!str(p.name)||!str(p.sku)||!uuid(p.line_id))throw new ApiError('Preencha nome, código e linha.');
   const nullable=(v:any,min:number)=>v===null||integer(v,min,20000000);
   if(p.bundle_enabled!==undefined&&typeof p.bundle_enabled!=='boolean')throw new ApiError('Informe se a compra por fardo está permitida.');
   if(!nullable(p.package_price,1))throw new ApiError('Confira os preços e a composição do fardo.');
   if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/.test(str(p.sku,61)))throw new ApiError('Informe um código interno válido, com até 60 caracteres.');
   const img=str(p.image_url,2000);if(img&&!/^https:\/\//.test(img)&&!/^\/assets\/[a-zA-Z0-9._-]+$/.test(img))throw new ApiError('Informe uma imagem HTTPS válida.');
   const yg=p.yield_grams??null,ym=p.yield_min_grams??null;if(!((yg===null&&ym===null)||(integer(yg,1,100000)&&integer(ym,1,yg))))throw new ApiError('Confira a faixa de rendimento por pacote.');
   if(!(p.package_weight_grams==null||integer(p.package_weight_grams,1,100000)))throw new ApiError('Confira o peso.');
   const data={...(p.bundle_enabled===undefined?{}:{bundle_enabled:p.bundle_enabled}),has_flavors:p.has_flavors===true,package_weight_grams:p.package_weight_grams??null,yield_grams:yg,yield_min_grams:ym,line_id:p.line_id,name:str(p.name),sku:str(p.sku,60).toUpperCase(),description:str(p.description,2000),image_url:img,package_label:str(p.package_label,40)||'Pacote',package_price:p.package_price,bundle_units:BUNDLE_UNITS,bundle_price:bundlePrice(p.package_price),active:p.active===true,available:p.available===true,position:integer(p.position,0,999)?p.position:0,updated_at:new Date().toISOString()};
   if(p.id&&!uuid(p.id))throw new ApiError('Produto inválido.');const saved=(await db('yp_products',p.id?`id=eq.${p.id}&deleted_at=is.null`:'',p.id?'PATCH':'POST',data))[0];if(!saved)throw new ApiError('Este produto foi excluído. Atualize o catálogo.',409);return json(saved);
  }
  if(action==='save_flavor'){
   const f=b.flavor||{};if(!uuid(f.product_id)||!str(f.name,120)||f.id&&!uuid(f.id))throw new ApiError('Informe linha e nome do sabor.');
   if(!(f.package_price===null||integer(f.package_price,1,20000000))||!(f.package_weight_grams===null||integer(f.package_weight_grams,1,100000)))throw new ApiError('Confira os preços e o peso do sabor.');
   const p=(await db('yp_products',`id=eq.${f.product_id}&deleted_at=is.null`))[0];if(!p)throw new ApiError('Esta linha foi excluída. Atualize o catálogo.',409);if(!p.has_flavors)throw new ApiError('Ative sabores no cadastro desta linha.');
   if(!/^[A-Za-z0-9][A-Za-z0-9._/-]{0,59}$/.test(str(f.sku,61)))throw new ApiError('Informe o código interno do sabor, com até 60 caracteres.');
   if(f.id&&!(await db('yp_flavors',`id=eq.${f.id}&product_id=eq.${f.product_id}&deleted_at=is.null`)).length)throw new ApiError('Este sabor foi excluído ou não pertence a esta linha. Atualize o catálogo.',409);
   const value={sku:str(f.sku,60).toUpperCase(),product_id:f.product_id,name:str(f.name,120),package_price:f.package_price,bundle_price:bundlePrice(f.package_price),package_weight_grams:f.package_weight_grams,active:f.active===true,available:f.available===true,position:integer(f.position,0,999)?f.position:0,updated_at:new Date().toISOString()};
   const saved=(await db('yp_flavors',f.id?`id=eq.${f.id}&deleted_at=is.null`:'',f.id?'PATCH':'POST',value))[0];if(!saved)throw new ApiError('Este sabor foi excluído. Atualize o catálogo.',409);return json(saved);
  }
  if(action==='save_line'){
   const l=b.line||{};if(!str(l.name))throw new ApiError('Dê um nome à linha.');if(l.id&&!uuid(l.id))throw new ApiError('Linha inválida.');
   return json((await db('yp_lines',l.id?`id=eq.${l.id}`:'',l.id?'PATCH':'POST',{name:str(l.name),description:str(l.description,500),active:l.active===true,position:integer(l.position,0,999)?l.position:0}))[0]);
  }
  if(action==='save_settings'){
   const s=b.settings||{};const phone=str(s.whatsapp,25).replace(/\D/g,'');if(!/^55\d{10,11}$/.test(phone))throw new ApiError('Informe o WhatsApp com 55 + DDD + número.');
   if(!integer(s.minimum_order)||!(s.upsell_price===null||integer(s.upsell_price,1))||s.upsell_product_id&&!uuid(s.upsell_product_id))throw new ApiError('Confira os valores da configuração.');
   if(s.upsell_flavor_id&&!uuid(s.upsell_flavor_id))throw new ApiError('Sabor inválido para sugestão.');
   if(s.upsell_product_id){const product=(await db('yp_products',`id=eq.${s.upsell_product_id}&deleted_at=is.null&select=id`))[0];if(!product)throw new ApiError('O produto sugerido foi excluído. Selecione outro.',409);}
   if(s.upsell_flavor_id){const flavor=(await db('yp_flavors',`id=eq.${s.upsell_flavor_id}&product_id=eq.${s.upsell_product_id}&deleted_at=is.null&select=id`))[0];if(!flavor)throw new ApiError('O sabor sugerido foi excluído. Selecione outro.',409);}
   if(s.upsell_enabled){
    let p=(await db('yp_products',`id=eq.${s.upsell_product_id||'00000000-0000-4000-8000-000000000000'}`))[0];
    if(p?.has_flavors){const f=(await db('yp_flavors',`id=eq.${s.upsell_flavor_id||'00000000-0000-4000-8000-000000000000'}&product_id=eq.${p.id}`))[0];if(!f?.active||!f?.available)throw new ApiError('Selecione um sabor disponível para a sugestão.');p={...p,package_price:f.package_price};}else if(s.upsell_flavor_id)throw new ApiError('Este produto não tem sabores.');
    if(!p?.active||!p?.available||!p?.package_price)throw new ApiError('Escolha um produto ativo com preço por unidade.');
    if(s.upsell_price&&s.upsell_price>p.package_price)throw new ApiError('O preço da sugestão não pode superar o preço regular.');
   }
   if(s.ordering_enabled){const c=await catalog();if(!c.products.some((p:any)=>p.available&&(p.has_flavors?c.flavors.some((f:any)=>f.product_id===p.id&&f.available&&f.package_price):(p.package_price||p.bundle_price))))throw new ApiError('Cadastre o preço de pelo menos um produto antes de liberar pedidos.');}
   return json((await db('yp_settings','id=eq.1','PATCH',{whatsapp:phone,minimum_order:s.minimum_order,notice:str(s.notice,500),ordering_enabled:s.ordering_enabled===true,upsell_enabled:s.upsell_enabled===true,upsell_product_id:s.upsell_product_id||null,upsell_flavor_id:s.upsell_flavor_id||null,upsell_title:str(s.upsell_title,100)||'Complete seu pedido',upsell_description:str(s.upsell_description,300),upsell_price:s.upsell_price}))[0]);
  }
  if(action==='order_status'){
   if(!uuid(b.id)||!['prepared','contacted','confirmed','fulfilled','cancelled'].includes(b.status))throw new ApiError('Status inválido.');
   await db('yp_orders',`id=eq.${b.id}`,'PATCH',{status:b.status,status_note:str(b.note,1000),updated_at:new Date().toISOString()});return json({ok:true});
  }
  if(action==='upload'){
   const mime=str(b.mime,50);if(!['image/jpeg','image/png','image/webp'].includes(mime)||typeof b.data!=='string'||b.data.length>7000000)throw new ApiError('Use JPG, PNG ou WebP de até 5 MB.');
   const bin=Uint8Array.from(atob(b.data),c=>c.charCodeAt(0));if(bin.byteLength>5242880)throw new ApiError('A imagem deve ter até 5 MB.');
   const valid=mime==='image/png'?bin[0]===137&&bin[1]===80&&bin[2]===78&&bin[3]===71:mime==='image/jpeg'?bin[0]===255&&bin[1]===216&&bin[2]===255:String.fromCharCode(...bin.slice(0,4))==='RIFF'&&String.fromCharCode(...bin.slice(8,12))==='WEBP';
   if(!valid)throw new ApiError('O arquivo não é uma imagem válida.');
   const file=crypto.randomUUID()+'.'+(mime==='image/jpeg'?'jpg':mime.split('/')[1]);
   await request('/storage/v1/object/yp-products/'+file,{method:'POST',headers:{'Content-Type':mime},body:bin});
   return json({url:BASE+'/storage/v1/object/public/yp-products/'+file});
  }
  if(action==='add_admin'){
   if(who.role!=='owner')throw new ApiError('Somente o responsável pode gerenciar acessos.',403);
   const name=username(b.username);if(!validUsername(name)||!validPassword(b.password))throw new ApiError('Use login de 3 a 40 caracteres e senha de 12 a 72 caracteres.');
   if((await db('yp_admins',`username=eq.${encodeURIComponent(name)}&select=user_id`)).length)throw new ApiError('Este login já existe. Redefina a senha ou escolha outro.',409);
   const email=internalEmail(),u=await createUser(email,b.password);
   try{await db('yp_admins','','POST',{user_id:u.id,email,username:name,role:'admin'});}catch(e){await request('/auth/v1/admin/users/'+u.id,{method:'DELETE'});throw e;}return json({ok:true});
  }
  if(action==='reset_admin_password'){
   if(who.role!=='owner'||!uuid(b.user_id)||b.user_id===who.user_id)throw new ApiError('Somente o responsável pode redefinir este acesso.',403);
   if(!validPassword(b.password))throw new ApiError('Use uma senha de 12 a 72 caracteres.');
   const member=(await db('yp_admins',`user_id=eq.${b.user_id}&role=eq.admin`))[0];if(!member)throw new ApiError('Acesso não encontrado.',404);
   // Invalidate old sessions before changing the credential. A refresh cannot bypass this cutoff.
   await db('yp_admins',`user_id=eq.${member.user_id}`,'PATCH',{sessions_valid_after:new Date().toISOString()});
   await request('/auth/v1/admin/users/'+member.user_id,{method:'PUT',body:JSON.stringify({password:b.password})});
   await db('yp_admins',`user_id=eq.${member.user_id}`,'PATCH',{active:true,must_change_password:false,sessions_valid_after:new Date().toISOString()});return json({ok:true});
  }
  if(action==='change_password'){
   if(!validPassword(b.password)||typeof b.current_password!=='string'||b.current_password===b.password)throw new ApiError('Escolha uma nova senha de 12 a 72 caracteres.');
   await loginAdmin(req,{username:who.username,password:b.current_password});
   await db('yp_admins',`user_id=eq.${who.user_id}`,'PATCH',{sessions_valid_after:new Date().toISOString()});
   await request('/auth/v1/admin/users/'+who.user_id,{method:'PUT',body:JSON.stringify({password:b.password})});
   await db('yp_admins',`user_id=eq.${who.user_id}`,'PATCH',{must_change_password:false,sessions_valid_after:new Date().toISOString()});return json({ok:true});
  }
  if(action==='remove_admin'){
   if(who.role!=='owner'||!uuid(b.user_id)||b.user_id===who.user_id)throw new ApiError('Não é possível remover este acesso.',403);
   await db('yp_admins',`user_id=eq.${b.user_id}&role=eq.admin`,'PATCH',{active:false,sessions_valid_after:new Date().toISOString()});return json({ok:true});
  }
  throw new ApiError('Ação não encontrada.',404);
 }catch(e){return json({error:e instanceof ApiError?e.message:'Não foi possível concluir. Tente novamente.'},e instanceof ApiError?e.status:500);}
});
