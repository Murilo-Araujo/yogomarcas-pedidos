import { TABLER_NAMES, TABLER_VERSION } from './tabler-icon-names.ts';

export type TablerVariant = 'outline' | 'filled';
export type TablerIconId = `tabler:${TablerVariant}/${string}`;
export const LEGACY_ICONS = {
  catalog: 'book', whatsapp: 'brand-whatsapp', shopping: 'shopping-bag', globe: 'world',
  instagram: 'brand-instagram', flask: 'flask', video: 'video', map: 'map-pin',
  mail: 'mail', phone: 'phone', link: 'link',
} as const;
export type LegacyIcon = keyof typeof LEGACY_ICONS;
export type LinkIcon = LegacyIcon | TablerIconId;
const names = {
  outline: new Set(TABLER_NAMES.outline),
  filled: new Set(TABLER_NAMES.filled),
};
export function isLinkIcon(value: unknown): value is LinkIcon {
  if (typeof value !== 'string') return false;
  if (Object.hasOwn(LEGACY_ICONS, value)) return true;
  const match = /^tabler:(outline|filled)\/([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(value);
  return !!match && names[match[1] as TablerVariant].has(match[2]);
}
export function tablerIconId(value: LinkIcon): TablerIconId {
  if (Object.hasOwn(LEGACY_ICONS, value)) return `tabler:outline/${LEGACY_ICONS[value as LegacyIcon]}`;
  return isLinkIcon(value) ? value as TablerIconId : 'tabler:outline/link';
}
export function tablerIconUrl(value: LinkIcon): string {
  return `/vendor/tabler/${TABLER_VERSION}/${tablerIconId(value).slice(7)}.svg`;
}
export function tablerIconLabel(value: LinkIcon): string {
  const [variant, name] = tablerIconId(value).slice(7).split('/');
  return `${name} · ${variant === 'filled' ? 'preenchido' : 'contorno'}`;
}
