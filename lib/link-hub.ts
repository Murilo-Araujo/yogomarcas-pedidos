export const LINK_ICONS = ['catalog', 'whatsapp', 'shopping', 'globe', 'instagram', 'flask', 'video', 'map', 'mail', 'phone', 'link'] as const;
export type LinkIcon = typeof LINK_ICONS[number];
export type HubLink = {
  id: string;
  title: string;
  subtitle: string;
  url: string;
  icon: LinkIcon;
  image_url: string;
  badge: string;
  style: 'card' | 'featured' | 'social';
  enabled: boolean;
  starts_at: string | null;
  ends_at: string | null;
};
export type LinkHubConfig = {
  title: string;
  bio: string;
  tagline: string;
  logo_url: string;
  background_color: string;
  accent_color: string;
  footer: string;
  public_url: string;
  links: HubLink[];
};
export type LinkHubRecord = { config: LinkHubConfig; version: number; updated_at: string };
export type LinkHubStats = { views: number; clicks: number; links: Record<string, number> };

const idPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function object(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Confira os dados da página.');
  return value as Record<string, unknown>;
}
function text(value: unknown, label: string, max: number, required = false): string {
  if (typeof value !== 'string') throw new Error(`Confira o campo ${label}.`);
  const result = value.trim();
  if ((required && !result) || result.length > max || /[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(result)) {
    throw new Error(`${label}: use ${required ? 'de 1 a' : 'até'} ${max} caracteres.`);
  }
  return result;
}
export function linkUrl(value: unknown, label = 'Endereço', optional = false, webOnly = false): string {
  const result = text(value, label, 2000, !optional);
  if (!result && optional) return '';
  // No executable schemes, protocol-relative URLs, credentials or header injection.
  if (/[\s\\]/.test(result) || /%0[ad]/i.test(result)) throw new Error(`${label}: informe um endereço válido.`);
  let url: URL;
  try { url = new URL(result); } catch { throw new Error(`${label}: inclua https:// no endereço.`); }
  const web = url.protocol === 'https:' || url.protocol === 'http:';
  const contact = !webOnly && ((url.protocol === 'mailto:' && /^[^?]+@[^?]+/.test(url.pathname)) || (url.protocol === 'tel:' && /^\+?[0-9().-]+$/.test(url.pathname)));
  if ((!web && !contact) || url.username || url.password || (web && !url.hostname)) throw new Error(`${label}: use um site, e-mail ou telefone válido.`);
  return result;
}
function imageUrl(value: unknown): string {
  const result = text(value, 'Imagem', 2000);
  if (!result) return '';
  if (/^\/(assets|icons)\/[a-zA-Z0-9._/-]+$/.test(result) && !result.includes('..')) return result;
  const url = linkUrl(result, 'Imagem', false, true);
  if (!url.startsWith('https://')) throw new Error('A imagem precisa usar https://.');
  return url;
}
function date(value: unknown): string | null {
  if (value === null || value === '') return null;
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) {
    throw new Error('Confira a data de início e de término.');
  }
  return new Date(value).toISOString();
}
export function parseLinkHub(value: unknown): LinkHubConfig {
  const source = object(value);
  if (!Array.isArray(source.links) || source.links.length > 50) throw new Error('A página pode ter até 50 links.');
  const ids = new Set<string>();
  const links = source.links.map((raw): HubLink => {
    const item = object(raw);
    if (typeof item.id !== 'string' || !idPattern.test(item.id) || ids.has(item.id.toLowerCase())) throw new Error('Há um link inválido ou repetido. Recarregue a página.');
    const id = item.id.toLowerCase(); ids.add(id);
    if (!LINK_ICONS.includes(item.icon as LinkIcon)) throw new Error('Escolha um ícone válido.');
    if (!['card', 'featured', 'social'].includes(item.style as string) || typeof item.enabled !== 'boolean') throw new Error('Confira o formato e a visibilidade do link.');
    const starts_at = date(item.starts_at), ends_at = date(item.ends_at);
    if (starts_at && ends_at && ends_at <= starts_at) throw new Error('O término precisa ser depois do início.');
    return {
      id, title: text(item.title, 'Título do link', 90, true), subtitle: text(item.subtitle, 'Descrição do link', 180),
      url: linkUrl(item.url), icon: item.icon as LinkIcon, image_url: imageUrl(item.image_url),
      badge: text(item.badge, 'Etiqueta', 30), style: item.style as HubLink['style'], enabled: item.enabled, starts_at, ends_at,
    };
  });
  const color = (value: unknown) => {
    if (typeof value !== 'string' || !/^#[0-9a-f]{6}$/i.test(value)) throw new Error('Escolha uma cor válida.');
    return value.toLowerCase();
  };
  return {
    title: text(source.title, 'Nome da página', 80, true), bio: text(source.bio, 'Apresentação', 240),
    tagline: text(source.tagline, 'Frase de apoio', 120), logo_url: imageUrl(source.logo_url),
    background_color: color(source.background_color), accent_color: color(source.accent_color),
    footer: text(source.footer, 'Rodapé', 180), public_url: linkUrl(source.public_url, 'Endereço público', true, true), links,
  };
}
export function linkIsVisible(link: HubLink, now = Date.now()): boolean {
  return link.enabled && (!link.starts_at || Date.parse(link.starts_at) <= now) && (!link.ends_at || Date.parse(link.ends_at) > now);
}
export function publicLinkHub(value: unknown, now = Date.now()): LinkHubConfig {
  const config = parseLinkHub(value);
  return { ...config, links: config.links.filter(link => linkIsVisible(link, now)) };
}
// Choose a readable foreground for any custom background (WCAG relative luminance).
export function contrastInk(hex: string): '#ffffff' | '#000000' {
  const linear = [1, 3, 5].map(offset => parseInt(hex.slice(offset, offset + 2), 16) / 255).map(c => c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
  const luminance = linear[0] * 0.2126 + linear[1] * 0.7152 + linear[2] * 0.0722;
  return luminance > 0.179 ? '#000000' : '#ffffff';
}
