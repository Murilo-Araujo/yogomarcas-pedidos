const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),vm=require('node:vm'),ts=require('typescript');
const source=fs.readFileSync(path.join(__dirname,'../lib/checkout-details.ts'),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText;
const addressModule={exports:{}};vm.runInNewContext(ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/delivery-address.ts'),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:addressModule.exports});
const emptyAddress=JSON.parse(JSON.stringify(addressModule.exports.EMPTY_DELIVERY_ADDRESS));
const states=['AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB','PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'];
const profile={id:'shop-a',contact_name:'Contato cadastrado',checkout_details:{order_id:'order-1',name:'Maria Silva',city:'Cascavel',state:'PR'}};
function storage(){const values=new Map();return {values,getItem:key=>values.get(key)||null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};}
function load(localStorage){const exports={};vm.runInNewContext(code,{exports,localStorage,require:name=>name==='./delivery-address'?addressModule.exports:({STATES:states})});return exports;}
const plain=value=>JSON.parse(JSON.stringify(value));

test('legacy order defaults remain usable and new shops have empty delivery fields',()=>{
 const api=load(storage());
 assert.deepEqual(plain(api.readCheckoutDetails(profile)),{...emptyAddress,name:'Maria Silva',city:'Cascavel',state:'PR'});
 assert.deepEqual(plain(api.readCheckoutDetails({id:'new',contact_name:'João'})),{...emptyAddress,name:'João',city:'',state:'PR'});
});

test('editable details survive a page reload without persisting notes, codes or another identity',()=>{
 const s=storage(),api=load(s),edited={name:'Ana Souza',city:'Joinville',state:'SC',notes:'Only this order',code:'Private code',company:'Other shop'};
 api.rememberCheckoutDetails(profile,edited);
 const afterReload=load(s).readCheckoutDetails(profile);
 assert.deepEqual(plain(afterReload),{...emptyAddress,name:'Ana Souza',city:'Joinville',state:'SC'});
 const raw=[...s.values.values()].join('');assert.ok(!raw.includes('Only this order'));assert.ok(!raw.includes('Private code'));assert.ok(!raw.includes('Other shop'));
 api.rememberCheckoutDetails(profile,{name:'',city:'',state:'SC'});
 assert.equal(load(s).readCheckoutDetails(profile).name,'');
});

test('a newer prepared order supersedes stale edits from an older visit',()=>{
 const s=storage(),api=load(s);api.rememberCheckoutDetails(profile,{name:'Local',city:'Toledo',state:'PR'});
 const newer={...profile,checkout_details:{order_id:'order-2',name:'Novo contato',city:'Cuiabá',state:'MT'}};
 assert.deepEqual(plain(load(s).readCheckoutDetails(newer)),{...emptyAddress,name:'Novo contato',city:'Cuiabá',state:'MT'});
});

test('switching shops never restores another shop’s contact or city',()=>{
 const s=storage(),api=load(s);api.rememberCheckoutDetails(profile,{name:'Local A',city:'Toledo',state:'PR'});
 const other={id:'shop-b',contact_name:'Contato B'};
 assert.deepEqual(plain(api.readCheckoutDetails(other)),{...emptyAddress,name:'Contato B',city:'',state:'PR'});
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

test('the full editable delivery address survives reload and a newer order supersedes its draft',()=>{
 const s=storage(),api=load(s),address={postal_code:'85900-000',street:'Rua das Flores',number:'7',neighborhood:'Centro',complement:'Sala 2',reference:'Ao lado da praça'};
 const saved={...profile,checkout_details:{...profile.checkout_details,...address}};
 assert.deepEqual(plain(api.readCheckoutDetails(saved)),{name:'Maria Silva',city:'Cascavel',state:'PR',...address});
 const edited={...api.readCheckoutDetails(saved),street:'Avenida Brasil',number:'S/N',complement:''};
 api.rememberCheckoutDetails(saved,edited);
 assert.deepEqual(plain(load(s).readCheckoutDetails(saved)),edited);
 const newer={...saved,checkout_details:{...saved.checkout_details,order_id:'order-2',street:'Rua Nova'}};
 assert.equal(load(s).readCheckoutDetails(newer).street,'Rua Nova');
 const other=load(s).readCheckoutDetails({id:'other',contact_name:'Outra loja'});
 for(const key of Object.keys(address))assert.equal(other[key],'');
});
