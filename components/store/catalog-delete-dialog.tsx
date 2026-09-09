'use client';
import {useState} from 'react';
import {Check,Trash2,LoaderCircle,RefreshCw} from 'lucide-react';
import {api} from '@/lib/portal';
import {AlertDialog,AlertDialogAction,AlertDialogCancel,AlertDialogContent,AlertDialogDescription,AlertDialogFooter,AlertDialogHeader,AlertDialogTitle} from '@/components/ui/alert-dialog';
export type DeleteTarget={kind:'product'|'flavor';id:string;name:string;product_id?:string;flavors?:number};
export default function CatalogDeleteDialog({target,onClose,onDeleted}:{target:DeleteTarget|null;onClose:()=>void;onDeleted:()=>Promise<unknown>}){
 const [busy,setBusy]=useState(false),[error,setError]=useState(''),[deleted,setDeleted]=useState(false);
 const item=target?.kind==='product'?'produto':'sabor';
 function close(){setError('');setDeleted(false);onClose();}
 async function confirm(e:React.MouseEvent<HTMLButtonElement>){
  e.preventDefault();
  if(!target||busy)return;
  setBusy(true);setError('');
  let mutationCompleted=deleted;
  try{
   if(!mutationCompleted){
    await api(target.kind==='product'?'delete_product':'delete_flavor',{id:target.id,product_id:target.product_id},true);
    mutationCompleted=true;setDeleted(true);
   }
   await onDeleted();close();
  }catch(e){
   setError(mutationCompleted
    ?'A exclusão foi concluída, mas não conseguimos atualizar a lista. Clique em Atualizar catálogo para tentar novamente.'
    :e instanceof Error?e.message:'Não foi possível excluir. Tente novamente.');
  }finally{setBusy(false);}
 }
 return <AlertDialog open={!!target} onOpenChange={open=>{if(!open&&!busy)close();}}>
  <AlertDialogContent className="catalog-delete-dialog" onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}>
   <AlertDialogHeader>
    <div className={deleted?'delete-symbol deletion-complete':'delete-symbol'}>{deleted?<Check size={23}/>:<Trash2 size={23}/>}</div>
    <AlertDialogTitle>{deleted?'Exclusão concluída':`Excluir ${item}?`}</AlertDialogTitle>
    <AlertDialogDescription><strong>{target?.name}</strong> {deleted?'foi removido':'será removido'} do catálogo.{!deleted&&target?.kind==='product'&&!!target.flavors&&` Os ${target.flavors} sabores desta linha também serão excluídos.`} Os pedidos anteriores e seus valores {deleted?'foram':'serão'} preservados.</AlertDialogDescription>
   </AlertDialogHeader>
   {error&&<p className="error-box" role="alert">{error}</p>}
   <AlertDialogFooter>
    <AlertDialogCancel disabled={busy}>{deleted?'Fechar':'Cancelar'}</AlertDialogCancel>
    <AlertDialogAction className={deleted?'btn primary':'btn danger-solid'} disabled={busy} onClick={confirm}>
     {busy?<LoaderCircle size={16} className="spin"/>:deleted?<RefreshCw size={16}/>:<Trash2 size={16}/>}
     {busy?(deleted?'Atualizando…':'Excluindo…'):deleted?'Atualizar catálogo':'Excluir do catálogo'}
    </AlertDialogAction>
   </AlertDialogFooter>
  </AlertDialogContent>
 </AlertDialog>;
}
