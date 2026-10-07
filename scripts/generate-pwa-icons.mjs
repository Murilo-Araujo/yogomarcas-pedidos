// Preserve the supplied artwork; only resize it for the platform requirements.
import sharp from 'sharp';
import { mkdir, writeFile } from 'node:fs/promises';

const source = new URL('./assets/app-icon-source.jpg', import.meta.url).pathname;
const target = new URL('../public/icons/', import.meta.url);
await mkdir(target, { recursive: true });

async function icon(size, name, maskable = false) {
  // Android can apply a circular mask. Keep the complete mark in its safe area.
  const inner = maskable ? Math.floor(size * 0.74) : size;
  const margin = Math.floor((size - inner) / 2);
  const artwork = await sharp(source).rotate().resize(inner, inner, { fit: 'contain', background: '#ffffff' }).removeAlpha().png().toBuffer();
  await sharp({ create: { width: size, height: size, channels: 3, background: '#ffffff' } })
    .composite([{ input: artwork, left: margin, top: margin }])
    .flatten({ background: '#ffffff' }).removeAlpha().png().toFile(new URL(name, target).pathname);
}

await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png');
await icon(512, 'maskable-512.png', true);
await icon(180, 'apple-touch-icon.png');
const favicon = await sharp(source).rotate().resize(64, 64, { fit: 'contain', background: '#ffffff' }).removeAlpha().png().toBuffer();
await writeFile(new URL('../app/icon.svg', import.meta.url), `<svg xmlns="http://www.w3.org/2000/svg" width="64" height="64" viewBox="0 0 64 64"><title>Yogomarcas</title><image width="64" height="64" href="data:image/png;base64,${favicon.toString('base64')}"/></svg>\n`);
console.log('Generated Android, iPhone, maskable and browser icons from the supplied artwork.');
