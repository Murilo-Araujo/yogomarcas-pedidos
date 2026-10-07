'use client';

import { useId, useState } from 'react';
import { ArrowDownToLine, Check, ChevronRight, Copy, Monitor, MoreVertical, PlusSquare, Share, Smartphone, X } from 'lucide-react';
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { usePwa } from './provider';
import type { InstallPlatform } from '@/lib/pwa';

const PORTAL_URL = 'https://pedidos.yogomarcas.com.br/';

export default function InstallApp({ variant = 'card' }: { variant?: 'card' | 'link' }) {
  const { ready, installed, platform, embedded, canInstall, installing, install } = usePwa();
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<InstallPlatform | null>(null);
  const [message, setMessage] = useState('');
  const [copied, setCopied] = useState(false);
  const guideId = useId();
  const device = selected ?? platform;

  if (!ready || installed) return null;

  async function requestInstall() {
    const outcome = await install();
    setMessage(outcome === 'accepted'
      ? 'Instalação solicitada. Assim que terminar, abra o ícone da Yogomarcas na sua tela de aplicativos.'
      : outcome === 'dismissed'
        ? 'Você pode instalar depois pelo menu do navegador. Veja o passo a passo abaixo.'
        : 'A instalação direta não está disponível agora. Use o menu do navegador seguindo os passos abaixo.');
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(PORTAL_URL);
      setCopied(true);
    } catch {
      setMessage('Copie o endereço abaixo e abra no navegador do celular.');
    }
  }

  return (
    <Dialog open={open} onOpenChange={value => { setOpen(value); if (value) { setMessage(''); setCopied(false); } }}>
      {variant === 'card' ? (
        <section className="pwa-install-card" aria-label="Aplicativo Yogomarcas">
          <div className="pwa-card-icon"><Smartphone size={24} aria-hidden="true"/></div>
          <div className="pwa-card-copy"><strong>Seu próximo pedido, a um toque.</strong><p>Tenha a Yogomarcas na tela inicial do celular.</p></div>
          <DialogTrigger asChild><button type="button" className="btn secondary pwa-card-button"><ArrowDownToLine size={17} aria-hidden="true"/>Instalar aplicativo<ChevronRight size={16} aria-hidden="true"/></button></DialogTrigger>
        </section>
      ) : (
        <DialogTrigger asChild><button type="button" className="pwa-install-link"><Smartphone size={17} aria-hidden="true"/>Instalar aplicativo</button></DialogTrigger>
      )}

      <DialogContent className="pwa-install-dialog" showCloseButton={false}>
        <DialogClose asChild><button type="button" className="pwa-close icon-button" aria-label="Fechar orientações de instalação"><X size={20} aria-hidden="true"/></button></DialogClose>
        <DialogHeader>
          <div className="pwa-app-heading"><img src="/icons/icon-192.png" alt="" width={64} height={64}/><div><span>YOGOMARCAS</span><p>Portal de pedidos</p></div></div>
          <DialogTitle>Seus pedidos, sempre à mão.</DialogTitle>
          <DialogDescription>Instale gratuitamente e abra o portal direto pelo ícone no celular.</DialogDescription>
        </DialogHeader>

        <div className="pwa-device-picker" role="group" aria-label="Ver instruções para">
          {([{ id: 'android', label: 'Android', icon: Smartphone }, { id: 'ios', label: 'iPhone', icon: Smartphone }, { id: 'desktop', label: 'Computador', icon: Monitor }] as const).map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" aria-pressed={device === id} aria-controls={guideId} onClick={() => setSelected(id)}><Icon size={16} aria-hidden="true"/>{label}</button>
          ))}
        </div>

        {embedded && <p className="pwa-browser-note">Você abriu o portal dentro de outro aplicativo. Copie o link abaixo e abra no <strong>{platform === 'ios' ? 'Safari' : 'Chrome'}</strong> para instalar.</p>}

        {canInstall && !embedded && device === platform && device !== 'ios' && (
          <button type="button" className="btn primary wide" onClick={() => void requestInstall()} disabled={installing}><ArrowDownToLine size={18} aria-hidden="true"/>{installing ? 'Aguardando confirmação…' : 'Instalar agora'}</button>
        )}

        <div id={guideId} className="pwa-guide">
          {device === 'ios' ? (
            <ol className="pwa-steps">
              <li><span>1</span><div><strong>Abra este site no Safari</strong><p>Use o navegador do iPhone ou iPad.</p></div></li>
              <li><span>2</span><div><strong><Share size={17} aria-hidden="true"/>Toque em Compartilhar</strong><p>O botão pode estar na barra do Safari ou dentro do menu da página.</p></div></li>
              <li><span>3</span><div><strong><PlusSquare size={17} aria-hidden="true"/>Adicionar à Tela de Início</strong><p>Role a lista de opções. Se não aparecer, procure em “Editar Ações”.</p></div></li>
              <li><span>4</span><div><strong>Confirme em Adicionar</strong><p>Se aparecer “Abrir como App da Web”, deixe essa opção ativada. Pronto: abra pelo ícone da Yogomarcas.</p></div></li>
            </ol>
          ) : device === 'android' ? (
            <ol className="pwa-steps">
              <li><span>1</span><div><strong>Abra este site no Chrome</strong><p>Use o navegador do celular, fora do WhatsApp ou Instagram.</p></div></li>
              <li><span>2</span><div><strong><MoreVertical size={17} aria-hidden="true"/>Abra o menu de três pontos</strong><p>Toque em “Instalar aplicativo” ou “Adicionar à tela inicial”. O nome varia conforme o navegador.</p></div></li>
              <li><span>3</span><div><strong>Confirme a instalação</strong><p>Se aparecer a opção “Instalar”, selecione-a. Depois, abra a Yogomarcas pela tela de aplicativos.</p></div></li>
            </ol>
          ) : (
            <ol className="pwa-steps">
              <li><span>1</span><div><strong>Use o Chrome ou o Edge</strong><p>Abra o portal no navegador do computador.</p></div></li>
              <li><span>2</span><div><strong>Procure o ícone de instalação</strong><p>Ele pode aparecer na barra de endereço ou no menu de aplicativos do navegador.</p></div></li>
              <li><span>3</span><div><strong>Confirme em Instalar</strong><p>Para instalar no celular, abra o endereço abaixo nele e escolha Android ou iPhone neste guia.</p></div></li>
            </ol>
          )}
        </div>

        <p className="pwa-install-status" role="status" aria-live="polite">{message}</p>
        <div className="pwa-link-box"><span>Endereço do portal</span><a href={PORTAL_URL}>{PORTAL_URL.replace('https://', '').replace(/\/$/, '')}</a><button type="button" className="btn secondary" onClick={() => void copyLink()}>{copied ? <Check size={16} aria-hidden="true"/> : <Copy size={16} aria-hidden="true"/>}{copied ? 'Link copiado' : 'Copiar link'}</button></div>
        <p className="pwa-footnote">Use seu telefone e PIN para entrar, se solicitado. É preciso ter internet para consultar preços e enviar pedidos.</p>
      </DialogContent>
    </Dialog>
  );
}
