/** Money is always integer cents. Each portion is an alternative whole-stock scenario. */
export type SalePortion={id:string;name:string;grams:number;price:number};
export type YieldLine={quantity:number;units:number;unit_price:number;yield_grams:number|null;yield_min_grams:number|null};
export type Projection={portion:SalePortion;packets:number;base_cost:number;excluded_cost:number;grams_min:number;grams_max:number;servings_min:number;servings_max:number;revenue_min:number;revenue_max:number;surplus_min:number;surplus_max:number;margin_min:number|null;margin_max:number|null};
export function calculateProjection(lines:YieldLine[],portion:SalePortion):Projection|null{
 if(!Number.isSafeInteger(portion.grams)||portion.grams<=0||!Number.isSafeInteger(portion.price)||portion.price<=0)return null;
 if(lines.some(l=>!Number.isSafeInteger(l.quantity)||l.quantity<=0||!Number.isSafeInteger(l.unit_price)||l.unit_price<0||!Number.isSafeInteger(l.units)||l.units<=0))return null;
 const eligible=lines.filter(l=>Number.isSafeInteger(l.yield_grams)&&l.yield_grams!>0&&Number.isSafeInteger(l.yield_min_grams)&&l.yield_min_grams!>0&&l.yield_min_grams!<=l.yield_grams!&&Number.isSafeInteger(l.units)&&l.units>0&&Number.isSafeInteger(l.quantity)&&l.quantity>0&&Number.isSafeInteger(l.unit_price)&&l.unit_price>0);
 if(!eligible.length)return null;
 const packets=eligible.reduce((n,l)=>n+l.units,0);
 const base_cost=eligible.reduce((n,l)=>n+l.quantity*l.unit_price,0);
 const excluded_cost=lines.filter(l=>!eligible.includes(l)).reduce((n,l)=>n+l.quantity*l.unit_price,0);
 const grams_min=eligible.reduce((n,l)=>n+l.units*l.yield_min_grams!,0),grams_max=eligible.reduce((n,l)=>n+l.units*l.yield_grams!,0);
 const servings_min=Math.floor(grams_min/portion.grams),servings_max=Math.floor(grams_max/portion.grams);
 const revenue_min=servings_min*portion.price,revenue_max=servings_max*portion.price;
 if(![packets,base_cost,excluded_cost,grams_min,grams_max,servings_min,servings_max,revenue_min,revenue_max].every(Number.isSafeInteger))return null;
 const surplus_min=revenue_min-base_cost,surplus_max=revenue_max-base_cost;
 return {portion,packets,base_cost,excluded_cost,grams_min,grams_max,servings_min,servings_max,revenue_min,revenue_max,surplus_min,surplus_max,margin_min:revenue_min?surplus_min/revenue_min*100:null,margin_max:revenue_max?surplus_max/revenue_max*100:null};
}
