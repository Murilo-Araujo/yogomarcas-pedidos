const {test}=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const {webcrypto:crypto,randomUUID}=require('node:crypto');
const React=require('react'),{renderToStaticMarkup}=require('react-dom/server');
const compile=s=>ts.transpileModule(s,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,jsx:ts.JsxEmit.ReactJSX}}).outputText;

function fixture(){
 let handler;const user=randomUUID(),session=randomUUID(),line=randomUUID();
 const product={id:randomUUID(),line_id:line,has_flavors:true,active:true,available:true,deleted_at:null};
 const flavor={id:randomUUID(),product_id:product.id,sku:'EI-TEST',name:'Sabor de teste',package_price:1000,package_weight_grams:null,active:true,available:true,position:0,deleted_at:null,observation:''};
 const other={...flavor,id:randomUUID(),sku:'EI-OTHER',name:'Outro sabor',observation:'Outra orientação'};
 const rows={yp_products:[product],yp_flavors:[flavor,other],yp_lines:[{id:line,active:true}],yp_settings:[{id:1}],yp_upsell_rules:[],yp_catalog_highlights:[],yp_admins:[{user_id:user,username:'teste',role:'admin',active:true,must_change_password:false}]};
 const token='header.'+Buffer.from(JSON.stringify({session_id:session})).toString('base64url')+'.signature';
 const fakeFetch=async(url,init={})=>{
  const u=new URL(url),method=init.method||'GET';
  if(u.pathname==='/auth/v1/user')return Response.json({id:user});
  if(u.pathname==='/rest/v1/rpc/yp_admin_session_valid')return Response.json(true);
  const table=u.pathname.split('/').pop();assert.ok(table in rows,'Unexpected endpoint '+u.pathname);
  const matches=rows[table].filter(r=>[...u.searchParams].every(([key,value])=>value.startsWith('eq.')?String(r[key])===value.slice(3):value==='is.null'?r[key]===null:true));
  if(method==='PATCH')matches.forEach(r=>Object.assign(r,JSON.parse(init.body)));
  if(method==='POST'){const created={id:randomUUID(),observation:'',deleted_at:null,...JSON.parse(init.body)};rows[table].push(created);return Response.json([created]);}
  return Response.json(matches);
 };
 const source=fs.readFileSync('supabase/functions/order-portal/index.ts','utf8').replace(/^import .*;$/gm,'');
 vm.runInNewContext(compile(source),{Deno:{env:{get:k=>k==='SUPABASE_URL'?'https://isolated.invalid':'secret'},serve:f=>handler=f},crypto,TextEncoder,TextDecoder,Uint8Array,Request,Response,URL,atob,fetch:fakeFetch,BUNDLE_UNITS:5,bundlePrice:p=>p===null?null:p*5,orderMessage:()=>''});
 async function call(body,authenticated=true,expected=200){const response=await handler(new Request('https://isolated.invalid/order-portal',{method:'POST',headers:{'Content-Type':'application/json',...(authenticated?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)}));const data=await response.json();assert.equal(response.status,expected,JSON.stringify(data));return data;}
 return {flavor,other,call,handler};
}

test('flavor observation saves, trims, survives catalog reload and stays specific to its flavor',async()=>{
 const f=fixture();const text='Utilize 3 litros de água por pacote.\nMisture bem.';
 await f.call({action:'save_flavor',flavor:{...f.flavor,observation:'  '+text+'  '}});
 assert.equal(f.flavor.observation,text);assert.equal(f.other.observation,'Outra orientação');
 const response=await f.handler(new Request('https://isolated.invalid/order-portal?offers=2'));
 assert.equal(response.status,200);const catalog=await response.json();
 assert.equal(catalog.flavors.find(x=>x.id===f.flavor.id).observation,text);
 assert.equal((await f.call({action:'admin_data'})).flavors.find(x=>x.id===f.flavor.id).observation,text);
});

test('omitted observation preserves existing text; empty or null explicitly removes it',async()=>{
 const f=fixture();f.flavor.observation='Preparo especial';
 const oldScreen={...f.flavor};delete oldScreen.observation;
 await f.call({action:'save_flavor',flavor:oldScreen});assert.equal(f.flavor.observation,'Preparo especial');
 for(const value of ['   ',null]){f.flavor.observation='Preparo especial';await f.call({action:'save_flavor',flavor:{...f.flavor,observation:value}});assert.equal(f.flavor.observation,'');}
});

test('observation validates text length and still requires authenticated administration',async()=>{
 const f=fixture();for(const value of [42,{},[],true,'x'.repeat(1001),'bad'+String.fromCharCode(0)])await f.call({action:'save_flavor',flavor:{...f.flavor,observation:value}},true,400);
 await f.call({action:'save_flavor',flavor:{...f.flavor,observation:'x'.repeat(1000)}});assert.equal(f.flavor.observation.length,1000);
 await f.call({action:'save_flavor',flavor:{...f.flavor,observation:'Sem permissão'}},false,401);assert.equal(f.flavor.observation.length,1000);
});

test('customer note is absent when empty and escapes markup instead of executing HTML',()=>{
 const exports={};vm.runInNewContext(compile(fs.readFileSync('components/store/flavor-observation.tsx','utf8')),{exports,require:name=>name==='./flavor-observation.module.css'?{default:{note:'note'}}:require(name)});
 const html=text=>renderToStaticMarkup(React.createElement(exports.default,{text}));
 for(const text of [undefined,null,'','   '])assert.equal(html(text),'');
 const markup=html('3 litros de água\n<strong>Texto</strong>');assert.match(markup,/role="note"/);assert.match(markup,/3 litros de água/);assert.match(markup,/&lt;strong&gt;Texto&lt;\/strong&gt;/);assert.doesNotMatch(markup,/<strong>Texto<\/strong>/);
});
