export type DeliveryAddress={postal_code:string;street:string;number:string;neighborhood:string;complement:string;reference:string};
export const EMPTY_DELIVERY_ADDRESS:DeliveryAddress={postal_code:'',street:'',number:'',neighborhood:'',complement:'',reference:''};

export function formatPostalCode(value:string){
 return value.replace(/\D/g,'').slice(0,8).replace(/(\d{5})(\d)/,'$1-$2');
}

/** Keep only delivery fields, including incomplete drafts and legacy orders. */
export function normalizeDeliveryAddress(value:unknown):DeliveryAddress{
 const source=value&&typeof value==='object'?value as Record<string,unknown>:{};
 const address={...EMPTY_DELIVERY_ADDRESS};
 for(const key of Object.keys(address) as (keyof DeliveryAddress)[]){
  address[key]=typeof source[key]==='string'?source[key].trim().replace(/\s+/g,' '):'';
 }
 const postalCode=address.postal_code.replace(/[.\s-]/g,'');
 if(/^\d{8}$/.test(postalCode))address.postal_code=formatPostalCode(postalCode);
 return address;
}

export function deliveryAddressError(address:DeliveryAddress):string|null{
 if(!/^\d{5}-\d{3}$/.test(address.postal_code))return 'Informe um CEP com 8 dígitos.';
 if(address.street.length<2||address.street.length>200)return 'Informe a rua ou avenida do endereço de entrega.';
 if(!address.number||address.number.length>20)return 'Informe o número do endereço ou S/N se não houver número.';
 if(address.neighborhood.length<2||address.neighborhood.length>200)return 'Informe o bairro do endereço de entrega.';
 if(address.complement.length>200||address.reference.length>200)return 'Use até 200 caracteres no complemento e no ponto de referência.';
 return null;
}
