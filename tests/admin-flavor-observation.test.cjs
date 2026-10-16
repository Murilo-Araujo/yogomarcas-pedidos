const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const React=require('react');
const nodes=node=>Array.isArray(node)?node.flatMap(nodes):node&&typeof node==='object'?[node,...nodes(node.props?.children)]:[];
function fixture(){
 let cursor=0;const state=[],calls=[];
 const hooks={...React,useRef:()=>({current:null}),useEffect:()=>{},useState:initial=>{const index=cursor++;if(!(index in state))state[index]=initial;return [state[index],next=>{state[index]=typeof next==='function'?next(state[index]):next;}];}};
 const passthrough=({children})=>children;
 const deps={react:hooks,'react/jsx-runtime':require('react/jsx-runtime'),'lucide-react':require('lucide-react'),sonner:{toast:{success:()=>{},error:()=>{}}},'@/components/ui/dialog':Object.fromEntries(['Dialog','DialogContent','DialogDescription','DialogHeader','DialogTitle'].map(k=>[k,passthrough])),'@/components/ui/switch':{Switch:()=>null},'./catalog-delete-dialog':{default:()=>null},'./admin-flavor-observation.module.css':{default:{trigger:'observation-trigger'}},'@/lib/portal':{normalizeSearch:s=>s.toLowerCase(),money:n=>String(n),moneyInput:n=>n===null?'':(n/100).toFixed(2),cents:s=>s===''?null:Math.round(Number(s)*100),api:async(...args)=>{calls.push(args);}}};
 const exports={};const code=ts.transpileModule(fs.readFileSync('components/store/admin-flavors.tsx','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;
 vm.runInNewContext(code,{exports,require:name=>deps[name]||{}});
 const product={id:'italiano',name:'Expresso Italiano',preparation:{waterLitres:4},bundle_enabled:true};
 const dark={id:'dark',product_id:product.id,name:'DARK EXTREME',sku:'583',package_price:1000,package_weight_grams:1000,active:true,available:true,position:0,observation:'Use 3 litros de água por pacote.'};
 const vanilla={...dark,id:'vanilla',name:'BAUNILHA',sku:'584',observation:''};
 const unrelated={...dark,id:'other',product_id:'another-line',name:'OUTRA LINHA'};
 const render=()=>{cursor=0;return nodes(exports.default({product,flavors:[dark,vanilla,unrelated],onClose:()=>{},onSaved:async()=>{}}));};
 return {render,calls,product,dark,vanilla};
}
test('each flavor has its own observation action and the editor identifies the selected flavor',()=>{
 const f=fixture(),initial=f.render();
 const actions=initial.filter(n=>n.type==='button'&&n.props.className==='observation-trigger');
 assert.equal(actions.length,2);
 const action=actions.find(n=>n.props['aria-label']==='Observação de DARK EXTREME');assert.ok(action);
 action.props.onClick();const edited=f.render();
 assert.ok(edited.some(n=>n.props?.children==='Editar sabor: DARK EXTREME'));
 assert.equal(edited.find(n=>n.type==='textarea').props.value,f.dark.observation);
 assert.equal(f.product.preparation.waterLitres,4);assert.equal(f.vanilla.observation,'');
});
test('saving an observation sends only the selected flavor record, never save_product or save_line',async()=>{
 const f=fixture();f.render().find(n=>n.props['aria-label']==='Observação de DARK EXTREME').props.onClick();
 f.render().find(n=>n.type==='textarea').props.onChange({target:{value:'Dark Extreme: 3 litros por pacote.'}});
 await f.render().find(n=>n.type==='form').props.onSubmit({preventDefault(){}});
 assert.equal(f.calls.length,1);const [action,payload,auth]=f.calls[0];
 assert.equal(action,'save_flavor');assert.equal(auth,true);assert.equal(payload.flavor.id,'dark');
 assert.equal(payload.flavor.observation,'Dark Extreme: 3 litros por pacote.');
 assert.equal(f.product.preparation.waterLitres,4);assert.equal(f.vanilla.observation,'');
});
