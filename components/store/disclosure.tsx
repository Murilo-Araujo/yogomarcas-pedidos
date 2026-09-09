'use client';
import type {ReactNode} from 'react';
import {ChevronDown} from 'lucide-react';
import {Collapsible,CollapsibleContent,CollapsibleTrigger} from '@/components/ui/collapsible';
export default function Disclosure({title,children,className=''}:{title:string;children:ReactNode;className?:string}){
 return <Collapsible className={`store-disclosure ${className}`}><CollapsibleTrigger type="button" className="disclosure-trigger">{title}<ChevronDown size={16}/></CollapsibleTrigger><CollapsibleContent className="disclosure-content">{children}</CollapsibleContent></Collapsible>;
}
