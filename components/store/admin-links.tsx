'use client';

import { useEffect, useRef, useState } from 'react';
import dynamic from 'next/dynamic';
import { ArrowDown, ArrowUp, Check, ChevronDown, ExternalLink, Eye, ImagePlus, Link2, LoaderCircle, MousePointer2, Plus, RefreshCw, Save, Trash2, Type } from 'lucide-react';
import { toast } from 'sonner';
import { api, dateTime } from '@/lib/portal';
import { linkIsVisible, parseLinkHub, type HubLink, type LinkHubConfig, type LinkHubRecord, type LinkHubStats } from '@/lib/link-hub';
import LinkHub from '@/components/links/link-hub';
import { HubIcon } from '@/components/links/hub-icon';
import { tablerIconLabel } from '@/lib/tabler-icons';
import { parseCardAppearance, parsePageAppearance } from '@/lib/link-appearance';
import PageTypography, { CardAppearanceControls, SizeControl } from './link-appearance-controls';
import { Switch } from '@/components/ui/switch';
import { AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import styles from './admin-links.module.css';

const TablerIconPicker = dynamic(() => import('./tabler-icon-picker'), { ssr: false });
const emptyStats: LinkHubStats = { views: 0, clicks: 0, links: {} };
function localDate(iso: string | null) {
  if (!iso) return '';
  const date = new Date(iso);
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16);
}
function toIso(value: string) { return value ? new Date(value).toISOString() : null; }
function Field({ label, children, hint }: { label: string; children: React.ReactNode; hint?: string }) {
  return <label className="field"><span>{label}</span>{children}{hint && <small className={styles.hint}>{hint}</small>}</label>;
}
function ImageField({ label, value, onChange, onUpload }: { label: string; value: string; onChange: (url: string) => void; onUpload: (delta: number) => void }) {
  const [uploading, setUploading] = useState(false);
  async function upload(file: File) {
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type) || file.size > 5 * 1024 * 1024) { toast.error('Escolha uma imagem JPG, PNG ou WebP de até 5 MB.'); return; }
    setUploading(true); onUpload(1);
    try {
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result).split(',')[1]); reader.onerror = () => reject(new Error('Não foi possível ler a imagem.')); reader.readAsDataURL(file); });
      const result = await api('upload', { mime: file.type, data }, true); onChange(result.url);
    } catch (error) { toast.error(error instanceof Error ? error.message : 'Não foi possível enviar a imagem.'); }
    finally { setUploading(false); onUpload(-1); }
  }
  return <div className={styles.imageField}><span className={styles.fieldLabel}>{label}</span><div className={styles.imageRow}>
    <div className={styles.imageThumb}>{value ? <img src={value} alt="Prévia da imagem" /> : <ImagePlus size={24} aria-hidden="true" />}</div>
    <div><label className={`btn secondary ${styles.uploadButton}`}>{uploading ? <LoaderCircle size={16} className="spin" /> : <ImagePlus size={16} />}{uploading ? 'Enviando…' : 'Escolher imagem'}<input type="file" accept="image/jpeg,image/png,image/webp" aria-label={label} disabled={uploading} onChange={event => { const file = event.target.files?.[0]; event.target.value = ''; if (file) void upload(file); }} /></label><p className={styles.hint}>JPG, PNG ou WebP · até 5 MB</p>{value && <button className={styles.textButton} type="button" disabled={uploading} onClick={() => onChange('')}>Remover imagem</button>}</div>
  </div><details className={styles.imageAddress}><summary>Usar endereço de uma imagem</summary><input aria-label={`Endereço: ${label}`} value={value} maxLength={2000} placeholder="https://…" onChange={event => onChange(event.target.value)} /></details></div>;
}
export default function AdminLinks() {
  const [saved, setSaved] = useState<LinkHubRecord | null>(null), [draft, setDraft] = useState<LinkHubConfig | null>(null);
  const [stats, setStats] = useState<LinkHubStats>(emptyStats), [loading, setLoading] = useState(true), [busy, setBusy] = useState(false), [uploads, setUploads] = useState(0);
  const [error, setError] = useState(''), [expanded, setExpanded] = useState<string | null>(null), [mobilePreview, setMobilePreview] = useState(false);
  const [confirm, setConfirm] = useState<{ type: 'reload' } | { type: 'delete'; link: HubLink } | null>(null);
  const formRef = useRef<HTMLFormElement>(null);
  const [iconTarget, setIconTarget] = useState<string | null>(null);
  const iconTrigger = useRef<HTMLButtonElement | null>(null);
  const dirty = !!draft && !!saved && JSON.stringify(draft) !== JSON.stringify(saved.config);
  const disabled = busy || uploads > 0;
  async function load() {
    setLoading(true); setError('');
    try { const result = await api('admin_link_hub', {}, true); const config = parseLinkHub(result.page.config); setSaved({ ...result.page, config }); setDraft(config); setStats(result.stats); }
    catch (e) { setError(e instanceof Error ? e.message : 'Não foi possível carregar a página.'); }
    finally { setLoading(false); }
  }
  useEffect(() => { void load(); }, []);
  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => { event.preventDefault(); event.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);
  function patch(values: Partial<LinkHubConfig>) { setDraft(current => current ? { ...current, ...values } : current); }
  function patchLink(id: string, values: Partial<HubLink>) { setDraft(current => current ? { ...current, links: current.links.map(link => link.id === id ? { ...link, ...values } : link) } : current); }
  function move(id: string, direction: number) {
    setDraft(current => { if (!current) return current; const links = [...current.links], index = links.findIndex(link => link.id === id), target = index + direction; if (target < 0 || target >= links.length) return current; [links[index], links[target]] = [links[target], links[index]]; return { ...current, links }; });
  }
  function addLink() {
    const link: HubLink = { id: crypto.randomUUID(), title: '', subtitle: '', url: '', image_url: '', badge: '', icon: 'link', style: 'card', enabled: true, starts_at: null, ends_at: null, appearance: parseCardAppearance(undefined) };
    setDraft(current => current ? { ...current, links: [...current.links, link] } : current); setExpanded(link.id); setMobilePreview(false);
  }
  async function save(event: React.FormEvent) {
    event.preventDefault(); if (!draft || !saved || disabled) return;
    setBusy(true); setError('');
    try {
      const config = parseLinkHub(draft);
      const page = await api('save_link_hub', { config, version: saved.version }, true);
      setSaved(page); setDraft(page.config); toast.success('Sua página de links foi publicada.');
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Não foi possível publicar.';
      setError(message); toast.error(message);
    }
    finally { setBusy(false); }
  }
  if (loading && !draft) return <section className="admin-panel"><p className="management-empty" role="status"><LoaderCircle className="spin" size={20} />Carregando sua página de links…</p></section>;
  if (!draft || !saved) return <section className="admin-panel management-panel"><div className="management-panel-body"><p className="error-box" role="alert">{error}</p><button className="btn secondary" onClick={() => void load()}><RefreshCw size={16} />Tentar novamente</button></div></section>;
  const appearance = parsePageAppearance(draft.appearance);
  const iconLink = draft.links.find(link => link.id === iconTarget);
  const pageUrl = saved.config.public_url || 'https://pedidos.yogomarcas.com.br/links';
  const changeUpload = (delta: number) => setUploads(current => current + delta);
  return <div className={styles.container}>
    <section className={`admin-panel ${styles.intro}`}><div className={styles.heading}><span className="management-heading-icon"><Link2 size={23} aria-hidden="true" /></span><div><h2>Todos os caminhos levam à Yogo</h2><p>Personalize a página que vai na bio do Instagram e nos seus materiais.</p></div></div><div className={styles.headerActions}><button className="btn secondary" disabled={disabled || loading} onClick={() => dirty ? setConfirm({ type: 'reload' }) : void load()}><RefreshCw size={16} className={loading ? 'spin' : ''} />Atualizar</button><a href={pageUrl} target="_blank" rel="noreferrer" className="btn secondary">Ver página<ExternalLink size={16} /></a></div></section>
    <div className={styles.metrics}><div><span><Eye size={17} />Visitas à página</span><strong>{stats.views.toLocaleString('pt-BR')}</strong><small>Últimos 30 dias</small></div><div><span><MousePointer2 size={17} />Cliques nos links</span><strong>{stats.clicks.toLocaleString('pt-BR')}</strong><small>Últimos 30 dias</small></div><div><span><Link2 size={17} />Links visíveis agora</span><strong>{saved.config.links.filter(link => linkIsVisible(link)).length}</strong><small>Na versão publicada</small></div></div>
    <div className={styles.mobileToggle} role="group" aria-label="Visualização do editor"><button aria-pressed={!mobilePreview} onClick={() => setMobilePreview(false)}>Editar página</button><button aria-pressed={mobilePreview} onClick={() => setMobilePreview(true)}><Eye size={16} />Prévia no celular</button></div>
    <div className={styles.workspace} data-preview={mobilePreview}>
      <form ref={formRef} onSubmit={save} className={styles.editor} noValidate><fieldset disabled={disabled || loading}>
        <section className="admin-panel management-panel"><div className="panel-heading management-panel-heading"><div className="management-heading-copy"><h3>Perfil e aparência</h3><p>A primeira impressão da sua marca.</p></div></div><div className={`management-panel-body ${styles.fields}`}>
          <ImageField label="Logo ou foto do perfil" value={draft.logo_url} onChange={logo_url => patch({ logo_url })} onUpload={changeUpload} />
          <SizeControl label="Tamanho da logo" value={appearance.logo_scale === 100 ? null : appearance.logo_scale} fallback={100} min={50} max={170} unit="%" step={5} onChange={logo_scale => patch({ appearance: { ...appearance, logo_scale: logo_scale ?? 100 } })} />
          <Field label="Formato da imagem" hint="Original preserva o arquivo inteiro. Redondo e quadrado recortam a imagem no centro."><select value={draft.logo_shape ?? 'original'} onChange={event => patch({ logo_shape: event.target.value as LinkHubConfig['logo_shape'] })}><option value="original">Original (sem corte)</option><option value="circle">Redondo</option><option value="rounded">Quadrado com cantos arredondados</option></select></Field>
          <label className={styles.profileToggle}><div><strong>Fundo branco atrás da imagem</strong><p>Desative para mostrar só a logo, sem a moldura branca. Para transparência, envie um PNG ou WebP sem fundo.</p></div><Switch checked={draft.logo_background ?? false} onCheckedChange={logo_background => patch({ logo_background })} aria-label="Fundo branco atrás da imagem" /></label>
          <Field label="Nome da página" hint="O nome pode aparecer abaixo da logo, separado da imagem."><input value={draft.title} maxLength={80} onChange={event => patch({ title: event.target.value })} /></Field>
          <label className={styles.profileToggle}><div><strong>Mostrar nome abaixo da imagem</strong><p>Você pode usar só o símbolo na imagem e escrever o nome da marca aqui.</p></div><Switch checked={draft.show_title ?? true} onCheckedChange={show_title => patch({ show_title })} aria-label="Mostrar nome abaixo da imagem" /></label>
          <Field label="Apresentação"><textarea rows={2} value={draft.bio} maxLength={240} onChange={event => patch({ bio: event.target.value })} /></Field>
          <Field label="Frase de apoio"><textarea rows={2} value={draft.tagline} maxLength={120} onChange={event => patch({ tagline: event.target.value })} /></Field>
          <div className={styles.colorRow}><label><input type="color" aria-label="Cor de destaque" value={draft.accent_color} onChange={event => patch({ accent_color: event.target.value })} /><span>Cor de destaque<small>{draft.accent_color}</small></span></label><label><input type="color" aria-label="Cor de fundo" value={draft.background_color} onChange={event => patch({ background_color: event.target.value })} /><span>Cor de fundo<small>{draft.background_color}</small></span></label></div>
          <Field label="Rodapé"><textarea rows={2} value={draft.footer} maxLength={180} onChange={event => patch({ footer: event.target.value })} /></Field>
          <details className={styles.advanced}><summary>Endereço para compartilhamento <ChevronDown size={16} /></summary><Field label="Endereço público (opcional)" hint="Preencha depois que o seu domínio estiver conectado. Vazio: usa o endereço atual da página."><input type="url" inputMode="url" maxLength={2000} placeholder="https://link.seudominio.com.br" value={draft.public_url} onChange={event => patch({ public_url: event.target.value })} /></Field></details>
        </div></section>
        <section className="admin-panel management-panel"><details className={styles.typographyPanel}><summary><span className="management-heading-icon"><Type size={21} aria-hidden="true" /></span><span><strong>Fontes e tamanhos</strong><small>Personalize cada texto da página com Google Fonts.</small></span><span className={styles.customizeLabel}>Personalizar<ChevronDown size={17} /></span></summary><div className="management-panel-body"><PageTypography value={appearance} onChange={appearance => patch({ appearance })} examples={{ name: draft.title, bio: draft.bio, tagline: draft.tagline, link_title: draft.links[0]?.title, link_subtitle: draft.links[0]?.subtitle, link_badge: draft.links[0]?.badge || 'Novidade', footer: draft.footer, note: 'Conecte-se com a Yogo' }} /></div></details></section>
        <section className="admin-panel management-panel"><div className="panel-heading management-panel-heading"><div className="management-heading-copy"><h3>Seus links</h3><p>Escolha a ordem, o formato e o momento de aparecer.</p></div><button className="btn secondary" type="button" onClick={addLink} disabled={draft.links.length >= 50 || disabled}><Plus size={16} />Adicionar</button></div><div className={`management-panel-body ${styles.linkList}`}>
          {!draft.links.length && <p className={styles.hint}>Adicione o primeiro link para começar.</p>}
          {draft.links.map((link, index) => <article className={styles.linkItem} key={link.id}><div className={styles.linkHeading}>
            <span className={styles.linkGlyph}><HubIcon name={link.icon} size={20} /></span><div className={styles.linkSummary}><strong>{link.title || 'Novo link'}</strong><span>{!link.enabled ? 'Oculto' : link.ends_at && Date.parse(link.ends_at) <= Date.now() ? 'Encerrado' : link.starts_at && Date.parse(link.starts_at) > Date.now() ? 'Agendado' : 'Visível'} · {Number(stats.links[link.id] || 0).toLocaleString('pt-BR')} cliques</span></div>
            <Switch checked={link.enabled} onCheckedChange={enabled => patchLink(link.id, { enabled })} aria-label={`Mostrar ${link.title || 'novo link'}`} />
            <button className={styles.editToggle} type="button" aria-expanded={expanded === link.id} aria-controls={`link-${link.id}`} onClick={() => setExpanded(expanded === link.id ? null : link.id)} aria-label={`Editar ${link.title || 'novo link'}`}><ChevronDown size={19} /></button>
          </div><div className={styles.linkTools}><span>{link.style === 'social' ? 'Ícone social' : link.style === 'featured' ? 'Card em destaque' : 'Botão'} · posição {index + 1}</span><div><button type="button" disabled={index === 0} onClick={() => move(link.id, -1)} aria-label={`Subir ${link.title || 'novo link'}`}><ArrowUp size={16} /></button><button type="button" disabled={index === draft.links.length - 1} onClick={() => move(link.id, 1)} aria-label={`Descer ${link.title || 'novo link'}`}><ArrowDown size={16} /></button><button type="button" onClick={() => setConfirm({ type: 'delete', link })} aria-label={`Remover ${link.title || 'novo link'}`}><Trash2 size={16} /></button></div></div>
            {expanded === link.id && <div id={`link-${link.id}`} className={styles.linkFields}>
              <Field label="Título do link *"><input autoFocus={!link.title} value={link.title} maxLength={90} onChange={event => patchLink(link.id, { title: event.target.value })} /></Field>
              <Field label="Endereço *" hint="Use https:// para sites, mailto: para e-mail ou tel: para telefone."><input inputMode="url" value={link.url} maxLength={2000} placeholder="https://…" onChange={event => patchLink(link.id, { url: event.target.value })} /></Field>
              <div className={styles.twoColumns}><Field label="Formato"><select value={link.style} onChange={event => patchLink(link.id, { style: event.target.value as HubLink['style'] })}><option value="card">Botão com descrição</option><option value="featured">Card em destaque</option><option value="social">Ícone social no perfil</option></select></Field><div className={styles.iconField}><span className={styles.fieldLabel}>Ícone</span><button type="button" className={styles.iconButton} aria-label={`Escolher ícone de ${link.title || 'novo link'}`} aria-haspopup="dialog" onClick={event => { iconTrigger.current = event.currentTarget; setIconTarget(link.id); }}><HubIcon name={link.icon} size={23} /><span><strong>Escolher ícone</strong><small>{tablerIconLabel(link.icon)}</small></span><ChevronDown size={16} /></button><small className={styles.hint}>Abra a biblioteca Tabler e pesquise pelo nome.</small></div></div>
              {link.style !== 'social' && <><Field label="Descrição (opcional)"><textarea rows={2} maxLength={180} value={link.subtitle} onChange={event => patchLink(link.id, { subtitle: event.target.value })} /></Field><Field label="Etiqueta (opcional)"><input maxLength={30} placeholder="Ex.: Novidade" value={link.badge} onChange={event => patchLink(link.id, { badge: event.target.value })} /></Field><ImageField label="Imagem do link (opcional)" value={link.image_url} onChange={image_url => patchLink(link.id, { image_url })} onUpload={changeUpload} /></>}
              {link.style !== 'social' && <details className={styles.advanced}><summary>Imagem, fonte e tamanho deste link<ChevronDown size={16} /></summary><CardAppearanceControls value={parseCardAppearance(link.appearance)} onChange={appearance => patchLink(link.id, { appearance })} page={appearance} hasImage={!!link.image_url} featured={link.style === 'featured'} examples={{ title: link.title, subtitle: link.subtitle, badge: link.badge }} /></details>}
              <details className={styles.advanced}><summary>Agendar visibilidade <ChevronDown size={16} /></summary><div className={styles.twoColumns}><Field label="Mostrar a partir de"><input type="datetime-local" value={localDate(link.starts_at)} onChange={event => patchLink(link.id, { starts_at: toIso(event.target.value) })} /></Field><Field label="Ocultar a partir de"><input type="datetime-local" value={localDate(link.ends_at)} onChange={event => patchLink(link.id, { ends_at: toIso(event.target.value) })} /></Field></div><p className={styles.hint}>Horário do seu dispositivo. Deixe vazio para não limitar. Links ocultos continuam ocultos, mesmo no período agendado.</p></details>
            </div>}
          </article>)}
          <button type="button" className={`btn secondary ${styles.addLink}`} disabled={draft.links.length >= 50 || disabled} onClick={addLink}><Plus size={17} />Adicionar link</button>
          <p className={styles.hint}>Os cliques consideram os últimos 30 dias, incluindo links removidos no total. Visitas e cliques são contagens, não pessoas únicas.</p>
        </div></section>
      </fieldset></form>
      <aside className={styles.previewColumn}><div className={styles.previewHeading}><Eye size={17} /><strong>Assim vai aparecer</strong><span>Prévia</span></div><p>Mostra os links visíveis neste momento. As mudanças entram no ar ao publicar.</p><div className={styles.phoneFrame}><LinkHub initialConfig={draft} preview /></div></aside>
    </div>
    <div className={styles.publishBar}><div><strong>{dirty ? 'Alterações ainda não publicadas' : 'Sua página está publicada'}</strong><span>{uploads ? 'Enviando imagem…' : `Última publicação: ${dateTime(saved.updated_at)}`}</span></div><button type="button" className="btn primary" disabled={disabled || loading || !dirty} onClick={() => formRef.current?.requestSubmit()}>{busy ? <LoaderCircle size={17} className="spin" /> : dirty ? <Save size={17} /> : <Check size={17} />}{busy ? 'Publicando…' : 'Salvar e publicar'}</button></div>
    {error && <p className="error-box" role="alert">{error}</p>}
    {iconLink && <TablerIconPicker key={iconLink.id} value={iconLink.icon} linkTitle={iconLink.title} onSelect={icon => patchLink(iconLink.id, { icon })} onClose={() => setIconTarget(null)} returnFocus={() => iconTrigger.current?.focus()} />}
    <AlertDialog open={!!confirm} onOpenChange={open => { if (!open) setConfirm(null); }}><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>{confirm?.type === 'delete' ? 'Remover este link?' : 'Descartar suas alterações?'}</AlertDialogTitle><AlertDialogDescription>{confirm?.type === 'delete' ? 'O link será removido desta edição. A página pública só muda quando você salvar e publicar.' : 'A edição atual será substituída pela última versão publicada.'}</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Voltar</AlertDialogCancel><button className="btn primary" onClick={() => { if (confirm?.type === 'delete') setDraft(current => current ? { ...current, links: current.links.filter(link => link.id !== confirm.link.id) } : current); else void load(); setConfirm(null); }}>{confirm?.type === 'delete' ? 'Remover da edição' : 'Recarregar'}</button></AlertDialogFooter></AlertDialogContent></AlertDialog>
  </div>;
}
