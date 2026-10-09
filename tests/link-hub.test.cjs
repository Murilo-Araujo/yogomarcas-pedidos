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
    if (name.endsWith('.module.css')) return { __esModule: true, default: new Proxy({}, { get: (_, key) => String(key) }) };
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
test('profile appearance defaults preserve the image and allow explicit shape, background and title choices', () => {
  const legacy = config();
  const normalized = parseLinkHub(legacy);
  assert.equal(normalized.logo_url, legacy.logo_url);
  assert.equal(normalized.logo_shape, 'original'); assert.equal(normalized.logo_background, false); assert.equal(normalized.show_title, true);
  const chosen = parseLinkHub(config({ logo_shape: 'circle', logo_background: true, show_title: false }));
  assert.equal(chosen.logo_shape, 'circle'); assert.equal(chosen.logo_background, true); assert.equal(chosen.show_title, false);
  for (const invalid of [{ logo_shape: 'triangle' }, { logo_background: 'false' }, { show_title: null }]) assert.throws(() => parseLinkHub(config(invalid)));
});
test('profile uses the chosen shape and background independently of the editable name', () => {
  const shown = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: parseLinkHub(config({ title: 'Yogo Marcas', logo_shape: 'circle', logo_background: false, show_title: true })) }));
  assert.match(shown, /data-shape="circle" data-background="false"/);
  assert.match(shown, /<h1 class="nameVisible">Yogo Marcas<\/h1>/);
  const hidden = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: parseLinkHub(config({ logo_shape: 'rounded', logo_background: true, show_title: false })) }));
  assert.match(hidden, /data-shape="rounded" data-background="true"/);
  assert.match(hidden, /<h1 class="name">Yogomarcas<\/h1>/);
});

const { TABLER_NAMES, TABLER_VERSION } = load('lib/tabler-icon-names.ts');
const { isLinkIcon, tablerIconId, tablerIconUrl, LEGACY_ICONS } = load('lib/tabler-icons.ts');
const { searchTablerIcons, TABLER_CATALOG } = load('lib/tabler-search.ts');
test('every packaged Tabler icon is selectable, validates and resolves to a local SVG', () => {
  assert.equal(TABLER_VERSION, JSON.parse(fs.readFileSync('node_modules/@tabler/icons/package.json','utf8')).version);
  let total = 0;
  for (const variant of ['outline', 'filled']) {
    const packaged = fs.readdirSync(`node_modules/@tabler/icons/icons/${variant}`).filter(name => name.endsWith('.svg')).map(name => name.slice(0, -4)).sort();
    assert.deepEqual(Array.from(TABLER_NAMES[variant]), packaged);
    for (const name of packaged) {
      const id = `tabler:${variant}/${name}`;
      assert.equal(isLinkIcon(id), true);
      assert.ok(fs.existsSync('public' + tablerIconUrl(id)));
    }
    total += packaged.length;
  }
  assert.equal(TABLER_CATALOG.length, total);
  for (const legacy of Object.keys(LEGACY_ICONS)) assert.ok(isLinkIcon(tablerIconId(legacy)));
  for (const value of ['tabler:outline/missing-icon-xyz', 'tabler:solid/heart', 'tabler:outline/../heart', 'tabler:outline/heart.svg', 'constructor', 'toString', null]) assert.equal(isLinkIcon(value), false);
});
test('icon search finds names, partial names, React names and common Portuguese words across both styles', () => {
  assert.equal(searchTablerIcons('').length, TABLER_CATALOG.length);
  for (const query of ['WhatsApp', 'IconBrandWhatsapp', 'brand-whats']) assert.ok(searchTablerIcons(query).some(icon => icon.id === 'tabler:outline/brand-whatsapp'));
  assert.ok(searchTablerIcons('sorvete').some(icon => icon.name === 'ice-cream'));
  assert.ok(searchTablerIcons('coração').some(icon => icon.name === 'heart'));
  const filled = searchTablerIcons('heart', 'filled');
  assert.ok(filled.length > 0);assert.ok(filled.every(icon => icon.variant === 'filled'));
  assert.equal(searchTablerIcons('no-such-icon-xyz').length, 0);
});
test('public cards and social links render selected Tabler SVGs, including legacy brand icons', () => {
  const html = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: parseLinkHub(config({ links: [
    link({ icon: 'tabler:filled/heart', image_url: '', style: 'card' }),
    link({ icon: 'whatsapp', title: 'WhatsApp', style: 'social' }),
    link({ icon: 'instagram', title: 'Instagram', style: 'social' }),
  ] })) }));
  assert.match(html, /filled\/heart.svg/);
  assert.match(html, /outline\/brand-whatsapp.svg/);
  assert.match(html, /outline\/brand-instagram.svg/);
  assert.match(html, /background-color:currentColor/);
});

const { HUB_FONTS, parsePageAppearance, parseCardAppearance, hubTextCss } = load('lib/link-appearance.ts');
test('appearance defaults preserve existing responsive design, and sizes/fonts use a strict allowlist', () => {
  const normalized = parseLinkHub(config());
  assert.equal(normalized.appearance.font, 'system');assert.equal(normalized.appearance.logo_scale, 100);
  assert.equal(normalized.links[0].appearance.image_scale, 100);
  assert.ok(Object.values(normalized.appearance.text).every(value => value.font === 'inherit' && value.size === null));
  for (const font of HUB_FONTS) assert.equal(parsePageAppearance({ font: font.id }).font, font.id);
  for (const value of [null, [], { font: 'url(evil)' }, { font: null }, { logo_scale: 171 }, { logo_scale: '100' }, { logo_scale: 49 }, { text: { bio: { size: 53 } } }, { text: { name: { font: null } } }]) assert.throws(() => parsePageAppearance(value));
  for (const value of [{ image_scale: 151 }, { image_scale: NaN }, { text: { title: { font: 'unknown' } } }, { text: { subtitle: { size: -1 } } }, { text: { badge: { size: 12.5 } } }]) assert.throws(() => parseCardAppearance(value));
  assert.equal(Object.keys(hubTextCss({ font: 'inherit', size: null })).length, 0);
  const inherited = hubTextCss({ font: 'inherit', size: null }, { font: 'inter', size: 20 });
  assert.match(inherited.fontFamily, /--font-hub-inter/);assert.equal(inherited.fontSize, 20);
});
test('individual text and image choices reach both the public render and the live admin preview', () => {
  const value = parseLinkHub(config({
    appearance: { font: 'poppins', logo_scale: 135, text: { name: { font: 'lora', size: 30 }, bio: { size: 40 }, link_title: { font: 'inter', size: 22 }, footer: { size: 15 } } },
    links: [link({ title: 'Individual', appearance: { image_scale: 125, text: { title: { font: 'playfair', size: 28 } } } }), link({ title: 'Herdado', style: 'card' })],
  }));
  for (const preview of [false, true]) {
    const html = renderToStaticMarkup(React.createElement(LinkHub, { initialConfig: value, preview }));
    assert.match(html, /--font-hub-poppins/);assert.match(html, /--hub-logo-scale:1.35/);assert.match(html, /--hub-card-image-scale:1.25/);
    assert.match(html, /<h1[^>]*style="font-family:var\(--font-hub-lora\), Georgia, serif;font-size:30px"/);
    assert.match(html, /style="font-size:40px">Grandes resultados/);
    assert.match(html, /<strong style="font-family:var\(--font-hub-playfair\), Georgia, serif;font-size:28px">Individual/);
    assert.match(html, /<strong style="font-family:var\(--font-hub-inter\), Arial, sans-serif;font-size:22px">Herdado/);
    assert.match(html, /<p style="font-size:15px">Paraná/);
  }
});
