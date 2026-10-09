export type Preparation = {waterLitres?: number; minutes?: number; title: string; steps: string[]; note?: string};
export type ProductInformation = {title: string; text: string};
export type CatalogHighlight = {id: string; product_id: string; title: string; description: string; starts_at: string; expires_at: string; active: boolean};
export type PriceChange = {kind: 'product' | 'flavor'; id: string; product_id: string; name: string; before: number; after: number};
export type PriceAdjustment = {id: string; basis_points: number; product_ids: string[] | null; scheduled_at: string; status: 'pending' | 'applied' | 'cancelled' | 'failed'; applied_at: string | null; created_at: string; changes: PriceChange[]; error: string | null};

export function parsePercentage(value: string): number | null {
  if (!/^\d{1,3}([.,]\d{1,2})?$/.test(value.trim())) return null;
  const points = Math.round(Number(value.trim().replace(',', '.')) * 100);
  return points > 0 && points <= 10000 ? points : null;
}
export function adjustedPrice(cents: number, basisPoints: number): number {
  if (!Number.isInteger(cents) || cents < 1 || cents > 20000000 || !Number.isInteger(basisPoints) || basisPoints < 1 || basisPoints > 10000) throw new Error('Reajuste inválido.');
  return Math.ceil(cents * (10000 + basisPoints) / 50000) * 5;
}
export function highlightIsActive(highlight: CatalogHighlight, now = Date.now()): boolean {
  return highlight.active && Date.parse(highlight.starts_at) <= now && Date.parse(highlight.expires_at) > now;
}
export function preparationInput(value: unknown): Preparation | null {
  if (value === null) return null;
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error('Confira o modo de preparo.');
  const p = value as Record<string, unknown>;
  const text = (v: unknown, max: number, required = false) => {
    if (typeof v !== 'string' || v.length > max || required && !v.trim()) throw new Error('Confira os textos do modo de preparo.');
    return v.trim();
  };
  if (!Array.isArray(p.steps)) throw new Error('Confira as etapas de preparo.');
  const steps = p.steps.filter(s => typeof s !== 'string' || s.trim());
  if (steps.length < 1 || steps.length > 20) throw new Error('Informe de 1 a 20 etapas de preparo.');
  const result: Preparation = {title: text(p.title, 100, true), steps: steps.map(s => text(s, 1000, true))};
  for (const key of ['waterLitres', 'minutes'] as const) {
    if (p[key] !== undefined && p[key] !== null) {
      if (typeof p[key] !== 'number' || !Number.isFinite(p[key]) || p[key] <= 0 || p[key] > 1000) throw new Error('Água e tempo devem ser números maiores que zero.');
      result[key] = p[key];
    }
  }
  if (p.note !== undefined) result.note = text(p.note, 2000);
  return result;
}
export function informationInput(value: unknown): ProductInformation[] {
  if (!Array.isArray(value) || value.length > 12) throw new Error('Use até 12 informações adicionais.');
  return value.map(item => {
    if (!item || typeof item !== 'object' || typeof item.title !== 'string' || !item.title.trim() || item.title.length > 100 || typeof item.text !== 'string' || !item.text.trim() || item.text.length > 2000) throw new Error('Preencha o título e o conteúdo de cada informação adicional.');
    return {title: item.title.trim(), text: item.text.trim()};
  });
}
