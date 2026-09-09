"""Read-only comparison of the public API against the reviewed price manifest."""
import json,re,urllib.request
from pathlib import Path
root=Path(__file__).resolve().parents[2]
config=(root/'lib/config.ts').read_text()
base=re.search(r'SUPABASE_URL = "([^"]+)"',config)[1]
key=re.search(r'SUPABASE_KEY = "([^"]+)"',config)[1]
req=urllib.request.Request(base+'/functions/v1/order-portal',headers={'apikey':key})
with urllib.request.urlopen(req,timeout=30) as res: catalog=json.load(res)
source=json.loads((root/'docs/catalog/prices-2026-09-05.json').read_text())
skus={'Expresso Italiano':'YOGO-EI','Frozen Yogurt':'YOGO-FY','Iogurte Grego':'YOGO-IG','Linha Saborize':'YOGO-SAB'}
products={p['sku']:p for p in catalog['products']}
assert len(catalog['flavors'])==150
for r in source['rows']:
 if r['line']=='Linha Saborize' and 'BASE NEUTRA' in r['flavor']:
  item=products['YOGO-SAB-BASE']
 else:
  parent=products[skus[r['line']]]
  matches=[f for f in catalog['flavors'] if f['product_id']==parent['id'] and f['name']==r['flavor']]
  assert len(matches)==1,(r['line'],r['flavor'])
  item=matches[0]
 assert item['package_price']==r['price_adjusted_cents'],r
 assert item['bundle_price'] is None
print(json.dumps({'matched_prices':151,'flavors':len(catalog['flavors']),'ordering_enabled':catalog['settings']['ordering_enabled'],'checks':'price, flavor identity, bundle not invented'},ensure_ascii=False))
