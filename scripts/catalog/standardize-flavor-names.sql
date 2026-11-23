BEGIN;

UPDATE public.yp_flavors AS flavor
SET name = correction.new_name
FROM (VALUES
  ('4 LEITES', 'QUATRO LEITES'),
  ('ABACAXI C/ COCO', 'ABACAXI COM COCO'),
  ('ABACAXI C/ MENTA', 'ABACAXI COM MENTA'),
  ('AÇAI', 'AÇAÍ'),
  ('AÇAI C/ GUARANÁ', 'AÇAÍ COM GUARANÁ'),
  ('AÇAÍ C/ GUARANÁ', 'AÇAÍ COM GUARANÁ'),
  ('BANANA C/ CANELA', 'BANANA COM CANELA'),
  ('CHOCOLATE C/ MENTA', 'CHOCOLATE COM MENTA'),
  ('LIMÃO GALEGO', 'LIMÃO-GALEGO'),
  ('MAÇA VERDE', 'MAÇÃ VERDE'),
  ('MAMÃO PAPAYA', 'MAMÃO-PAPAIA'),
  ('MELÂNCIA', 'MELANCIA'),
  ('MELÃNCIA', 'MELANCIA'),
  ('MEXIRICA', 'MEXERICA'),
  ('MORANGO PLUS (C/ POLPA)', 'MORANGO PLUS (COM POLPA)'),
  ('NEUTRO (BASE S/ SABOR)', 'NEUTRO (BASE SEM SABOR)'),
  ('PASSAS AO RHUM', 'PASSAS AO RUM'),
  ('PÊRA', 'PERA'),
  ('PESSÊGO', 'PÊSSEGO'),
  ('TUTTI - FRUTTI', 'TUTTI-FRUTTI')
) AS correction(old_name, new_name)
WHERE flavor.name = correction.old_name;

UPDATE public.yp_upsell_rules AS rule
SET title = 'Complete com Chocolate'
FROM public.yp_flavors AS flavor
JOIN public.yp_products AS product ON product.id = flavor.product_id
WHERE rule.flavor_id = flavor.id AND rule.product_id = product.id
  AND product.name = 'Saborize · Saborizantes' AND flavor.name = 'CHOCOLATE'
  AND rule.title = 'Complete com Chocolate Suiço';

UPDATE public.yp_upsell_rules AS rule
SET description = correction.new_description
FROM public.yp_flavors AS flavor
JOIN public.yp_products AS product ON product.id = flavor.product_id
JOIN (VALUES
  ('Saborize · Saborizantes', 'CHOCOLATE',
   'A Base Neutra Saborize combina com os saborizantes da linha. Inclua Chocolate Suiço.',
   'A Base Neutra Saborize combina com os saborizantes da linha. Inclua Chocolate.'),
  ('Expresso Italiano', 'BAUNILHA CLASSIC',
   'Inclua Baunilha Classic Sorv/Milk junto do Chocolate Classic.',
   'Inclua Baunilha Classic junto do Chocolate Suíço Classic.'),
  ('Expresso Italiano', 'CHOCOLATE SUÍÇO CLASSIC',
   'Complete sua seleção com Chocolate Suíço Classic Sorv/Milk.',
   'Complete sua seleção com Chocolate Suíço Classic.')
) AS correction(product_name, flavor_name, old_description, new_description)
ON product.name = correction.product_name AND flavor.name = correction.flavor_name
WHERE rule.flavor_id = flavor.id AND rule.product_id = product.id
  AND rule.description = correction.old_description;

COMMIT;
