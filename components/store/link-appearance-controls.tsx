'use client';

import { useId } from 'react';
import { ChevronDown, Minus, Plus, RotateCcw, Type } from 'lucide-react';
import { HUB_FONTS, HUB_TEXT_PARTS, LINK_TEXT_PARTS, hubFontFamily, hubTextCss, type CardAppearance, type HubFont, type HubTextPart, type HubTextStyle, type LinkTextPart, type PageAppearance } from '@/lib/link-appearance';
import styles from './link-appearance-controls.module.css';

export function SizeControl({ label, value, fallback, min, max, unit = 'px', step = 1, onChange }: {
  label: string; value: number | null; fallback: number; min: number; max: number; unit?: string; step?: number; onChange: (value: number | null) => void;
}) {
  const id = useId(), current = value ?? fallback;
  return <div className={styles.size}>
    <div className={styles.sizeHeading}><label htmlFor={id}>{label}</label><button type="button" className={styles.reset} disabled={value === null} onClick={() => onChange(null)} aria-label={`Restaurar padrão: ${label}`}><RotateCcw size={12} />Padrão</button></div>
    <div className={styles.sizeRow}>
      <button type="button" onClick={() => onChange(Math.max(min, current - step))} disabled={current <= min} aria-label={`Diminuir ${label.toLowerCase()}`}><Minus size={16} /></button>
      <input id={id} type="range" min={min} max={max} step={step} value={current} onChange={event => onChange(Number(event.target.value))} />
      <button type="button" onClick={() => onChange(Math.min(max, current + step))} disabled={current >= max} aria-label={`Aumentar ${label.toLowerCase()}`}><Plus size={16} /></button>
      <output htmlFor={id}>{current}{unit}<small>{value === null ? 'Automático' : 'Personalizado'}</small></output>
    </div>
  </div>;
}
export function FontControl({ label, value, inheritLabel, onChange }: {
  label: string; value: HubFont | 'inherit'; inheritLabel?: string; onChange: (font: HubFont | 'inherit') => void;
}) {
  return <label className={styles.font}><span>{label}</span><select value={value} style={value === 'inherit' ? undefined : { fontFamily: hubFontFamily(value) }} onChange={event => onChange(event.target.value as HubFont | 'inherit')}>
    {inheritLabel && <option value="inherit">{inheritLabel}</option>}
    {HUB_FONTS.map(font => <option key={font.id} value={font.id}>{font.label}</option>)}
  </select></label>;
}
export function TextStyleControl({ label, part, value, onChange, example, fallback, inheritLabel = 'Usar fonte da página' }: {
  label: string; part: HubTextPart; value: HubTextStyle; onChange: (style: HubTextStyle) => void; example?: string; fallback?: HubTextStyle; inheritLabel?: string;
}) {
  const settings = HUB_TEXT_PARTS[part];
  const fontName = value.font === 'inherit' ? 'Fonte padrão' : HUB_FONTS.find(font => font.id === value.font)?.label;
  return <details className={styles.textControl}>
    <summary><span className={styles.typeIcon}><Type size={17} /></span><span><strong>{label}</strong><small>{fontName} · {value.size === null ? 'Tamanho automático' : `${value.size}px`}</small></span><ChevronDown size={16} /></summary>
    <div className={styles.textBody}><FontControl label={`Fonte: ${label}`} value={value.font} inheritLabel={inheritLabel} onChange={font => onChange({ ...value, font })} />
      <SizeControl label={`Tamanho: ${label}`} value={value.size} fallback={fallback?.size ?? settings.defaultSize} min={settings.min} max={settings.max} onChange={size => onChange({ ...value, size })} />
      <p className={styles.sample} style={hubTextCss(value, fallback)}>{example || 'Grandes resultados começam na base.'}</p>
    </div>
  </details>;
}
export default function PageTypography({ value, onChange, examples }: {
  value: PageAppearance; onChange: (appearance: PageAppearance) => void; examples: Partial<Record<HubTextPart, string>>;
}) {
  return <div className={styles.typography}>
    <FontControl label="Fonte padrão da página" value={value.font} onChange={font => onChange({ ...value, font: font as HubFont })} />
    <p className={styles.hint}>8 opções do Google Fonts. Escolha uma para a página ou personalize cada texto abaixo. O tamanho automático se adapta ao formato e ao celular. A prévia acompanha as mudanças.</p>
    <div className={styles.textList}>{Object.entries(HUB_TEXT_PARTS).map(([part, settings]) => <TextStyleControl key={part} label={settings.label} part={part as HubTextPart} value={value.text[part as HubTextPart]} example={examples[part as HubTextPart]} fallback={{ font: value.font, size: null }} onChange={text => onChange({ ...value, text: { ...value.text, [part]: text } })} />)}</div>
  </div>;
}

export function CardAppearanceControls({ value, onChange, page, hasImage, featured = false, examples }: {
  value: CardAppearance; onChange: (appearance: CardAppearance) => void; page: PageAppearance; hasImage: boolean; featured?: boolean; examples: Record<LinkTextPart, string>;
}) {
  return <div className={styles.typography}>
    {hasImage && <SizeControl label="Tamanho da imagem do link" value={value.image_scale === 100 ? null : value.image_scale} fallback={100} min={50} max={150} unit="%" step={5} onChange={image_scale => onChange({ ...value, image_scale: image_scale ?? 100 })} />}
    <p className={styles.hint}>Personalize só este link. No padrão, os textos acompanham as opções gerais da página.</p>
    {Object.entries(LINK_TEXT_PARTS).map(([key, part]) => <TextStyleControl key={key} label={key === 'title' ? 'Título deste link' : key === 'subtitle' ? 'Descrição deste link' : 'Etiqueta deste link'} part={part} value={value.text[key as LinkTextPart]} inheritLabel="Usar padrão dos links" fallback={{ size: page.text[part].size ?? (featured && key === 'title' ? 24 : featured && key === 'subtitle' ? 12 : HUB_TEXT_PARTS[part].defaultSize), font: page.text[part].font === 'inherit' ? page.font : page.text[part].font }} example={examples[key as LinkTextPart]} onChange={text => onChange({ ...value, text: { ...value.text, [key]: text } })} />)}
  </div>;
}
