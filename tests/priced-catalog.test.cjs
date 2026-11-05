const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');
const React = require('react');
const { renderToStaticMarkup } = require('react-dom/server');

function load(file, globals = {}) {
  const filename = path.resolve(__dirname, '..', file);
  const module = { exports: {} };
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true },
  }).outputText;
  vm.runInNewContext(code, { exports: module.exports, AbortSignal, ...globals, require: name => {
    if (name.endsWith('.module.css')) return {};
    if (name === 'next/image') return { __esModule: true, default: ({ priority, unoptimized, ...props }) => React.createElement('img', props) };
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : path.resolve(path.dirname(filename), name);
      const resolved = [base, base + '.ts', base + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile());
      if (!resolved) throw new Error('Missing module: ' + name);
      return load(resolved, globals);
    }
    return require(name);
  } });
  return module.exports;
}
const { PRICED_CATALOGS, toPricedCatalog, formatCatalogPrice } = load('lib/priced-catalog.ts');
const View = load('components/store/priced-catalog.tsx').default;
const fixture = () => ({
  lines: Object.entries(PRICED_CATALOGS).map(([key, value], position) => ({ id: value.lineId, name: value.name, description: '', active: true, position })),
  products: [
    { id: 'expresso', line_id: PRICED_CATALOGS.expressoitaliano.lineId, name: 'Expresso Italiano', active: true, available: true, has_flavors: true, position: 0, package_price: 99999, sku: 'INTERNAL' },
    { id: 'grego', line_id: PRICED_CATALOGS.grego.lineId, name: 'Iogurte Grego', active: true, available: true, has_flavors: true, position: 1 },
    { id: 'frozen', line_id: PRICED_CATALOGS.frozen.lineId, name: 'Frozen Yogurt', active: true, available: true, has_flavors: true, position: 2 },
    { id: 'drink', line_id: PRICED_CATALOGS.expressoitaliano.lineId, name: 'Yogo Drink', active: true, available: true, has_flavors: false, position: 3, package_price: 2500 },
  ],
  flavors: [
    { id: 'chocolate', product_id: 'expresso', name: 'Chocolate', active: true, available: true, position: 1, package_price: 6260, bundle_price: 31300, package_weight_grams: 2000, sku: 'SECRET-SKU' },
    { id: 'baunilha', product_id: 'expresso', name: 'Baunilha', active: true, available: true, position: 0, package_price: 5835 },
    { id: 'inactive', product_id: 'expresso', name: 'Oculto', active: false, available: true, position: 2, package_price: 100 },
    { id: 'natural', product_id: 'grego', name: 'Natural', active: true, available: true, position: 0, package_price: 6590 },
    { id: 'blueberry', product_id: 'frozen', name: 'Blueberry', active: true, available: true, position: 0, package_price: 7195 },
  ],
  settings: { whatsapp: 'PRIVATE', minimum_order: 100000 },
  highlights: [{ title: 'PRIVATE-HIGHLIGHT' }],
});
const plain = value => JSON.parse(JSON.stringify(value));

test('each URL selects only its active line and reads exact flavor prices in cents', () => {
  for (const key of Object.keys(PRICED_CATALOGS)) {
    const catalog = toPricedCatalog(fixture(), key);
    const ids = catalog.groups.flatMap(group => group.items.map(item => item.id));
    assert.deepEqual(plain(ids), key === 'expressoitaliano' ? ['baunilha', 'chocolate', 'drink'] : key === 'grego' ? ['natural'] : ['blueberry']);
  }
  assert.equal(toPricedCatalog(fixture(), 'expressoitaliano').groups[0].items[0].price, 5835);
  assert.match(formatCatalogPrice(5835), /^R\$\s58,35$/);
});

test('does not mutate source, and changed admin prices are immediately reflected', () => {
  const source = fixture();
  const original = JSON.stringify(source);
  toPricedCatalog(source, 'expressoitaliano');
  assert.equal(JSON.stringify(source), original);
  source.flavors[0].package_price = 6525;
  assert.equal(toPricedCatalog(source, 'expressoitaliano').groups[0].items[1].price, 6525);
});

test('inactive lines, products and flavors stay hidden; unavailable stays labelled', () => {
  const source = fixture();
  source.products[0].available = false;
  assert.equal(toPricedCatalog(source, 'expressoitaliano').groups[0].items.every(item => !item.available), true);
  source.products[0].active = false;
  assert.deepEqual(plain(toPricedCatalog(source, 'expressoitaliano').groups.map(group => group.id)), ['drink']);
  source.lines[0].active = false;
  assert.equal(toPricedCatalog(source, 'expressoitaliano').groups.length, 0);
});

test('missing or invalid flavor prices never fall back to the parent price or zero', () => {
  for (const price of [null, undefined, 0, -10, NaN, Infinity, 100.5, '6260']) {
    const source = fixture();
    source.flavors[1].package_price = price;
    assert.equal(toPricedCatalog(source, 'expressoitaliano').groups[0].items[0].price, null);
  }
  assert.equal(formatCatalogPrice(null), 'Sob consulta');
});

test('allowlist excludes weights, SKUs, settings, promotions and other-line prices', () => {
  const catalog = toPricedCatalog(fixture(), 'expressoitaliano');
  assert.deepEqual(Object.keys(catalog), ['groups']);
  for (const group of catalog.groups) {
    assert.deepEqual(Object.keys(group), ['id', 'name', 'hasFlavors', 'items']);
    for (const item of group.items) assert.deepEqual(Object.keys(item), ['id', 'name', 'price', 'available', 'preparationLabel']);
  }
  assert.doesNotMatch(JSON.stringify(catalog), /PRIVATE|SECRET|INTERNAL|bundle_price|package_weight|6590|7195/);
});

test('simple accessible table renders names and BRL package prices without ordering controls', () => {
  const source = fixture();
  source.flavors[0].available = false;
  const html = renderToStaticMarkup(React.createElement(View, { catalog: toPricedCatalog(source, 'expressoitaliano'), catalogKey: 'expressoitaliano' }));
  assert.match(html, /Preço por pacote/);
  assert.match(html, /R\$\s58,35/);
  assert.match(html, /scope="col"/);
  assert.match(html, /scope="row"/);
  assert.match(html, /Temporariamente indisponível/);
  assert.doesNotMatch(html, /Blueberry|Natural|Oculto|carrinho|Lucro|<input|<form|SECRET-SKU/);
});

test('empty and failed catalogs show useful states and retry only their own URL', () => {
  const empty = renderToStaticMarkup(React.createElement(View, { catalog: { groups: [] }, catalogKey: 'grego' }));
  assert.match(empty, /Catálogo em atualização/);
  const failed = renderToStaticMarkup(React.createElement(View, { catalog: null, catalogKey: 'frozen' }));
  assert.match(failed, /role="alert"/);
  assert.match(failed, /href="\/catalogofrozen"/);
  assert.doesNotMatch(failed, /R\$/);
});

test('server reads live data without caching and metadata stays noindex', async () => {
  let options;
  const server = load('components/store/priced-catalog-page.tsx', { fetch: async (_url, opts) => { options = opts; return { ok: true, json: async () => fixture() }; } });
  const page = await server.default({ catalogKey: 'grego' });
  assert.equal(options.cache, 'no-store');
  assert.equal(page.props.catalog.groups[0].items[0].price, 6590);
  const meta = server.pricedCatalogMetadata('grego');
  assert.equal(meta.robots.index, false);
  assert.equal(meta.alternates.canonical, 'https://pedidos.yogomarcas.com.br/catalogogrego');
});

test('failed or malformed upstream never exposes errors or substitutes stale prices', async () => {
  for (const response of [{ ok: false }, { ok: true, json: async () => ({ error: 'PRIVATE-UPSTREAM' }) }]) {
    const server = load('components/store/priced-catalog-page.tsx', { fetch: async () => response });
    const page = await server.default({ catalogKey: 'frozen' });
    assert.equal(page.props.catalog, null);
  }
});

test('three separate routes are dynamic and use their matching catalog keys', () => {
  for (const [key, definition] of Object.entries(PRICED_CATALOGS)) {
    const code = fs.readFileSync(path.join(__dirname, '..', 'app', definition.path.slice(1), 'page.tsx'), 'utf8');
    assert.match(code, /export const dynamic = 'force-dynamic'/);
    assert.ok(code.includes(`catalogKey="${key}"`));
  }
});
