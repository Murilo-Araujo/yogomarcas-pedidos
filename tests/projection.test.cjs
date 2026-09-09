// Compile the pure calculation with the installed TypeScript version.
const {test}=require('node:test');const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),ts=require('typescript');
const folder=fs.mkdtempSync(path.join(os.tmpdir(),'yogo-projection-'));
const compiled=ts.transpileModule(fs.readFileSync(path.join(__dirname,'../lib/projection.ts'),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
fs.writeFileSync(path.join(folder,'projection.cjs'),compiled);const {calculateProjection:calc}=require(path.join(folder,'projection.cjs'));fs.rmSync(folder,{recursive:true,force:true});
const portion={id:'small_cone',name:'Casquinha pequena',grams:100,price:500};
const base={quantity:1,units:1,unit_price:5000,yield_min_grams:5500,yield_grams:6000};
test('one packet produces the user-specified range and cents-based margin',()=>{const p=calc([base],portion);assert.deepEqual([p.servings_min,p.servings_max,p.revenue_min,p.revenue_max,p.surplus_min,p.surplus_max],[55,60,27500,30000,22500,25000]);assert.ok(Math.abs(p.margin_min-81.818181818)<.00001);assert.ok(Math.abs(p.margin_max-83.333333333)<.00001);});
test('aggregate grams before flooring portions',()=>{const p=calc([{...base,quantity:2,units:2}],{...portion,grams:150});assert.deepEqual([p.servings_min,p.servings_max],[73,80]);});
test('two six-packet bundles do not double multiply quantity',()=>{const p=calc([{...base,quantity:2,units:12,unit_price:25000}],portion);assert.deepEqual([p.packets,p.grams_max,p.servings_min,p.servings_max,p.base_cost],[12,72000,660,720,50000]);});
test('support item cost excluded without changing production',()=>{const support={...base,unit_price:3000,yield_grams:null,yield_min_grams:null};const p=calc([base,support],portion);assert.equal(p.base_cost,5000);assert.equal(p.excluded_cost,3000);assert.equal(p.surplus_min,22500);assert.equal(calc([support],portion),null);});
test('discount price used, not undiscounted catalog price',()=>assert.equal(calc([{...base,unit_price:4000}],portion).base_cost,4000));
test('negative result is not hidden',()=>{const p=calc([{...base,unit_price:40000}],portion);assert.equal(p.surplus_min,-12500);assert.ok(p.margin_max<0);});
test('zero complete portions has undefined percentage',()=>{const p=calc([base],{...portion,grams:10000});assert.equal(p.revenue_max,0);assert.equal(p.margin_max,null);assert.equal(p.surplus_min,-5000);});
test('format scenarios use same inventory independently',()=>{const a=calc([base],portion),b=calc([base],{...portion,grams:200,price:900});assert.equal(a.grams_max,b.grams_max);assert.equal(b.servings_max,30);});
test('invalid inputs and unsafe arithmetic do not show misleading numbers',()=>{for(const grams of [0,-10,NaN,Infinity,1.5])assert.equal(calc([base],{...portion,grams}),null);assert.equal(calc([base],{...portion,price:0}),null);assert.equal(calc([{...base,units:Number.MAX_SAFE_INTEGER}],portion),null);assert.equal(calc([{...base,unit_price:NaN}],portion),null);});
