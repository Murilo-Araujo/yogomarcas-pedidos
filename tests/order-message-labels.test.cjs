const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const ts=require('typescript');
const exportsObject={};
vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/retention.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:exportsObject});
const {orderMessage}=exportsObject;
const item=(overrides={})=>({product_id:'expresso',flavor_id:'baunilha',flavor_name:'BAUNILHA',product_name:'Expresso Italiano',name:'Expresso Italiano · BAUNILHA',sku:'YOGO-EI',internal_code:'139',mode:'package',quantity:1,bundle_units:1,units:1,line_total:5840,...overrides});
const order=items=>({public_number:'YG-EXEMPLO',company:'Loja de teste',customer_name:'Teste',phone:'00000000000',city:'Teste',state:'PR',total:items.reduce((sum,i)=>sum+i.line_total,0),items});
const message=items=>orderMessage(order(items));

test('code, product and flavor all appear once on the same message line',()=>{
 const text=message([item()]);
 assert.match(text,/139 \| Expresso Italiano · BAUNILHA \| 1 pacote \| R\$\s58,40/);
 assert.equal((text.match(/BAUNILHA/g)||[]).length,1);
 assert.doesNotMatch(text,/YOGO-EI|undefined|null|—/);
});
test('products without a flavor keep their own code and name',()=>{
 const text=message([item({product_id:'drink',flavor_id:null,flavor_name:null,product_name:'Yogo Drink',name:'Yogo Drink',internal_code:'980',sku:'980',line_total:2500})]);
 assert.match(text,/980 \| Yogo Drink \| 1 pacote \| R\$\s25,00/);
});
test('legacy snapshots with combined names do not repeat flavors',()=>{
 const text=message([item({product_name:undefined,name:'Expresso Italiano · Baunilha',flavor_name:'BAUNILHA',internal_code:undefined})]);
 assert.match(text,/YOGO-EI \| Expresso Italiano · Baunilha \| 1 pacote/);
 assert.equal((text.toLowerCase().match(/baunilha/g)||[]).length,1);
});
test('legacy snapshots with separate names append the flavor',()=>{
 assert.match(message([item({product_name:undefined,name:'Expresso Italiano'})]),/139 \| Expresso Italiano · BAUNILHA \|/);
});
test('missing codes or names never remove the available identification',()=>{
 assert.match(message([item({internal_code:'',sku:' '})]),/Expresso Italiano · BAUNILHA \| 1 pacote/);
 assert.match(message([item({name:undefined,product_name:undefined,flavor_name:undefined})]),/139 \| 1 pacote/);
});
test('packages and bundles of one flavor stay consolidated with unchanged totals',()=>{
 const a=item({quantity:3,units:3,line_total:17520});
 const b=item({mode:'bundle',quantity:2,bundle_units:5,units:10,line_total:58400});
 const source=order([a,b]),before=JSON.stringify(source),text=orderMessage(source);
 assert.match(text,/139 \| Expresso Italiano · BAUNILHA \| 13 pacotes \| R\$\s759,20/);
 assert.match(text,/Subtotal dos produtos: R\$\s759,20/);
 assert.equal((text.match(/139 \|/g)||[]).length,1);
 assert.equal(JSON.stringify(source),before);
});
test('the same flavor name in different lines remains distinguishable',()=>{
 const text=message([item(),item({product_id:'zero',flavor_id:'zero-baunilha',product_name:'Soft Zero',name:'Soft Zero · Baunilha',flavor_name:'Baunilha',internal_code:'ZERO-B'}),item({product_id:'proteico',flavor_id:'proteico-baunilha',product_name:'Soft Proteico',name:'Soft Proteico · Baunilha',flavor_name:'Baunilha',internal_code:'PROT-B'})]);
 for(const name of ['Expresso Italiano','Soft Zero','Soft Proteico'])assert.ok(text.includes(name));
 for(const code of ['139','ZERO-B','PROT-B'])assert.ok(text.includes(code+' |'));
});
