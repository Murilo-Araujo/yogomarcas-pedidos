const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const root=path.resolve(__dirname,'..'),read=file=>fs.readFileSync(path.join(root,file),'utf8');
const compile=source=>ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
function load(file,deps={}){const exports={};vm.runInNewContext(compile(read(file)),{exports,require:name=>deps[name]||{}});return exports;}
const retention=load('lib/retention.ts'),portal=load('lib/portal.ts',{'./retention':retention});
const {cartOffers,cartOffer,reconcileCartOffers,matchesOffer,orderMessage}=retention;
const {resolveCart,setVariantQuantity}=portal;
const id=n=>`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
const line=id(1),base=id(2),lub=id(3),chocolate=id(11),vanilla=id(12);
const trigger={product_id:line,flavor_id:chocolate,mode:'package',quantity:1};
const product=(id,name,price,has_flavors=false)=>({id,name,sku:name,active:true,available:true,has_flavors,package_price:price,bundle_price:price*5,bundle_units:5,bundle_enabled:true,package_label:'Pacote',image_url:'',yield_grams:null,yield_min_grams:null});
const flavor=(id,name,price)=>({id,name,product_id:line,active:true,available:true,package_price:price,bundle_price:price*5});
const rule=(id,product_id,flavor_id,trigger_flavor_id,priority,price=null)=>({id,trigger_product_id:line,trigger_flavor_id,product_id,flavor_id,title:'Complete seu pedido',description:'',priority,price,active:true});
function catalog(){return {lines:[],products:[product(line,'Sorvete',null,true),product(base,'Base',5095),{...product(lub,'Lubrificante',3500),bundle_enabled:false,bundle_units:null,bundle_price:null}],flavors:[flavor(chocolate,'Chocolate',2000),flavor(vanilla,'Baunilha',5000)],settings:{contextual_upsell_enabled:true,upsell_enabled:false,ordering_enabled:true,minimum_order:0},upsell_rules:[rule(id(21),base,null,null,0),rule(id(22),line,vanilla,chocolate,10,4500),rule(id(23),lub,null,null,80)]};}
const selected=(offer,mode='package',quantity=1)=>({product_id:offer.product_id,flavor_id:offer.flavor_id,mode,quantity,upsell:true,upsell_rule_id:offer.rule_id});
const total=items=>items.reduce((sum,i)=>sum+i.unit_price*i.quantity,0);

// Exercise the real Edge Function validators. Only authentication and database
// I/O are stubbed; no production customer, cart or order is written by tests.
const source=ts.createSourceFile('edge.ts',read('supabase/functions/order-portal/index.ts'),ts.ScriptTarget.Latest,true);
const names=['ApiError','shoppingAction','saveOrder','upsellRuleInput'];
const serverCode=source.statements.filter(n=>n.name&&names.includes(n.name.text)||ts.isVariableStatement(n)&&n.declarationList.declarations.some(d=>['uuid','str','integer'].includes(d.name.getText(source)))).map(n=>n.getText(source)).join('\n');
function server(c){
 const profile={id:id(99),store_name:'Teste isolado',phone:'5545999999999',updated_at:'test-version',portions:[]};
 const context={...retention,crypto:require('node:crypto'),catalog:async()=>c,customerAuth:async()=>profile,rate:async()=>{},hash:async()=> 'test-hash',rpc:async(name,args)=>args,db:async(table,query,method,body)=>method==='POST'?[body]:[]};
 vm.createContext(context);vm.runInContext(compile(serverCode+'\n;globalThis.api={shoppingAction,saveOrder,upsellRuleInput};'),context);
 return {save:items=>context.api.shoppingAction({}, {revision:0,items},'customer_cart_save'),order:items=>context.api.saveOrder({id:id(90),session_id:id(91),client_token:id(92),profile_version:profile.updated_at,items,customer:{name:'Teste',city:'Cascavel',state:'PR'}}),rule:r=>context.api.upsellRuleInput(r,c)};
}

test('chocolate triggers vanilla in the same line; other flavors do not',()=>{
 const c=catalog();assert.ok(cartOffers(c,[trigger]).some(o=>o.flavor_id===vanilla));
 assert.ok(!cartOffers(c,[{...trigger,flavor_id:vanilla}]).some(o=>o.flavor_id===vanilla));
 for(const mode of ['package','bundle'])assert.ok(!cartOffers(c,[trigger,{...trigger,flavor_id:vanilla,mode}]).some(o=>o.flavor_id===vanilla));
});
test('distinct suggestions keep priority and deduplicate the target flavor',()=>{
 const c=catalog();c.upsell_rules.push({...c.upsell_rules[1],id:id(24),priority:30,price:4200});
 const offers=cartOffers(c,[trigger]);assert.equal(offers.length,3);assert.equal(offers[0].product_id,base);assert.equal(offers[1].price,4500);assert.equal(offers[2].product_id,lub);
});
test('only available products, valid flavors and enabled bundle modes trigger offers',()=>{
 const c=catalog();c.products[0].bundle_enabled=false;assert.equal(cartOffers(c,[{...trigger,mode:'bundle'}]).length,0);
 assert.equal(cartOffers(c,[{...trigger,flavor_id:id(100)}]).length,0);
 c.flavors[0].available=false;assert.equal(cartOffers(c,[trigger]).length,0);
});
test('two bundles and three packages share the offer price; multiple complements are valid',async()=>{
 const c=catalog(),offers=cartOffers(c,[trigger]),v=offers.find(o=>o.flavor_id===vanilla);
 const cart=[trigger,selected(v,'bundle',2),selected(v,'package',3),selected(offers[0])];
 const resolved=resolveCart(cart,c);assert.equal(total(resolved),65595);assert.equal(resolved[1].units,10);assert.equal(resolved[1].unit_price,22500);
 const saved=await server(c).save(cart);assert.equal(saved.p_total,65595);assert.equal(saved.p_items.filter(i=>i.upsell).length,3);
 const order=await server(c).order(resolved);assert.equal(order.total,65595);
 const message=orderMessage(order);assert.match(message,/13 pacotes/);assert.doesNotMatch(message,/fardo/i);
});
test('editing quantity preserves a valid offer across packages and bundles',()=>{
 const c=catalog(),v=cartOffers(c,[trigger]).find(o=>o.flavor_id===vanilla);
 let cart=[trigger,selected(v)];cart=setVariantQuantity(cart,selected(v),'bundle',2);cart=setVariantQuantity(cart,selected(v),'package',3);
 assert.ok(cart.filter(i=>i.flavor_id===vanilla).every(i=>i.upsell));assert.equal(total(resolveCart(cart,c)),60500);
});
test('removing the trigger with another regular item restores catalogue prices and saves',async()=>{
 const c=catalog(),offer=cartOffer(c,[trigger]),original=[trigger,selected(offer),{product_id:lub,mode:'package',quantity:1}];
 const next=reconcileCartOffers(original.filter(i=>i.product_id!==line),c);
 assert.equal(next.find(i=>i.product_id===base).upsell,false);assert.equal(next.find(i=>i.product_id===base).upsell_rule_id,null);
 assert.equal(total(resolveCart(next,c)),8595);assert.equal((await server(c).save(next)).p_total,8595);assert.equal(original[1].upsell,true);
 assert.equal(reconcileCartOffers(next,c),next);
});
test('zeroing the trigger and restoring an old broken cart also recover safely',async()=>{
 const c=catalog(),offer=cartOffer(c,[trigger]),cart=[trigger,selected(offer),{product_id:lub,mode:'package',quantity:1}];
 const next=reconcileCartOffers(setVariantQuantity(cart,trigger,'package',0),c);
 assert.equal((await server(c).save(next)).p_total,8595);
 const restored=reconcileCartOffers([selected(offer)],c);assert.equal((await server(c).save(restored)).p_total,5095);
});
test('pausing a rule or changing its trigger removes the special price without removing quantity',()=>{
 const c=catalog(),v=cartOffers(c,[trigger]).find(o=>o.flavor_id===vanilla),cart=[trigger,selected(v,'bundle',2),selected(v,'package',3)];
 c.upsell_rules[1].active=false;const next=reconcileCartOffers(cart,c);assert.ok(next.every(i=>!i.upsell));assert.equal(total(resolveCart(next,c)),67000);
});
test('removing the complement makes it eligible again; accepted offers cannot trigger each other',()=>{
 const c=catalog(),offers=cartOffers(c,[trigger]);assert.equal(cartOffers(c,[trigger]).length,3);
 assert.equal(cartOffers(c,offers.map(o=>selected(o))).length,0);
 const kept=[trigger,selected(offers[0])].filter(i=>!i.upsell);assert.ok(cartOffers(c,kept).some(o=>o.product_id===base));
});
test('server rejects forged rules, duplicate rows, stale prices and disabled bundles',async()=>{
 const c=catalog(),offers=cartOffers(c,[trigger]),v=offers.find(o=>o.flavor_id===vanilla),l=offers.find(o=>o.product_id===lub),api=server(c);
 await assert.rejects(api.save([trigger,{...selected(v),upsell_rule_id:id(300)}]),/sugestão mudou/);
 await assert.rejects(api.save([trigger,selected(v),selected(v)]),/repetido/);
 await assert.rejects(api.save([trigger,selected(l,'bundle')]),/apenas por pacote/);
 await assert.rejects(api.save([trigger,selected(v,'package',1000)]),/itens/);
 const items=resolveCart([trigger,selected(v,'bundle',2)],c).map(i=>({...i,unit_price:i.upsell?1:i.unit_price}));
 await assert.rejects(api.order(items),/preços foram atualizados/);
 assert.equal(matchesOffer(selected(l,'bundle'),l),false);
});
test('admin accepts different flavors in one line and rejects invalid trigger flavors',()=>{
 const c=catalog(),api=server(c),r=c.upsell_rules[1];assert.equal(api.rule(r).trigger_flavor_id,chocolate);
 assert.throws(()=>api.rule({...r,flavor_id:chocolate}),/sabor diferente/);
 assert.throws(()=>api.rule({...r,trigger_product_id:base}),/disponíveis/);
});

test('suggestion controls update quantities, total and the actual add callback',()=>{
 const React=require('react'),states=[];let cursor=0,added;
 const fakeReact={...React,useState:initial=>{const index=cursor++;if(!(index in states))states[index]=initial;return [states[index],value=>{states[index]=value;}];}};
 const DualQuantity=()=>null;
 const C=load('components/store/cart-suggestion.tsx',{'react':fakeReact,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),'@/lib/portal':portal,'./controls':{DualQuantity}}).default;
 const c=catalog(),p=c.products[1],props={title:'Complete seu pedido',product:p,price:5095,onAdd:value=>{added=value;}};
 const nodes=(node)=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];
 const render=()=>{cursor=0;return nodes(C(props));};
 let tree=render(),controls=tree.find(n=>n.type===DualQuantity);controls.props.onChange('bundle',2);controls.props.onChange('package',3);
 tree=render();let button=tree.find(n=>n.type==='button');assert.match(button.props['aria-label'],/13 pacotes/);assert.match(button.props['aria-label'],/662,35/);button.props.onClick();assert.equal(added.packages,3);assert.equal(added.bundles,2);
 controls=tree.find(n=>n.type===DualQuantity);controls.props.onChange('bundle',0);controls.props.onChange('package',0);assert.equal(render().find(n=>n.type==='button').props.disabled,true);
 props.product=c.products[2];props.price=3500;controls=render().find(n=>n.type===DualQuantity);assert.equal(controls.props.allowBundle,false);
});
