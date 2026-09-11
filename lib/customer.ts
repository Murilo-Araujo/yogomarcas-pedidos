import {api,PortalError} from './portal';
import type {SalePortion} from './projection';
import type {SavedCheckoutDetails} from './checkout-details';
export type CustomerProfile={id:string;phone:string;store_name:string;contact_name:string;checkout_details?:SavedCheckoutDetails|null;portions:SalePortion[];preferred_portion_id:string|null;created_at:string;updated_at:string};
export type DeviceIdentity={version:1;phone:string;token:string};
const STORAGE_KEY='yp-shop-v1';let memoryIdentity:DeviceIdentity|null=null;
export function normalizePhone(value:string){let n=value.replace(/\D/g,'');if(n.length===10||n.length===11)n='55'+n;return /^55[1-9]\d{9,10}$/.test(n)?n:null;}
export function readIdentity():DeviceIdentity|null{if(memoryIdentity)return memoryIdentity;try{const v=JSON.parse(localStorage.getItem(STORAGE_KEY)||'null');if(v?.version===1&&typeof v.phone==='string'&&normalizePhone(v.phone)&&typeof v.token==='string'&&/^[0-9a-f]{64}$/.test(v.token))return memoryIdentity=v;}catch{}return null;}
export function saveIdentity(phone:string,token:string){memoryIdentity={version:1,phone,token};try{localStorage.setItem(STORAGE_KEY,JSON.stringify(memoryIdentity));return true;}catch{return false;}}
export function forgetIdentity(){memoryIdentity=null;try{localStorage.removeItem(STORAGE_KEY);}catch{}}
export function newDeviceToken(){return [...crypto.getRandomValues(new Uint8Array(32))].map(v=>v.toString(16).padStart(2,'0')).join('');}
export async function restoreCustomer():Promise<CustomerProfile|null>{const identity=readIdentity();if(!identity)return null;try{return (await api('customer_restore',{device_token:identity.token})).profile;}catch(e){if(e instanceof PortalError&&(e.status===401||e.status===403)){forgetIdentity();return null;}throw e;}}
export async function customerApi(action:string,data:Record<string,unknown>={}){const identity=readIdentity();return api(action,{...data,device_token:identity?.token});}
// Editable starting suggestions for unsaved formats, not measured shop portions.
export const PORTION_OPTIONS=[
 {id:'small_cone',name:'Casquinha pequena',grams:100},
 {id:'medium_cone',name:'Cascão médio',grams:150},
 {id:'large_cone',name:'Cascão grande',grams:200},
 {id:'small_cup',name:'Pote pequeno',grams:150},
 {id:'medium_cup',name:'Pote médio',grams:250},
 {id:'large_cup',name:'Pote grande',grams:400},
];
