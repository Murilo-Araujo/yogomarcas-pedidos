const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs'),vm=require('node:vm'),ts=require('typescript');
const moduleData={exports:{}};
vm.runInNewContext(ts.transpileModule(fs.readFileSync('lib/catalog-management.ts','utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS}}).outputText,{exports:moduleData.exports});
const {parsePercentage,adjustedPrice,preparationInput,informationInput,highlightIsActive}=moduleData.exports;
test('Brazilian percentages and five-cent rounding preserve exact multiples',()=>{
 assert.equal(parsePercentage('3,5'),350);assert.equal(parsePercentage('0.01'),1);assert.equal(parsePercentage('100'),10000);
 for(const value of ['','0','-1','NaN','1e2','100.01','3,555'])assert.equal(parsePercentage(value),null);
 assert.equal(adjustedPrice(6260,350),6480);assert.equal(adjustedPrice(10000,350),10350);
 assert.equal(adjustedPrice(5850,450),6115);assert.equal(adjustedPrice(1,1),5);
 assert.throws(()=>adjustedPrice(1000,0));
});
test('preparation accepts optional facts, normalizes blank lines and rejects corrupt fields',()=>{
 const value=preparationInput({title:' Preparo ',waterLitres:3.5,steps:['Misture.','','  Bata.  '],note:' Frio. '});
 assert.equal(value.title,'Preparo');assert.equal(value.steps.join('|'),'Misture.|Bata.');assert.equal(value.minutes,undefined);
 assert.equal(preparationInput(null),null);
 for(const v of [{title:'x',steps:[]},{title:'x',steps:['x'],minutes:0},{title:'x',steps:['x'],waterLitres:'4'},{title:'x',steps:Array(21).fill('x')}])assert.throws(()=>preparationInput(v));
 assert.equal(informationInput([{title:' Proteína ',text:'10 g por 100 g de sorvete pronto.'}])[0].title,'Proteína');
 assert.throws(()=>informationInput([{title:'',text:'x'}]));assert.throws(()=>informationInput(Array(13).fill({title:'a',text:'b'})));
});
test('highlight start inclusive and expiry exclusive, including disabled entries',()=>{
 const start=Date.parse('2026-10-01T12:00:00Z'),end=Date.parse('2026-12-01T12:00:00Z');
 const highlight={active:true,starts_at:new Date(start).toISOString(),expires_at:new Date(end).toISOString()};
 assert.equal(highlightIsActive(highlight,start-1),false);assert.equal(highlightIsActive(highlight,start),true);
 assert.equal(highlightIsActive(highlight,end-1),true);assert.equal(highlightIsActive(highlight,end),false);
 assert.equal(highlightIsActive({...highlight,active:false},start),false);
});
