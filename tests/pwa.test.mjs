import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import sharp from 'sharp';
import { getInstallPlatform, isEmbeddedBrowser } from '../lib/pwa.ts';

test('installation guidance distinguishes iPhone, desktop-mode iPad, Android and computers', () => {
  assert.equal(getInstallPlatform('Mozilla/5.0 (iPhone; CPU iPhone OS 26_0 like Mac OS X)'), 'ios');
  assert.equal(getInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 5), 'ios');
  assert.equal(getInstallPlatform('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15)', 0), 'desktop');
  assert.equal(getInstallPlatform('Mozilla/5.0 (Linux; Android 15) Chrome/140'), 'android');
  assert.equal(getInstallPlatform('Mozilla/5.0 (Windows NT 10.0) Chrome/140'), 'desktop');
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 (Linux; Android 15; wv) Version/4.0 Chrome/140'), true);
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 (iPhone) Instagram 350'), true);
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 (iPhone) [FBAN/FBIOS;FBAV/500]'), true);
  assert.equal(isEmbeddedBrowser('Mozilla/5.0 Chrome/140 Safari/537.36'), false);
});

const swSource = await readFile(new URL('../public/sw.js', import.meta.url), 'utf8');
function worker({ offline = false, missingFallback = false } = {}) {
  const events = {};
  const state = { stored: [], deleted: [], fetched: [], skipped: false, claimed: false };
  const cache = {
    addAll: async requests => { state.stored.push(...requests.map(request => request.url)); },
    match: async path => path === '/offline.html' && !missingFallback ? new Response('<h1>Vamos reconectar?</h1>', { headers: { 'Content-Type': 'text/html' } }) : undefined,
  };
  const scope = vm.createContext({
    URL, Response,
    Request: class extends Request { constructor(path, options) { super(new URL(path, 'https://pedidos.yogomarcas.com.br'), options); } },
    fetch: async request => { state.fetched.push(request.url); if (offline) throw new TypeError('Network unavailable'); return new Response('fresh network response'); },
    caches: { open: async () => cache, keys: async () => ['yogomarcas-offline-v0', 'yogomarcas-offline-v1', 'other-app-cache'], delete: async name => { state.deleted.push(name); return true; } },
    self: {
      location: { origin: 'https://pedidos.yogomarcas.com.br' },
      addEventListener: (name, handler) => { events[name] = handler; },
      skipWaiting: async () => { state.skipped = true; },
      clients: { claim: async () => { state.claimed = true; } },
    },
  });
  vm.runInContext(swSource, scope);
  return {
    state,
    lifecycle: async name => { let result; events[name]({ waitUntil: promise => { result = promise; } }); await result; },
    request: request => { let response; events.fetch({ request, respondWith: promise => { response = promise; } }); return response; },
  };
}

test('worker only precaches static offline help and cleans its own obsolete cache', async () => {
  const sw = worker();
  await sw.lifecycle('install');
  assert.equal(sw.state.skipped, true);
  assert.deepEqual(sw.state.stored.map(url => new URL(url).pathname), ['/offline.html', '/assets/logo.png', '/icons/icon-192.png']);
  await sw.lifecycle('activate');
  assert.deepEqual(sw.state.deleted, ['yogomarcas-offline-v0']);
  assert.equal(sw.state.claimed, true);
});

test('navigation uses fresh network HTML and falls back only when the network fails', async () => {
  const request = { url: 'https://pedidos.yogomarcas.com.br/', method: 'GET', mode: 'navigate' };
  const online = worker();
  assert.equal(await (await online.request(request)).text(), 'fresh network response');
  assert.equal(online.state.stored.length, 0);
  const offline = worker({ offline: true });
  assert.match(await (await offline.request(request)).text(), /Vamos reconectar/);
  const evicted = worker({ offline: true, missingFallback: true });
  assert.equal((await evicted.request(request)).status, 503);
});

test('worker never intercepts order writes, APIs, customer data, RSC or third-party requests', () => {
  const sw = worker();
  for (const request of [
    { url: 'https://pedidos.yogomarcas.com.br/api/order', method: 'POST', mode: 'cors' },
    { url: 'https://pedidos.yogomarcas.com.br/api/customer', method: 'GET', mode: 'cors' },
    { url: 'https://pedidos.yogomarcas.com.br/?_rsc=abc', method: 'GET', mode: 'cors' },
    { url: 'https://pedidos.yogomarcas.com.br/_next/static/chunks/app.js', method: 'GET', mode: 'cors' },
    { url: 'https://example.supabase.co/functions/v1/order-portal', method: 'GET', mode: 'cors' },
    { url: 'https://wa.me/554532541200', method: 'GET', mode: 'navigate' },
  ]) assert.equal(sw.request(request), undefined, request.url);
  assert.equal(sw.state.stored.length, 0);
  assert.equal(sw.state.fetched.length, 0);
});

test('manifest has a stable identity and real opaque icons at the declared dimensions', async () => {
  const manifest = JSON.parse(await readFile(new URL('../public/manifest.webmanifest', import.meta.url), 'utf8'));
  assert.equal(manifest.id, '/');
  assert.equal(manifest.start_url, '/');
  assert.equal(manifest.scope, '/');
  assert.equal(manifest.display, 'standalone');
  assert.equal(manifest.prefer_related_applications, false);
  for (const icon of manifest.icons) {
    const metadata = await sharp(new URL(`../public${icon.src}`, import.meta.url).pathname).metadata();
    assert.equal(`${metadata.width}x${metadata.height}`, icon.sizes);
    assert.equal(metadata.hasAlpha, false);
  }
  const apple = await sharp(new URL('../public/icons/apple-touch-icon.png', import.meta.url).pathname).metadata();
  assert.equal(apple.width, 180);
  assert.equal(apple.height, 180);
});
