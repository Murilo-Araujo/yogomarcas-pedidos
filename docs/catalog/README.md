# Catálogo por linhas — 05/09/2026

Importação solicitada pelo responsável, a partir dos quatro PDFs comerciais anexados. O catálogo institucional foi inspecionado visualmente; não contém preços ou composição de fardos.

- Expresso Italiano: 69 sabores/opções.
- Frozen Yogurt: 20 sabores.
- Iogurte Grego: 18 sabores.
- Saborize: 43 saborizantes de 500 g e uma base neutra separada.
- 151 preços: original × 1,045, arredondado em decimal HALF_UP para centavos, uma única vez.
- Base neutra Expresso: R$ 50,94. Base neutra Saborize: R$ 50,16. Registros distintos.
- Os três primeiros PDFs não explicitam unidade no cabeçalho PESO; os valores foram interpretados em kg, coerentes com a tabela Saborize e o preparo. PREÇO foi usado por pacote conforme o fluxo pedido pelo responsável.
- Fardos permanecem sem preço/composição. Não foi criado desconto nem quantidade de pacotes presumida.
- Fotos, descrição e rendimento ficam no cadastro da linha/produto; sabores possuem peso, preço e disponibilidade próprios.
- A faixa estimativa preexistente de 5,5–6 kg por pacote foi mantida nas bases Expresso, Grego e neutra. Não representa rendimento medido de cada sabor. É configurável no administrador.
- Frozen usa 3 L de água no catálogo e fica sem previsão até o cadastro de seu rendimento. Saborizantes não geram porções sozinhos e ficam fora da projeção.
- Carrinho e pedidos usam produto + sabor + apresentação. Pedidos armazenam nomes, pesos e valores históricos. Upsell exige sabor específico quando aplicável.
- Métricas por linha contam pedidos distintos; por sabor permitem ranking por pedidos, cliques na seleção, adições e unidades. Preparar mensagem de WhatsApp continua sendo intenção de compra, não venda confirmada.

## Arquivos e verificação

`prices-2026-09-05.json` guarda os preços originais, reajustados, páginas, revisão visual e hipóteses. `scripts/catalog/import-catalog.py` gera `supabase/schema/catalog_prices_20260905.sql` usando valores absolutos, sem reajuste cumulativo.

Migrações, nesta ordem: `catalog_flavors.sql`, `catalog_prices_20260905.sql`, `catalog_flavors_metrics.sql`. O segundo arquivo contém apenas dados comerciais. O script não altera clientes, pedidos, contas nem liberação de pedidos.

Verificação realizada: TypeScript, builds Next.js e Sites, 28 testes isolados de cálculo/carrinho/servidor; comparação pública de 151/151 preços via `scripts/catalog/verify-live.py`. Nenhum pedido de teste foi criado em produção. RLS ativo; acesso direto à tabela de sabores negado aos clientes anônimos e autenticados, administração autorizada na Edge Function.
