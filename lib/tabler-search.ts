import { TABLER_NAMES } from './tabler-icon-names.ts';
import type { TablerIconId, TablerVariant } from './tabler-icons.ts';

export type IconFilter = 'all' | TablerVariant;
export const TABLER_CATALOG = (['outline', 'filled'] as const).flatMap(variant =>
  TABLER_NAMES[variant].map(name => ({ id: `tabler:${variant}/${name}` as TablerIconId, name, variant })),
).sort((a, b) => a.name.localeCompare(b.name) || a.variant.localeCompare(b.variant));
const aliases: Record<string, string> = {
  whatsapp: 'whatsapp', instagram: 'instagram', telefone: 'phone', celular: 'device mobile',
  email: 'mail', localizacao: 'map pin', mapa: 'map', sorvete: 'ice cream',
  loja: 'building store', carrinho: 'shopping cart', catalogo: 'book', coracao: 'heart',
  estrela: 'star', pesquisa: 'search', buscar: 'search', entrega: 'truck', site: 'world',
};
export function searchTablerIcons(query: string, filter: IconFilter = 'all') {
  const normalized = query.replace(/^Icon(?=[A-Z])/, '').replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  const tokens = (aliases[normalized] || normalized).split(/\s+/).filter(Boolean);
  return TABLER_CATALOG.filter(icon => (filter === 'all' || icon.variant === filter) && tokens.every(token => icon.name.includes(token)));
}
