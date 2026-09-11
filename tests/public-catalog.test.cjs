const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const {renderToStaticMarkup} = require('react-dom/server');

function load(file) {
  const module = {exports: {}};
  const code = ts.transpileModule(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true},
  }).outputText;
  vm.runInNewContext(code, {exports: module.exports, require: name => name.endsWith('.module.css') ? {} : require(name)});
  return module.exports;
}
const {toPublicCatalog} = load('lib/public-catalog.ts');
const PublicCatalogView = load('components/store/public-catalog.tsx').default;
const fixture = () => ({
  lines: [{id: 'line', name: 'Expresso Italiano', description: '', position: 0, active: true}],
  products: [{id: 'product', line_id: 'line', name: 'Expresso Italiano', description: 'Mix em pó.', image_url: '', package_label: 'Pacote', has_flavors: true, active: true, available: true, position: 0, package_price: 6260, bundle_price: 31300, sku: 'INTERNAL'}],
  flavors: [{id: 'flavor', product_id: 'product', name: 'CHOCOLATE', package_weight_grams: 1800, active: true, available: true, position: 0, package_price: 6260, bundle_price: 31300, sku: 'FLAVOR-INTERNAL'}],
  settings: {minimum_order: 100000, upsell_price: 1000, ordering_enabled: true, whatsapp: 'CONTACT'},
  upsell_rules: [{special_price: 1000}],
});

test('public payload excludes financial values, internal codes and order settings', () => {
  const source = fixture();
  source.products[0].future_private_field = 'PRIVATE';
  source.flavors[0].future_price_field = 9999;
  const result = JSON.parse(JSON.stringify(toPublicCatalog(source)));
  const output = JSON.stringify(result);
  assert.doesNotMatch(output, /price|minimum|upsell|sku|settings|INTERNAL|PRIVATE|CONTACT|6260|31300/);
  assert.equal(result.products.length, 1);
  assert.equal(result.flavors[0].name, 'CHOCOLATE');
  assert.equal(result.flavors[0].package_weight_grams, 1800);
});

test('hidden lines, products and flavors never appear through their children', () => {
  const source = fixture();
  source.lines.push({id: 'hidden-line', name: 'Hidden', position: 1, active: false});
  source.products.push({...source.products[0], id: 'hidden-child', line_id: 'hidden-line'});
  source.products.push({...source.products[0], id: 'hidden-product', active: false});
  source.flavors.push({...source.flavors[0], id: 'hidden-flavor', active: false});
  source.flavors.push({...source.flavors[0], id: 'orphan', product_id: 'hidden-product'});
  const before = JSON.stringify(source);
  const result = toPublicCatalog(source);
  assert.equal(result.lines.length, 1);
  assert.equal(result.products.length, 1);
  assert.equal(result.flavors.length, 1);
  assert.equal(JSON.stringify(source), before);
});

test('unavailable active flavors stay in the portfolio with their availability', () => {
  const source = fixture();
  source.flavors[0].available = false;
  const result = toPublicCatalog(source);
  assert.equal(result.flavors.length, 1);
  assert.equal(result.flavors[0].available, false);
  const html = renderToStaticMarkup(React.createElement(PublicCatalogView, {catalog: result}));
  assert.match(html, /Temporariamente indisponível/);
});

test('anonymous initial render includes flavors without prices or ordering/account links', () => {
  const html = renderToStaticMarkup(React.createElement(PublicCatalogView, {catalog: toPublicCatalog(fixture())}));
  assert.match(html, /CHOCOLATE/);
  assert.match(html, /Buscar linha ou sabor/);
  assert.doesNotMatch(html, /R\$|package_price|bundle_price|carrinho|cadastro|password|whatsapp|href="\/"|href="\/admin"/i);
});

test('empty and failed catalog renders are readable and do not send visitors to orders', () => {
  const failed = renderToStaticMarkup(React.createElement(PublicCatalogView, {catalog: null}));
  const empty = renderToStaticMarkup(React.createElement(PublicCatalogView, {catalog: {lines: [], products: [], flavors: []}}));
  assert.match(failed, /Não foi possível carregar o catálogo/);
  assert.match(failed, /href="\/catalogo"/);
  assert.match(empty, /Catálogo em atualização/);
  assert.doesNotMatch(failed + empty, /href="\/"|password|carrinho/i);
});
