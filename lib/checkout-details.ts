import {STATES} from './portal';
import {EMPTY_DELIVERY_ADDRESS,normalizeDeliveryAddress,type DeliveryAddress} from './delivery-address';

export type CheckoutDetails=DeliveryAddress&{name:string;city:string;state:string};
export type SavedCheckoutDetails=CheckoutDetails&{order_id:string};
type CheckoutProfile={id:string;contact_name?:string;checkout_details?:SavedCheckoutDetails|null};
const prefix='yp-checkout-details-v1:';
const memory=new Map<string,string>();

function details(value:unknown):CheckoutDetails|null{
 if(!value||typeof value!=='object')return null;
 const v=value as Record<string,unknown>;
 if(typeof v.name!=='string'||v.name.length>200||typeof v.city!=='string'||v.city.length>200||typeof v.state!=='string'||!STATES.includes(v.state))return null;
 const address=normalizeDeliveryAddress(v);
 if(Object.values(address).some(value=>value.length>200))return null;
 return {name:v.name,city:v.city,state:v.state,...address};
}

/** Pending edits belong to one shop and the last order they were based on. */
export function readCheckoutDetails(profile:CheckoutProfile):CheckoutDetails{
 const saved=details(profile.checkout_details)||{name:profile.contact_name||'',city:'',state:'PR',...EMPTY_DELIVERY_ADDRESS};
 const key=prefix+profile.id;
 try{
  let raw=memory.get(key);
  try{raw=localStorage.getItem(key)||raw;}catch{}
  const draft=JSON.parse(raw||'null');
  if(draft?.customer_id===profile.id&&draft.order_id===(profile.checkout_details?.order_id||null)){
   const pending=details(draft.details);if(pending)return pending;
  }
 }catch{}
 return saved;
}

export function rememberCheckoutDetails(profile:CheckoutProfile,value:CheckoutDetails){
 const clean=details(value);if(!clean)return;
 const key=prefix+profile.id;
 const raw=JSON.stringify({customer_id:profile.id,order_id:profile.checkout_details?.order_id||null,details:clean});
 memory.set(key,raw);
 try{localStorage.setItem(key,raw);}catch{}
}

export function clearCheckoutDetails(customerId:string){
 const key=prefix+customerId;memory.delete(key);
 try{localStorage.removeItem(key);}catch{}
}
