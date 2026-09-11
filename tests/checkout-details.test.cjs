const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/checkout-details.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const profile={id:'shop-a',contact_name:'Contato cadastrado',checkout_details:{order_id:'order-1',name:'Maria Silva',city:'Cascavel',state:'PR'}};
function storage(){const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function load(localStorage){const exports={};vm.runInNewContext(code,{exports,localStorage,require:()=>({STATES:states})});return exports;}
const plain=value=>JSON.parse(JSON.stringify(value));

test('last-order defaults fill all three fields, while new shops use their registered contact',()=>{
 const api=load(storage());
 assert.deepEqual(plain(api.readCheckoutDetails(profile)),{name:'Maria Silva',city:'Cascavel',state:'PR'});
 assert.deepEqual(plain(api.readCheckoutDetails({id:'new',contact_name:'João'})),{name:'João',city:'',state:'PR'});
});

test('editable details survive a page reload without persisting notes, codes or another identity',()=>{
 const s=storage(),api=load(s),edited={name:'Ana Souza',city:'Joinville',state:'SC',notes:'Only this order',code:'Private code',company:'Other shop'};
 api.rememberCheckoutDetails(profile,edited);
 const afterReload=load(s).readCheckoutDetails(profile);
 assert.deepEqual(plain(afterReload),{name:'Ana Souza',city:'Joinville',state:'SC'});
 const raw=[...s.values.values()].join('');assert.ok(!raw.includes('Only this order'));assert.ok(!raw.includes('Private code'));assert.ok(!raw.includes('Other shop'));
 api.rememberCheckoutDetails(profile,{name:'',city:'',state:'SC'});
 assert.equal(load(s).readCheckoutDetails(profile).name,'');
});

test('a newer prepared order supersedes stale edits from an older visit',()=>{
 const s=storage(),api=load(s);api.rememberCheckoutDetails(profile,{name:'Local',city:'Toledo',state:'PR'});
 const newer={...profile,checkout_details:{order_id:'order-2',name:'Novo contato',city:'Cuiabá',state:'MT'}};
 assert.deepEqual(plain(load(s).readCheckoutDetails(newer)),{name:'Novo contato',city:'Cuiabá',state:'MT'});
});

test('switching shops never restores another shop’s contact or city',()=>{
 const s=storage(),api=load(s);api.rememberCheckoutDetails(profile,{name:'Local A',city:'Toledo',state:'PR'});
 const other={id:'shop-b',contact_name:'Contato B'};
 assert.deepEqual(plain(api.readCheckoutDetails(other)),{name:'Contato B',city:'',state:'PR'});
 s.setItem('yp-checkout-details-v1:shop-b',s.getItem('yp-checkout-details-v1:shop-a'));
 assert.equal(load(s).readCheckoutDetails(other).city,'');
 api.clearCheckoutDetails(profile.id);assert.equal(s.getItem('yp-checkout-details-v1:shop-a'),null);
});

test('corrupt stored data is ignored; blocked browser storage keeps the current session usable',()=>{
 const s=storage();s.setItem('yp-checkout-details-v1:shop-a','not json');assert.equal(load(s).readCheckoutDetails(profile).city,'Cascavel');
 s.setItem('yp-checkout-details-v1:shop-a',JSON.stringify({customer_id:profile.id,order_id:'order-1',details:{name:'Invalid',city:'Elsewhere',state:'XX'}}));
 assert.equal(load(s).readCheckoutDetails(profile).state,'PR');
 const blocked={getItem(){throw Error('blocked');},setItem(){throw Error('blocked');},removeItem(){throw Error('blocked');}};
 const api=load(blocked);api.rememberCheckoutDetails(profile,{name:'Ainda editável',city:'Florianópolis',state:'SC'});
 assert.equal(api.readCheckoutDetails(profile).city,'Florianópolis');api.clearCheckoutDetails(profile.id);assert.equal(api.readCheckoutDetails(profile).city,'Cascavel');
});
