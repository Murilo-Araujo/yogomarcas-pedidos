-- Current catalogue combinations. Prices remain the live catalogue prices.
-- Run after flavor_upsells.sql and both application deployments.
-- Idempotent: existing combinations and their edited copy/prices are preserved.
with desired(trigger_sku,trigger_flavor,target_sku,target_flavor,title,description,priority) as (values
 ('YOGO-EI','CHOCOLATE SUÍÇO','YOGO-EI','BAUNILHA','Chocolate combina com baunilha','Inclua Baunilha do Expresso Italiano na sua seleção de sabores.',10),
 ('YOGO-EI','BAUNILHA','YOGO-EI','CHOCOLATE SUÍÇO','Que tal completar com chocolate?','Adicione Chocolate Suíço do Expresso Italiano ao seu pedido.',10),
 ('YOGO-EI','CHOCOLATE SUÍÇO. CLASSIC SORV/MILK','YOGO-EI','BAUNILHA CLASSIC SORV/MILK','Complete a dupla Classic','Inclua Baunilha Classic Sorv/Milk junto do Chocolate Classic.',10),
 ('YOGO-EI','BAUNILHA CLASSIC SORV/MILK','YOGO-EI','CHOCOLATE SUÍÇO. CLASSIC SORV/MILK','Mais um sabor da linha Classic','Complete sua seleção com Chocolate Suíço Classic Sorv/Milk.',10),
 ('YOGO-EI','MORANGO','YOGO-EI','BAUNILHA','Mais uma opção para o seu cardápio','Inclua Baunilha do Expresso Italiano junto do Morango.',20),
 ('YOGO-SAB','CHOCOLATE SUIÇO','YOGO-SAB','BAUNILHA','Chocolate e baunilha na sua seleção','Adicione o saborizante Baunilha. A base neutra é vendida separadamente.',10),
 ('YOGO-SAB','BAUNILHA','YOGO-SAB','CHOCOLATE SUIÇO','Complete com Chocolate Suiço','Mais uma opção de saborizante para usar com a Base Neutra Saborize.',10),
 ('YOGO-IG','NATURAL TRADICIONAL','YOGO-IG','FRUTAS VERMELHAS','Uma opção de grego com frutas','Inclua Frutas Vermelhas junto do Natural Tradicional.',20),
 ('YOGO-IG','NATURAL AZEDINHO','YOGO-IG','MORANGO','Amplie sua seleção de iogurte grego','Adicione o sabor Morango à sua seleção desta linha.',20),
 ('YOGO-IG','MORANGO','YOGO-IG','NATURAL TRADICIONAL','Inclua também o grego tradicional','Complete os sabores do pedido com Natural Tradicional.',20),
 ('YOGO-FY','NATURAL TRADICIONAL (002)','YOGO-FY','MORANGO CHAMBY','Mais um sabor de frozen yogurt','Complete sua seleção com Morango Chamby.',20),
 ('YOGO-FY','NATURAL SUAVE (003)','YOGO-FY','MORANGO PLUS (C/ POLPA)','Que tal incluir morango?','Adicione Morango Plus com Polpa à seleção de Frozen Yogurt.',20),
 ('YOGO-FY','NATURAL AZEDINHO (004)','YOGO-FY','MORANGO CHAMBY','Uma opção de frozen com morango','Inclua Morango Chamby junto do Natural Azedinho.',20),
 ('YOGO-FY','MORANGO CHAMBY','YOGO-FY','NATURAL TRADICIONAL (002)','Complete com frozen tradicional','Inclua Natural Tradicional na sua seleção de Frozen Yogurt.',20),
 ('YOGO-SAB-BASE',null,'YOGO-SAB','CHOCOLATE SUIÇO','Já escolheu o sabor da sua base?','A Base Neutra Saborize combina com os saborizantes da linha. Inclua Chocolate Suiço.',20),
 ('YOGO-SAB-BASE',null,'YOGO-SAB','MORANGO','Outra opção para sua Base Neutra','Inclua o saborizante Morango da linha Saborize.',30),
 ('YOGO-EI',null,'LUB',null,'Confira os itens de apoio à máquina','Aproveite o pedido para repor o lubrificante alimentício, se precisar.',80),
 ('YOGO-FY',null,'LUB',null,'Precisa repor o lubrificante?','Inclua o lubrificante alimentício junto dos produtos para sua operação.',80),
 ('YOGO-IG',null,'LUB',null,'Complete os itens da sua operação','Se precisar repor, adicione o lubrificante alimentício ao pedido.',80),
 ('YOGO-SAB-BASE',null,'LUB',null,'Apoio à operação no mesmo pedido','Confira se precisa incluir o lubrificante alimentício na reposição.',80)
), resolved as (
 select d.*,t.id as trigger_product_id,tf.id as trigger_flavor_id,p.id as product_id,f.id as flavor_id
 from desired d
 join public.yp_products t on t.sku=d.trigger_sku and t.active and t.available and t.deleted_at is null
 join public.yp_products p on p.sku=d.target_sku and p.active and p.available and p.deleted_at is null
 left join public.yp_flavors tf on tf.product_id=t.id and tf.name=d.trigger_flavor and tf.active and tf.available and tf.deleted_at is null
 left join public.yp_flavors f on f.product_id=p.id and f.name=d.target_flavor and f.active and f.available and f.deleted_at is null
 where (d.trigger_flavor is null or tf.id is not null) and (d.target_flavor is null or f.id is not null)
)
insert into public.yp_upsell_rules(trigger_product_id,trigger_flavor_id,product_id,flavor_id,title,description,price,priority,active)
select r.trigger_product_id,r.trigger_flavor_id,r.product_id,r.flavor_id,r.title,r.description,null,r.priority,true
from resolved r where not exists (
 select 1 from public.yp_upsell_rules old
 where old.trigger_product_id=r.trigger_product_id and old.trigger_flavor_id is not distinct from r.trigger_flavor_id
 and old.product_id=r.product_id and old.flavor_id is not distinct from r.flavor_id
);
