'use client';

import {useEffect,useRef,type ReactNode} from 'react';
import {ArrowRight,Check,ChevronRight,LoaderCircle,ShoppingBag,X} from 'lucide-react';
import {Sheet,SheetContent,SheetDescription,SheetHeader,SheetTitle} from '@/components/ui/sheet';
import {money} from '@/lib/portal';

export const ORDER_CHECKOUT_FORM_ID='yogomarcas-order-checkout';

export default function OrderDrawer({open,onOpenChange,checkout,itemCount,packageCount,subtotal,minimumOrder,disabled,sending,onContinue,onBack,children}:{
 open:boolean;onOpenChange:(open:boolean)=>void;checkout:boolean;itemCount:number;packageCount:number;
 subtotal:number;minimumOrder:number;disabled:boolean;sending:boolean;onContinue:()=>void;onBack:()=>void;children:ReactNode;
}){
 const scrollArea=useRef<HTMLDivElement>(null);
 useEffect(()=>{
  if(!open)return;
  scrollArea.current?.scrollTo({top:0});
  if(checkout)scrollArea.current?.querySelector<HTMLElement>('[data-order-step-heading]')?.focus({preventScroll:true});
 },[open,checkout]);
 const belowMinimum=subtotal<minimumOrder;
 return <Sheet open={open} onOpenChange={value=>{if(!sending)onOpenChange(value);}}>
  <SheetContent className="cart-sheet order-sheet" showCloseButton={false} onEscapeKeyDown={event=>{if(sending)event.preventDefault();}} onPointerDownOutside={event=>{if(sending)event.preventDefault();}}>
   <SheetHeader className="order-sheet-header">
    <div className="order-heading-row">
     <span className="order-heading-icon"><ShoppingBag size={23} strokeWidth={1.7} aria-hidden="true"/></span>
     <div className="order-heading-copy"><SheetTitle>{checkout?'Finalizar pedido':'Seu pedido'}</SheetTitle><SheetDescription>{checkout?'Confira seus dados para o atendimento.':'Confira sabores, quantidades e valores.'}</SheetDescription></div>
     <button type="button" className="order-close" aria-label="Fechar pedido" disabled={sending} onClick={()=>onOpenChange(false)}><X size={20}/></button>
    </div>
    {itemCount>0&&<div className="order-header-bottom"><ol className="order-steps" aria-label="Etapas do pedido">
     <li className={checkout?'is-complete':'is-current'} aria-current={!checkout?'step':undefined}>{checkout?<button type="button" onClick={onBack} disabled={sending}><span><Check size={13} aria-hidden="true"/></span>Revisão</button>:<><span>1</span>Revisão</>}</li>
     <li className="order-step-arrow" aria-hidden="true"><ChevronRight size={14}/></li>
     <li className={checkout?'is-current':''} aria-current={checkout?'step':undefined}><span>2</span>Dados e envio</li>
    </ol><span className="order-item-count">{itemCount} {itemCount===1?'item':'itens'}</span></div>}
   </SheetHeader>
   <div className="cart-body order-sheet-scroll" ref={scrollArea}>{children}</div>
   {itemCount>0&&<footer className="order-sheet-footer" aria-label="Resumo e próxima etapa">
    <div className="order-footer-total"><div><span>Subtotal dos produtos</span><small>{packageCount.toLocaleString('pt-BR')} {packageCount===1?'pacote':'pacotes'} no pedido</small></div><strong aria-live="polite" aria-atomic="true">{money(subtotal)}</strong></div>
    {belowMinimum&&<p className="order-minimum" role="status">Pedido mínimo de {money(minimumOrder)}. Faltam {money(minimumOrder-subtotal)}.</p>}
    {checkout?<button type="submit" form={ORDER_CHECKOUT_FORM_ID} className="btn whatsapp wide order-main-action" disabled={disabled||sending||belowMinimum}>{sending?<LoaderCircle className="spin" size={18}/>:<ShoppingBag size={18}/>}Enviar pelo WhatsApp<ArrowRight size={18}/></button>:<button type="button" className="btn primary wide order-main-action" onClick={onContinue} disabled={disabled||sending||belowMinimum}>Continuar pedido<ArrowRight size={18}/></button>}
    <p className="order-footer-hint">{checkout?'O WhatsApp abrirá com seu pedido pronto para enviar.':'Na próxima etapa, você confere os dados de envio.'}</p>
   </footer>}
  </SheetContent>
 </Sheet>;
}
