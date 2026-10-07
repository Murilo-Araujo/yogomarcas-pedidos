// Reuses the approved brand asset; no new logo is introduced.
import sharp from 'sharp';
import { mkdir, readFile } from 'node:fs/promises';

const logo = await readFile(new URL('../public/assets/logo.png', import.meta.url));
const target = new URL('../public/icons/', import.meta.url);
await mkdir(target, { recursive: true });

async function icon(size, name, maskable = false) {
  const width = maskable ? 352 : 408;
  const height = Math.round(width * 177 / 764);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#fbfaff"/><image x="${(512-width)/2}" y="${228-height/2}" width="${width}" height="${height}" xlink:href="data:image/png;base64,${logo.toString('base64')}"/><text x="256" y="326" text-anchor="middle" font-family="Arial,Helvetica,sans-serif" font-size="27" font-weight="600" letter-spacing="6" fill="#6656b4">PEDIDOS</text></svg>`;
  await sharp(Buffer.from(svg)).resize(size, size).flatten({ background: '#fbfaff' }).png().toFile(new URL(name, target).pathname);
}

await icon(192, 'icon-192.png');
await icon(512, 'icon-512.png');
await icon(512, 'maskable-512.png', true);
await icon(180, 'apple-touch-icon.png');
console.log('Generated 192px, 512px, maskable and Apple touch icons.');
