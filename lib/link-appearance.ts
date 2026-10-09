export const HUB_FONTS = [
  { id: 'system', label: 'Arial (padrão)', family: 'Arial, Helvetica, sans-serif' },
  { id: 'inter', label: 'Inter', family: 'var(--font-hub-inter), Arial, sans-serif' },
  { id: 'poppins', label: 'Poppins', family: 'var(--font-hub-poppins), Arial, sans-serif' },
  { id: 'montserrat', label: 'Montserrat', family: 'var(--font-hub-montserrat), Arial, sans-serif' },
  { id: 'nunito', label: 'Nunito', family: 'var(--font-hub-nunito), Arial, sans-serif' },
  { id: 'dm-sans', label: 'DM Sans', family: 'var(--font-hub-dm-sans), Arial, sans-serif' },
  { id: 'roboto', label: 'Roboto', family: 'var(--font-hub-roboto), Arial, sans-serif' },
  { id: 'lora', label: 'Lora', family: 'var(--font-hub-lora), Georgia, serif' },
  { id: 'playfair', label: 'Playfair Display', family: 'var(--font-hub-playfair), Georgia, serif' },
] as const;
export type HubFont = typeof HUB_FONTS[number]['id'];
export type HubTextStyle = { font: HubFont | 'inherit'; size: number | null };
export const HUB_TEXT_PARTS = {
  name: { label: 'Nome da página', min: 12, max: 48, defaultSize: 24 },
  bio: { label: 'Apresentação', min: 14, max: 52, defaultSize: 32 },
  tagline: { label: 'Frase de apoio', min: 10, max: 28, defaultSize: 14 },
  link_title: { label: 'Títulos dos links', min: 12, max: 36, defaultSize: 16 },
  link_subtitle: { label: 'Descrições dos links', min: 10, max: 26, defaultSize: 13 },
  link_badge: { label: 'Etiquetas dos links', min: 8, max: 20, defaultSize: 9 },
  footer: { label: 'Rodapé', min: 10, max: 26, defaultSize: 11 },
  note: { label: 'Chamada no topo', min: 9, max: 20, defaultSize: 11 },
} as const;
export type HubTextPart = keyof typeof HUB_TEXT_PARTS;
export const LINK_TEXT_PARTS = { title: 'link_title', subtitle: 'link_subtitle', badge: 'link_badge' } as const;
export type LinkTextPart = keyof typeof LINK_TEXT_PARTS;
export type PageAppearance = { font: HubFont; logo_scale: number; text: Record<HubTextPart, HubTextStyle> };
export type CardAppearance = { image_scale: number; text: Record<LinkTextPart, HubTextStyle> };
const fontIds = new Set<string>(HUB_FONTS.map(font => font.id));
function object(value: unknown): Record<string, unknown> {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Confira as opções de fonte e tamanho.');
  return value as Record<string, unknown>;
}
function integer(value: unknown, fallback: number, min: number, max: number): number {
  if (value === undefined) return fallback;
  if (typeof value !== 'number' || !Number.isInteger(value) || value < min || value > max) throw new Error(`Escolha um tamanho entre ${min} e ${max}.`);
  return value;
}
function textStyle(value: unknown, part: HubTextPart): HubTextStyle {
  const source = object(value), font = source.font ?? 'inherit';
  if ((source.font !== undefined && typeof source.font !== 'string') || (font !== 'inherit' && !fontIds.has(font as string))) throw new Error('Escolha uma fonte da lista.');
  const { min, max } = HUB_TEXT_PARTS[part];
  return { font: font as HubTextStyle['font'], size: source.size === null || source.size === undefined ? null : integer(source.size, min, min, max) };
}
export function parsePageAppearance(value: unknown): PageAppearance {
  const source = object(value), font = source.font === undefined ? 'system' : source.font, text = object(source.text);
  if (typeof font !== 'string' || !fontIds.has(font)) throw new Error('Escolha uma fonte da lista.');
  return {
    font: font as HubFont, logo_scale: integer(source.logo_scale, 100, 50, 170),
    text: Object.fromEntries(Object.keys(HUB_TEXT_PARTS).map(part => [part, textStyle(text[part], part as HubTextPart)])) as PageAppearance['text'],
  };
}
export function parseCardAppearance(value: unknown): CardAppearance {
  const source = object(value), text = object(source.text);
  return {
    image_scale: integer(source.image_scale, 100, 50, 150),
    text: Object.fromEntries(Object.entries(LINK_TEXT_PARTS).map(([key, part]) => [key, textStyle(text[key], part)])) as CardAppearance['text'],
  };
}
export function hubFontFamily(font: HubFont): string {
  return HUB_FONTS.find(item => item.id === font)?.family || HUB_FONTS[0].family;
}
export function hubTextCss(value: HubTextStyle, fallback?: HubTextStyle): { fontFamily?: string; fontSize?: number } {
  const font = value.font === 'inherit' ? fallback?.font ?? 'inherit' : value.font;
  const size = value.size ?? fallback?.size;
  // Missing overrides let the existing responsive sizes and inherited font apply.
  return { ...(font !== 'inherit' ? { fontFamily: hubFontFamily(font) } : {}), ...(size != null ? { fontSize: size } : {}) };
}
