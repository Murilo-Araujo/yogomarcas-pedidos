const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const root=path.resolve(__dirname,'..');
function load(file,deps={}){
 const source=fs.readFileSync(path.join(root,file),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 const exports={};vm.runInNewContext(code,{exports,require:name=>deps[name]||{}});return exports;
}
const retention=load('lib/retention.ts');
const portal=load('lib/portal.ts',{'./retention':retention});
const shared={'react':React,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),'@/lib/portal':portal};
const controls=load('components/store/controls.tsx',shared);
const suggestion=load('components/store/cart-suggestion.tsx',{...shared,'./controls':controls});
const CartRow=load('components/store/cart-row.tsx',{...shared,'./controls':controls,'./cart-suggestion':suggestion}).default;
const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];
const primitive=()=>null;
const sheets={Sheet:primitive,SheetContent:primitive,SheetHeader:primitive,SheetTitle:primitive,SheetDescription:primitive};
const drawerModule=load('components/store/order-drawer.tsx',{...shared,'react':{...React,useEffect:()=>{},useRef:()=>({current:null})},'@/components/ui/sheet':sheets});
const OrderDrawer=drawerModule.default;
const defaults={open:true,onOpenChange:()=>{},checkout:false,itemCount:2,packageCount:188,subtotal:942785,minimumOrder:0,disabled:false,sending:false,onContinue:()=>{},onBack:()=>{}};
const product={id:'base',name:'Saborize · Base neutra',sku:'BASE',active:true,available:true,has_flavors:false,package_price:5095,package_weight_grams:1650,bundle_enabled:true,image_url:'',package_label:'Pacote'};
const catalog={products:[product],flavors:[],settings:{upsell_enabled:false,contextual_upsell_enabled:false},upsell_rules:[]};
const htmlFor=group=>renderToStaticMarkup(React.createElement(CartRow,{group,onChange:()=>{},onRemove:()=>{}})).replace(/\u00a0/g,' ');

test('large mixed quantities show each presentation price and preserve the cart total',()=>{
 const group=portal.groupCart(portal.resolveCart([{product_id:'base',mode:'bundle',quantity:34},{product_id:'base',mode:'package',quantity:13}],catalog))[0];
 const html=htmlFor(group);
 assert.match(html,/183 pacotes no total/);assert.match(html,/34 fardos \+ 13 pacotes avulsos/);
 assert.match(html,/R\$ 254,75/);assert.match(html,/R\$ 50,95/);assert.match(html,/R\$ 9\.323,85/);
 assert.match(html,/aria-label="Fardos de Saborize · Base neutra"[^>]*value="34"/);
 assert.match(html,/aria-label="Pacotes de Saborize · Base neutra"[^>]*value="13"/);
 assert.match(html,/1\.650 g por pacote/);
});

test('offer rows display the effective price; package-only products have no bundle control',()=>{
 const resolved=portal.resolveCart([{product_id:'base',mode:'bundle',quantity:2}],catalog)[0];
 const offer={...resolved,upsell:true,unit_price:17500};
 const html=htmlFor(portal.groupCart([offer])[0]);
 assert.match(html,/Sugestão adicionada/);assert.match(html,/R\$ 175,00/);assert.match(html,/R\$ 35,00/);assert.match(html,/R\$ 350,00/);
 const c={...catalog,products:[{...product,bundle_enabled:false}]};
 const single=htmlFor(portal.groupCart(portal.resolveCart([{product_id:'base',mode:'package',quantity:1}],c))[0]);
 assert.doesNotMatch(single,/aria-label="Fardos de/);assert.match(single,/1 pacote no total/);
});

test('the persistent action changes from review navigation to an associated form submit',()=>{
 let continued=0;const review=nodes(OrderDrawer({...defaults,onContinue:()=>continued++}));
 const next=review.find(n=>n.type==='button'&&n.props.className?.includes('order-main-action'));
 assert.equal(next.props.type,'button');next.props.onClick();assert.equal(continued,1);
 const checkout=nodes(OrderDrawer({...defaults,checkout:true}));
 const submit=checkout.find(n=>n.type==='button'&&n.props.className?.includes('order-main-action'));
 assert.equal(submit.props.type,'submit');assert.equal(submit.props.form,drawerModule.ORDER_CHECKOUT_FORM_ID);
 // Verify the actual checkout form is the target, preserving native validation.
 const source=fs.readFileSync(path.join(root,'components/store/storefront.tsx'),'utf8');
 assert.match(source,/<form id=\{ORDER_CHECKOUT_FORM_ID\} onSubmit=\{send\}/);
 assert.equal(checkout.filter(n=>n.type==='footer').length,1);
});

test('minimum order, unavailable items and in-flight sending block the persistent action',()=>{
 for(const checkout of [false,true])for(const gate of [{minimumOrder:1000000},{disabled:true}]){
  const action=nodes(OrderDrawer({...defaults,checkout,...gate})).find(n=>n.type==='button'&&n.props.className?.includes('order-main-action'));
  assert.equal(action.props.disabled,true);
 }
 let closed=0;
 const busy=OrderDrawer({...defaults,checkout:true,sending:true,onOpenChange:()=>closed++});
 busy.props.onOpenChange(false);assert.equal(closed,0);
 const action=nodes(busy).find(n=>n.type==='button'&&n.props.className?.includes('order-main-action'));assert.equal(action.props.disabled,true);
 const empty=nodes(OrderDrawer({...defaults,itemCount:0,packageCount:0,subtotal:0}));assert.equal(empty.filter(n=>n.type==='footer').length,0);
});
