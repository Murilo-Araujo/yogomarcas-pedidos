const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const moduleExports = {};
const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', 'lib/priced-catalog.ts'), 'utf8'), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS },
}).outputText;
vm.runInNewContext(code, { exports: moduleExports });
const { catalogPreparationLabel, PRICED_CATALOGS, toPricedCatalog } = moduleExports;
const product = litres => ({ id: 'product', preparation: { waterLitres: litres, title: 'Modo de preparo', steps: [] } });
const observation = text => ({ observation: text });

test('each line uses its live preparation, including the three-litre functional bases', () => {
  for (const [name, litres] of [['Expresso Italiano',4],['Iogurte Grego',4],['Frozen Yogurt',3],['Soft Proteico',3],['Soft Zero',3]]) {
    assert.equal(catalogPreparationLabel({ ...product(litres), name }), `1 pacote para ${litres} litros de água.`);
  }
  const p = product(4);
  p.preparation.waterLitres = 3;
  assert.equal(catalogPreparationLabel(p), '1 pacote para 3 litros de água.');
});

test('Dark Extreme and Panetone observations override the four-litre line recipe', () => {
  for (const name of ['Dark Extreme', 'Panetone']) {
    assert.equal(catalogPreparationLabel(product(4), observation(`Para o sabor ${name}, utilize 3 litros de água por pacote, em vez dos 4 litros do preparo padrão da linha.`)), '1 pacote para 3 litros de água.');
  }
  assert.equal(catalogPreparationLabel(product(4), observation('Em vez dos 4 litros de água, use 3 litros de água por pacote.')), '1 pacote para 3 litros de água.');
});

test('handles litre abbreviations, accents, decimal volumes and singular', () => {
  for (const text of ['3 L de água', '3l agua', 'UTILIZE 3 LITROS DE ÁGUA']) assert.equal(catalogPreparationLabel(product(4), observation(text)), '1 pacote para 3 litros de água.');
  assert.equal(catalogPreparationLabel(product(4), observation('Use 2,5 litros de água.')), '1 pacote para 2,5 litros de água.');
  assert.equal(catalogPreparationLabel(product(1)), '1 pacote para 1 litro de água.');
});

test('sweetness notes, yields, minutes and millilitres do not replace water dilution', () => {
  for (const text of ['Doçura levemente mais suave.', 'Rende 6 litros de calda; bata por 2 minutos.', '1 colher para cada 300 ml de calda.', 'Adicione 500 ml de água à limpeza.']) {
    assert.equal(catalogPreparationLabel(product(4), observation(text)), '1 pacote para 4 litros de água.');
  }
});

test('açaí and Yogo Drink use the requested non-water preparations', () => {
  assert.equal(catalogPreparationLabel({ id: '2c9d9e2d-4de7-4aea-a592-845793bcc4eb', preparation: null }), '1 pacote para 5 litros de polpa de açaí.');
  const drink = catalogPreparationLabel({ ...product(4), id: '923c7d61-7f32-4d67-952a-e2791dac82c5' });
  assert.equal(drink, '1 pacote para 4 litros de garapa ou outra bebida já doce da sua preferência.');
  assert.doesNotMatch(drink, /água/);
});

test('missing or invalid preparation never invents a dilution', () => {
  for (const preparation of [undefined, null, {}, {waterLitres:0}, {waterLitres:-1}, {waterLitres:NaN}, {waterLitres:Infinity}, {waterLitres:'4'}]) {
    assert.equal(catalogPreparationLabel({ id: 'unknown', preparation }), null);
  }
});

test('the priced payload adds only a short preparation string without changing prices or source data', () => {
  const source = {
    lines: [{ id: PRICED_CATALOGS.expressoitaliano.lineId, active:true }],
    products: [{ ...product(4), name:'Expresso Italiano', active:true, available:true, has_flavors:true, position:0, line_id:PRICED_CATALOGS.expressoitaliano.lineId }],
    flavors: [{ id:'dark', product_id:'product', name:'DARK EXTREME', active:true, available:true, position:0, package_price:6260, observation:'Utilize 3 litros de água por pacote. PRIVATE NOTE' }],
  };
  const original = JSON.stringify(source);
  const result = toPricedCatalog(source,'expressoitaliano');
  assert.equal(result.groups[0].items[0].preparationLabel,'1 pacote para 3 litros de água.');
  assert.equal(result.groups[0].items[0].price,6260);
  assert.doesNotMatch(JSON.stringify(result), /PRIVATE NOTE|waterLitres|steps|observation/);
  assert.equal(JSON.stringify(source),original);
});
