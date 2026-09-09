"""Generate a deterministic, one-time import from reviewed source prices; never compound."""
import json
from pathlib import Path
from decimal import Decimal, ROUND_HALF_UP
root=Path(__file__).resolve().parents[2]
data=json.loads((root/'docs/catalog/prices-2026-09-05.json').read_text())
quote=lambda v:"'"+str(v).replace("'","''")+"'"
families={
 'Expresso Italiano':('YOGO-EI','Expresso Italiano','Mix em pó para sorvete expresso. Escolha os sabores para sua operação. Preparo com 4 litros de água por pacote.',0,6000),
 'Frozen Yogurt':('YOGO-FY','Frozen Yogurt','Mix para frozen yogurt. Escolha os sabores. Preparo com 3 litros de água por pacote.',1,None),
 'Iogurte Grego':('YOGO-IG','Iogurte Grego','Mix de iogurte grego, com textura encorpada. Preparo com 4 litros de água por pacote.',2,6000),
 'Linha Saborize':('YOGO-SAB','Saborize · Saborizantes','Saborizantes em pó de 500 g para combinar com a base neutra, vendida separadamente. Dosagem ajustável ao preparo.',3,None)
}
print({r['line'] for r in data['rows']})
# Source uses Linha Saborize or Saborize; accept the reviewed label only.
sabor_label=next(k for k in {r['line'] for r in data['rows']} if 'Saborize' in k)
families[sabor_label]=families.pop('Linha Saborize')
sql=['-- Prices supplied by the owner. Original BRL x 1.045, HALF_UP to cents.\n-- Absolute upserts make re-runs non-compounding. No customer or order rows changed.']
for source,(sku,name,description,pos,yield_g) in families.items():
 category='Linha Saborize' if 'Saborize' in source else source
 sql.append(f"insert into public.yp_lines(name,description,position,active) values ({quote(category)},'',{pos},true) on conflict(name) do update set position=excluded.position,active=true;")
 sql.append(f"insert into public.yp_products(line_id,sku,name,description,position,has_flavors,image_url,yield_grams,yield_min_grams) select id,{quote(sku)},{quote(name)},{quote(description)},{pos},true,'/assets/mix.webp',{yield_g or 'null'},{5500 if yield_g else 'null'} from public.yp_lines where name={quote(category)} on conflict(sku) do update set line_id=excluded.line_id,name=excluded.name,description=excluded.description,position=excluded.position,has_flavors=true,active=true,available=true,updated_at=now();")
for index,r in enumerate(data['rows']):
 assert r['visual_verified'],r
 expected=int((Decimal(r['price_original_brl'])*Decimal('1.045')).quantize(Decimal('.01'),rounding=ROUND_HALF_UP)*100)
 assert expected==r['price_adjusted_cents']
 sku=families[r['line']][0]
 weight=Decimal(r['weight_value'])
 # kg in three mix tables; explicit g for the 500g powders.
 grams=int(weight if r['weight_unit_explicit']=='g' else weight*1000)
 if 'Saborize' in r['line'] and 'BASE NEUTRA' in r['flavor']:
  sql.append(f"insert into public.yp_products(line_id,sku,name,description,position,image_url,package_weight_grams,package_price,yield_grams,yield_min_grams) select id,'YOGO-SAB-BASE','Saborize · Base neutra','Base sem sabor para combinar com os saborizantes Saborize. Pacote de 1.650 g. Preparo com 4 litros de água.',4,'/assets/mix.webp',{grams},{expected},6000,5500 from public.yp_lines where name='Linha Saborize' on conflict(sku) do update set package_price=excluded.package_price,package_weight_grams=excluded.package_weight_grams,active=true,available=true,updated_at=now();")
 else:
  sql.append(f"insert into public.yp_flavors(product_id,name,package_weight_grams,package_price,position) select id,{quote(r['flavor'])},{grams},{expected},{index} from public.yp_products where sku={quote(sku)} on conflict(product_id,name) do update set package_weight_grams=excluded.package_weight_grams,package_price=excluded.package_price,position=excluded.position,updated_at=now();")
sql.extend(["update public.yp_products set active=false,updated_at=now() where sku in ('BAU','CHO','NEU','GRE');", "update public.yp_lines set active=false where name in ('Sorvete soft','Iogurte grego');", "update public.yp_lines set position=5 where name='Apoio à operação';"])
(root/'supabase/schema/catalog_prices_20260905.sql').write_text('\n'.join(sql)+'\n')
print('Generated',len(data['rows']),'prices')
