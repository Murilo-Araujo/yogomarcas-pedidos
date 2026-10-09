import { cp, mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const source = path.join(root, 'node_modules/@tabler/icons');
const { version } = JSON.parse(await readFile(path.join(source, 'package.json'), 'utf8'));
const variants = ['outline', 'filled'];
const catalog = await Promise.all(variants.map(async variant => {
  const names = (await readdir(path.join(source, 'icons', variant)))
    .filter(name => name.endsWith('.svg')).map(name => name.slice(0, -4)).sort();
  if (names.some(name => !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name))) throw new Error('Unexpected Tabler icon name.');
  return { variant, names };
}));
const generated = `// Generated from @tabler/icons. Update with npm run icons:update.\nexport const TABLER_VERSION = '${version}';\nexport const TABLER_NAMES: Record<'outline' | 'filled', readonly string[]> = {\n${catalog.map(({ variant, names }) => `  ${variant}: \`\n${names.join('\n')}\n\`.trim().split('\\n'),`).join('\n')}\n};\n`;
const catalogPath = path.join(root, 'lib/tabler-icon-names.ts');
if (process.argv.includes('--update-catalog')) await writeFile(catalogPath, generated);
else if (await readFile(catalogPath, 'utf8') !== generated) {
  throw new Error('Tabler catalog is outdated. Run npm run icons:update and commit lib/tabler-icon-names.ts.');
}
const target = path.join(root, 'public/vendor/tabler', version);
await mkdir(target, { recursive: true });
await Promise.all([
  ...variants.map(variant => cp(path.join(source, 'icons', variant), path.join(target, variant), { recursive: true })),
  cp(path.join(source, 'LICENSE'), path.join(target, 'LICENSE.txt')),
]);
console.log(`Tabler ${version}: ${catalog.reduce((total, item) => total + item.names.length, 0)} icons ready.`);
