'use client';

import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { ArrowUpRight, BookOpen, Camera, Check, Copy, Download, FlaskConical, Globe, Link as LinkIconGlyph, Mail, MapPin, MessageCircle, Phone, QrCode, Share2, ShoppingBag, Video, X } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { API_URL, SUPABASE_KEY } from '@/lib/config';
import { contrastInk, linkIsVisible, publicLinkHub, type HubLink, type LinkHubConfig, type LinkIcon } from '@/lib/link-hub';
import styles from './link-hub.module.css';

const icons = { catalog: BookOpen, whatsapp: MessageCircle, shopping: ShoppingBag, globe: Globe, instagram: Camera, flask: FlaskConical, video: Video, map: MapPin, mail: Mail, phone: Phone, link: LinkIconGlyph };
export function HubIcon({ name, size = 23 }: { name: LinkIcon; size?: number }) {
  const Icon = icons[name] || LinkIconGlyph;
  return <Icon size={size} strokeWidth={1.7} aria-hidden="true" />;
}
function recordEvent(key: string) {
  // Aggregated counts only; a failed metric must never interrupt navigation.
  void fetch(API_URL, {
    method: 'POST', keepalive: true, headers: { apikey: SUPABASE_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ action: 'link_hub_event', key }),
  }).catch(() => {});
}
function CardContent({ link }: { link: HubLink }) {
  return <>
    {link.image_url ? <span className={styles.cardImage}><img src={link.image_url} alt="" loading="lazy" /></span> : <span className={styles.cardIcon}><HubIcon name={link.icon} /></span>}
    <span className={styles.cardCopy}>
      {link.badge && <span className={styles.badge}>{link.badge}</span>}
      <strong>{link.title}</strong>
      {link.subtitle && <span className={styles.subtitle}>{link.subtitle}</span>}
    </span>
    <span className={styles.arrow}><ArrowUpRight size={20} strokeWidth={1.7} aria-hidden="true" /></span>
  </>;
}

export default function LinkHub({ initialConfig, preview = false }: { initialConfig: LinkHubConfig | null; preview?: boolean }) {
  const [liveConfig, setLiveConfig] = useState(initialConfig);
  const [now, setNow] = useState<number | null>(null);
  const [shareOpen, setShareOpen] = useState(false), [shareUrl, setShareUrl] = useState('');
  const [qr, setQr] = useState(''), [qrError, setQrError] = useState(''), [copyState, setCopyState] = useState('');
  const viewed = useRef(false);
  const config = preview ? initialConfig : liveConfig;

  useEffect(() => {
    if (preview) return;
    if (initialConfig && !viewed.current) { viewed.current = true; recordEvent('page'); }
    const controller = new AbortController();
    const refresh = async () => {
      if (document.hidden) return;
      setNow(Date.now());
      try {
        const response = await fetch(API_URL + '?view=links', { headers: { apikey: SUPABASE_KEY }, cache: 'no-store', signal: controller.signal });
        if (response.ok) {
          const data = await response.json(); setLiveConfig(publicLinkHub(data.config));
          if (!viewed.current) { viewed.current = true; recordEvent('page'); }
        }
      } catch { /* Keep the current page available during a temporary network failure. */ }
    };
    const interval = setInterval(() => void refresh(), 60_000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  }, [preview, initialConfig]);

  useEffect(() => {
    const time = Date.now();
    const boundaries = config?.links.flatMap(link => [link.starts_at, link.ends_at]).filter((date): date is string => !!date).map(Date.parse).filter(date => date > time) || [];
    if (!boundaries.length) return;
    const timer = setTimeout(() => setNow(Date.now()), Math.min(Math.min(...boundaries) - time + 10, 2_147_483_647));
    return () => clearTimeout(timer);
  }, [config, now]);

  useEffect(() => {
    if (!shareOpen || !shareUrl) return;
    let cancelled = false; setQr(''); setQrError(''); setCopyState('');
    import('qrcode').then(module => module.default.toDataURL(shareUrl, { width: 640, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#251938', light: '#ffffff' } }))
      .then(data => { if (!cancelled) setQr(data); }).catch(() => { if (!cancelled) setQrError('Não foi possível gerar o QR Code. Você ainda pode copiar o link abaixo.'); });
    return () => { cancelled = true; };
  }, [shareOpen, shareUrl]);

  if (!config) return <main className={styles.page}><div className={styles.unavailable}><img src="/assets/logo.png" alt="Yogomarcas" width="224" /><h1>Vamos nos conectar?</h1><p>Não foi possível carregar os links agora. Tente novamente em instantes.</p><a href="/links">Tentar novamente</a></div></main>;
  const links = config.links.filter(link => linkIsVisible(link, now ?? Date.now()));
  const cards = links.filter(link => link.style !== 'social'), socials = links.filter(link => link.style === 'social');
  const variables = { '--hub-background': config.background_color, '--hub-accent': config.accent_color, '--hub-ink': contrastInk(config.background_color), '--hub-accent-ink': contrastInk(config.accent_color) } as CSSProperties;
  const follow = (event: React.MouseEvent<HTMLAnchorElement>, link: HubLink) => {
    if (preview) { event.preventDefault(); return; }
    recordEvent(link.id);
  };
  const openShare = () => {
    if (preview) return;
    setShareUrl(config.public_url || window.location.origin + window.location.pathname);
    setShareOpen(true);
  };
  async function copyLink() {
    try { await navigator.clipboard.writeText(shareUrl); setCopyState('Link copiado!'); }
    catch { setCopyState('Selecione e copie o endereço abaixo.'); }
  }
  return <>
    <main className={`${styles.page} ${preview ? styles.preview : ''}`} style={variables}>
      <div className={styles.orbit} aria-hidden="true" />
      <div className={styles.shell}>
        <div className={styles.topbar}><span className={styles.brandNote}><span aria-hidden="true" />Conecte-se com a Yogo</span><button className={styles.shareButton} onClick={openShare} disabled={preview} aria-label="Compartilhar página"><Share2 size={19} strokeWidth={1.8} /></button></div>
        <header className={styles.profile}>
          {config.logo_url && <div className={styles.logo}><img src={config.logo_url} alt={config.title} width="250" height="86" /></div>}
          <h1 className={config.logo_url ? styles.name : styles.nameWithoutLogo}>{config.title}</h1>
          {config.bio && <p className={styles.bio}>{config.bio}</p>}
          {config.tagline && <p className={styles.tagline}>{config.tagline}</p>}
          {socials.length > 0 && <nav className={styles.socials} aria-label="Redes sociais">{socials.map(link => <a key={link.id} href={link.url} onClick={event => follow(event, link)} aria-label={link.title} title={link.title} rel="noopener noreferrer" target="_blank"><HubIcon name={link.icon} size={22} /></a>)}</nav>}
        </header>
        <nav className={styles.cards} aria-label="Links da Yogomarcas">{cards.map(link => <a key={link.id} className={`${styles.card} ${link.style === 'featured' ? styles.featured : ''}`} href={link.url} onClick={event => follow(event, link)} target="_blank" rel="noopener noreferrer"><CardContent link={link} /></a>)}</nav>
        {!cards.length && <p className={styles.empty}>Novidades chegando por aqui. Acompanhe a Yogo!</p>}
        <footer className={styles.footer}><span className={styles.footerMark} aria-hidden="true">y.</span>{config.footer && <p>{config.footer}</p>}<button onClick={openShare} disabled={preview}><QrCode size={16} aria-hidden="true" />Compartilhe a Yogo</button></footer>
      </div>
    </main>
    {!preview && <Dialog open={shareOpen} onOpenChange={setShareOpen}><DialogContent className={styles.shareDialog} showCloseButton={false}>
      <button className={styles.closeDialog} onClick={() => setShareOpen(false)} aria-label="Fechar compartilhamento"><X size={21} /></button>
      <DialogHeader><DialogTitle>Leve a Yogo com você</DialogTitle><DialogDescription>Compartilhe os nossos links ou salve o QR Code.</DialogDescription></DialogHeader>
      <div className={styles.qr}>{qr ? <img src={qr} width="240" height="240" alt="QR Code para abrir os links da Yogomarcas" /> : <p role="status">{qrError || 'Preparando QR Code…'}</p>}</div>
      <div className={styles.shareActions}><button className="btn primary" onClick={() => void copyLink()}>{copyState === 'Link copiado!' ? <Check size={17} /> : <Copy size={17} />}Copiar link</button>{qr && <a className="btn secondary" href={qr} download="yogomarcas-qr-code.png"><Download size={17} />Salvar QR Code</a>}</div>
      <button className="btn secondary wide" onClick={async () => { if (navigator.share) { try { await navigator.share({ title: config.title, url: shareUrl }); } catch { /* Dismissal keeps the dialog open. */ } } else await copyLink(); }}><Share2 size={17} />Compartilhar</button>
      <label className={styles.shareAddress}><span>Endereço da página</span><input readOnly value={shareUrl} onFocus={event => event.target.select()} /></label>
      <p className={styles.copyStatus} role="status">{copyState}</p>
    </DialogContent></Dialog>}
  </>;
}
