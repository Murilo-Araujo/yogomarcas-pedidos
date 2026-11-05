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
const { PRICED_CATALOGS, toPricedCatalog } = moduleExports;
const plain = value => JSON.parse(JSON.stringify(value));
const flavor = (name, position) => ({ id: name, product_id: 'product', name, position, active: true, available: true, package_price: 5000 + position });
function fixture(key, flavors) {
  return {
    lines: [{ id: PRICED_CATALOGS[key].lineId, active: true }],
    products: [{ id: 'product', name: 'Linha', line_id: PRICED_CATALOGS[key].lineId, active: true, available: true, has_flavors: true, position: 0 }],
    flavors,
  };
}
const names = (source, key) => plain(toPricedCatalog(source, key).groups[0].items.map(item => item.name));

test('all three priced catalogs put neutral first, then naturals, then alphabetic flavors', () => {
  for (const key of Object.keys(PRICED_CATALOGS)) {
    const source = fixture(key, [
      flavor('UVA VERDE', 0), flavor('MORANGO', 1), flavor('LICHIA', 99),
      flavor('NATURAL AZEDINHO', 31), flavor('NATURAL TRADICIONAL', 30),
      flavor('NEUTRO (BASE S/ SABOR)', 90), flavor('ABACAXI', 10),
    ]);
    assert.deepEqual(names(source, key), [
      'NEUTRO (BASE S/ SABOR)', 'NATURAL TRADICIONAL', 'NATURAL AZEDINHO',
      'ABACAXI', 'LICHIA', 'MORANGO', 'UVA VERDE',
    ]);
  }
});

test('neutral names accept case, spaces and written or abbreviated unflavored base names', () => {
  for (const name of [' neutro (base s/ sabor) ', 'BASE NEUTRA', 'SEM SABOR', 'BASE S/ SABOR']) {
    const source = fixture('expressoitaliano', [flavor('ABACAXI', 0), flavor('NATURAL', 1), flavor(name, 99)]);
    assert.deepEqual(names(source, 'expressoitaliano'), [name, 'NATURAL', 'ABACAXI']);
  }
});

test('Portuguese accents and mixed case sort alphabetically, ignoring configured flavor positions', () => {
  const source = fixture('frozen', [
    flavor('UVA', 0), flavor('PÊRA', 1), flavor('MELÃO', 2), flavor('maçã verde', 3),
    flavor('lichia', 4), flavor('AÇAÍ', 5), flavor('ABACAXI', 6), flavor('4 LEITES', 7),
  ]);
  assert.deepEqual(names(source, 'frozen'), ['4 LEITES', 'ABACAXI', 'AÇAÍ', 'lichia', 'maçã verde', 'MELÃO', 'PÊRA', 'UVA']);
});

test('natural is a leading word, not a substring of another flavor name', () => {
  const source = fixture('grego', [flavor('Baunilha natural', 0), flavor('Naturalmente morango', 1), flavor('Abacaxi', 2), flavor(' Natural suave ', 3)]);
  assert.deepEqual(names(source, 'grego'), [' Natural suave ', 'Abacaxi', 'Baunilha natural', 'Naturalmente morango']);
});

test('ordering does not mutate input or change prices, availability or product group order', () => {
  const source = fixture('expressoitaliano', [flavor('UVA', 0), flavor('NATURAL', 1), flavor('ABACAXI', 2)]);
  source.flavors[0].available = false;
  source.flavors.push({ ...flavor('NEUTRO', 3), active: false });
  source.products.unshift({ ...source.products[0], id: 'drink', name: 'Yogo Drink', position: 10, has_flavors: false, package_price: 2500 });
  const before = JSON.stringify(source);
  const result = toPricedCatalog(source, 'expressoitaliano');
  assert.equal(JSON.stringify(source), before);
  assert.deepEqual(plain(result.groups.map(group => group.id)), ['product', 'drink']);
  assert.deepEqual(plain(result.groups[0].items.map(item => [item.name, item.price, item.available])), [
    ['NATURAL', 5001, true], ['ABACAXI', 5002, true], ['UVA', 5000, false],
  ]);
});
