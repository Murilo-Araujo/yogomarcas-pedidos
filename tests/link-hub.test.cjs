const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), vm = require('node:vm'), ts = require('typescript');
const React = require('react'), { renderToStaticMarkup } = require('react-dom/server');
const { config, link } = require('./fixtures/link-hub.cjs');
const cache = new Map();
function load(file) {
  const filename = path.resolve(__dirname, '..', file);
  if (cache.has(filename)) return cache.get(filename).exports;
  const module = { exports: {} }; cache.set(filename, module);
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  vm.runInNewContext(code, { exports: module.exports, URL, require: name => {
    if (name.endsWith('.module.css')) return {};
    if (name.startsWith('.') || name.startsWith('@/')) {
      const base = name.startsWith('@/') ? path.resolve(__dirname, '..', name.slice(2)) : path.resolve(path.dirname(filename), name);
      return load([base, base + '.ts', base + '.tsx'].find(candidate => fs.existsSync(candidate) && fs.statSync(candidate).isFile()));
    }
    return require(name);
  } });
  return module.exports;
}
const { parseLinkHub, publicLinkHub, linkIsVisible, linkUrl, contrastInk } = load('lib/link-hub.ts');
const LinkHub = load('components/links/link-hub.tsx').default;
test('links permit web, email and phone, and reject executable or ambiguous URLs', () => {
  for (const url of ['https://example.com/path?x=1', 'mailto:vendas@example.com', 'tel:+5545991034053']) assert.equal(linkUrl(url), url);
  for (const url of ['javascript:alert(1)', 'data:text/html,x', '//evil.example', 'file:///tmp/a', 'https://user:pass@example.com', 'https://a.example\\evil', 'mailto:a@b.com?subject=x%0ABcc:c@d.com']) assert.throws(() => linkUrl(url));
  assert.throws(() => parseLinkHub(config({ logo_url: 'data:image/svg+xml,<svg/>' })));
  assert.throws(() => parseLinkHub(config({ public_url: 'javascript:alert(1)' })));
});
test('config uses an explicit allowlist and rejects malformed drafts without truncating them', () => {
  const input = config({ internal_note: 'PRIVATE', updated_by: 'SECRET' }); input.links[0].private_field = 'PRIVATE';
  const output = parseLinkHub(input);
  assert.doesNotMatch(JSON.stringify(output), /PRIVATE|SECRET|internal_note|updated_by|private_field/);
  for (const values of [{ title: '' }, { title: 'a'.repeat(81) }, { links: Array.from({ length: 51 }, () => link()) }, { accent_color: 'red' }]) assert.throws(() => parseLinkHub(config(values)));
  assert.throws(() => parseLinkHub(config({ links: [input.links[0], input.links[0]] })));
  assert.throws(() => parseLinkHub(config({ links: [link({ enabled: 'true' })] })));
  assert.throws(() => parseLinkHub(config({ links: [link({ icon: 'missing' })] })));
});
test('hidden, future and expired links never enter the public payload; dates have exact boundaries', () => {
  const now = Date.parse('2026-10-09T12:00:00Z');
  const visible = link({ title: 'Visible', starts_at: '2026-10-09T12:00:00Z', ends_at: '2026-10-09T12:00:01Z' });
  const input = config({ links: [visible, link({ title: 'Hidden', enabled: false }), link({ title: 'Future', starts_at: '2026-10-09T12:00:01Z' }), link({ title: 'Expired', ends_at: '2026-10-09T12:00:00Z' })] });
  const before = JSON.stringify(input), output = publicLinkHub(input, now);
  assert.equal(output.links.length, 1); assert.equal(output.links[0].title, 'Visible');
  assert.doesNotMatch(JSON.stringify(output), /Hidden|Future|Expired/); assert.equal(JSON.stringify(input), before);
  assert.equal(linkIsVisible(visible, now + 1000), false);
  for (const values of [{ starts_at: 'not a date' }, { starts_at: '2026-10-09T12:00' }, { starts_at: '2026-10-09T12:00:00Z', ends_at: '2026-10-09T12:00:00Z' }]) assert.throws(() => parseLinkHub(config({ links: [link(values)] })));
});
test('SSR renders real accessible links, social labels and an editable featured image without JavaScript', () => {
  const value = config({ links: [link(), link({ title: 'Instagram', style: 'social', icon: 'instagram', url: 'https://www.instagram.com/yogomarcas' }), link({ title: 'DO NOT SHOW', enabled: false })] });
  const html = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: value }));
  assert.match(html, /href="https:\/\/pedidos.yogomarcas.com.br\/catalogo"/);
  assert.match(html, /aria-label="Instagram"/); assert.match(html, /alt="Yogomarcas"/);
  assert.match(html, /aria-label="Compartilhar página"/); assert.doesNotMatch(html, /DO NOT SHOW/);
  assert.match(html, /noopener noreferrer/); assert.match(html, /catalog-expresso-italiano-v1.webp/);
  const error = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: null }));
  assert.match(error, /Tentar novamente/); assert.doesNotMatch(error, /catalog-expresso/);
});
test('custom colors keep a high contrast foreground', () => {
  assert.equal(contrastInk('#ffffff'), '#000000'); assert.equal(contrastInk('#51358b'), '#ffffff');
  assert.equal(contrastInk('#000000'), '#ffffff'); assert.equal(contrastInk('#ffff00'), '#000000');
});
