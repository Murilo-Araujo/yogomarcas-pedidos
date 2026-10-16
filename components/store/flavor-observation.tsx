import {Info} from 'lucide-react';
import styles from './flavor-observation.module.css';

/** An optional customer-facing note, rendered only as plain text. */
export default function FlavorObservation({text}:{text?:string|null}){
 const note=text?.trim();
 if(!note)return null;
 return <div className={styles.note} role="note" aria-label="Observação do sabor">
  <Info size={16} aria-hidden="true"/>
  <div><strong>Observação do sabor</strong><p>{note}</p></div>
 </div>;
}
