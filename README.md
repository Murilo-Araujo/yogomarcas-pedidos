# Yogomarcas · Portal de pedidos

Catálogo B2B em português, com carrinho local, finalização no WhatsApp e administração protegida pelo Supabase Auth.

## Catálogo público

`https://pedidos.yogomarcas.com.br/catalogo` apresenta as linhas, fotos, descrições, pesos e sabores ativos sem cadastro, preços ou carrinho. A busca por linha/sabor e os filtros funcionam sem sessão e não leem nem gravam dados da loja no navegador. O logotipo e a recuperação de erros mantêm o visitante em `/catalogo`.

A página consulta o catálogo vigente no servidor a cada visita e envia ao navegador apenas os campos permitidos por `lib/public-catalog.ts`. Preços, ofertas, configurações comerciais e códigos internos não entram no HTML nem nos dados serializados da página. Linhas/produtos/sabores ocultos ficam de fora; itens ativos temporariamente indisponíveis permanecem identificados. Alterações no cadastro aparecem na próxima visita, sem republicação. A rota exige o runtime Next.js da Vercel e não é compatível com exportação estática.

Verificação: `node --test tests/public-catalog.test.cjs`, `npm run typecheck` e `npm run build:vercel`.

## Operação

1. Abra o link privado de ativação entregue ao responsável e crie o primeiro acesso. O token é de uso único, expira e nunca é incluído no código.
2. Em **Produtos**, confira as linhas, os produtos, os preços por pacote, a quantidade de pacotes por fardo e o preço total do fardo. A composição do fardo é independente por produto.
3. Envie as fotos, configure disponibilidade e ordem. Um produto sem preço não pode ser adicionado. Ocultar linhas/produtos preserva o histórico.
4. Configure opcionalmente a sugestão no carrinho. Ela só pode ser incluída com outro item, uma unidade por pedido, e nunca entra automaticamente.
5. Em **Configurações**, confira o WhatsApp e ative o recebimento de pedidos. O catálogo inicia pausado porque a documentação fornecida não contém preços nem composições dos fardos.
6. Em **Pedidos**, marque o atendimento e confirme vendas efetivas. **Resultados** separa valores solicitados e confirmados, inclui produtos com zero pedidos e exporta CSV.

O envio da mensagem depende do clique do cliente no WhatsApp. A aplicação registra a preparação do pedido, não confirma entrega de mensagens ou pagamento. Frete não compõe o subtotal.

## Arquitetura

- Next.js 16 / React 19; visual e componentes acessíveis do starter Sites.
- `components/store/storefront.tsx`: catálogo, detalhes, carrinho, dados e abertura do WhatsApp.
- `components/store/admin.tsx`: autenticação, produtos/fotos/linhas, configuração, equipe, pedidos e métricas.
- `lib/portal.ts`: cliente da API, sessões, carrinho, eventos e exportação CSV.
- `supabase/functions/order-portal`: API pública e administração autorizada em cada chamada.
- `supabase/schema/order_portal.sql`: histórico consolidado das migrações aplicadas, sem credenciais ou token de ativação.
- Supabase: projeto existente da Yogomarcas, tabelas isoladas com prefixo `yp_`. A tabela da landing page não foi alterada.
- Storage: bucket público `yp-products` para fotos; gravação só pela API administrativa.

O navegador recebe apenas a chave publicável. A chave de serviço existe exclusivamente no runtime da Edge Function. Tabelas e RPCs do portal não têm acesso direto para `anon` ou `authenticated`. Não adicionar políticas abertas para suprimir avisos informativos de RLS sem políticas: essa restrição é intencional.

Pedidos usam valores inteiros em centavos, validação no servidor, identificador idempotente e segredo de retomada. Itens são gravados como snapshot junto ao pedido. Total, composição do fardo e elegibilidade da sugestão são validados no backend. Logs não contêm dados pessoais nem senhas.

## Desenvolvimento e implantação

- `npm run typecheck`: checagem dos componentes e cliente.
- `npm run build`: build Sites/Vinext, preservado do starter.
- `npm run build:vercel`: build Next.js para Vercel.
- `YOGO_STATIC_EXPORT=1 npm run build:vercel`: exportação estática para inspeção das páginas.
- `vercel.json`: configuração do build Vercel. Nenhuma variável secreta é necessária no frontend.
- Sites: identidade e fluxo de versionamento em `.openai/hosting.json`.

Alterações na função devem ser publicadas no mesmo projeto Supabase, com `verify_jwt=false`: catálogo/eventos/pedidos são públicos e as rotas administrativas validam usuário e associação explicitamente. O serviço protege chamadas públicas por limites persistentes.

Não inclua arquivos de teste com tokens, credenciais de sessão, senhas ou links de ativação em Git. O cadastro inicial e o gerenciamento de equipe não enviam e-mail automaticamente.

## Fontes do catálogo

Dados de empresa/portfólio/identidade: seis arquivos de referência fornecidos pelo usuário nesta conversa. Preços e composição de fardos não constam nesses documentos.

Logotipo: `https://yogomarcas-google-ads.vercel.app/yogomarcas-logo.png`.
Embalagem genérica da linha: `https://www.yogomarcas.com.br/assets/pacote_mobile-97b24810ebbecc7c8f2bd6d780572844d0d79fa8d6fd66a7bb8ab38c16a776fa.webp`.

A foto é da embalagem compartilhada da linha; não é apresentada como embalagem específica de cada sabor. O lubrificante aguarda foto própria no cadastro.


## Shop profiles and projections

Customer profiles are keyed by normalized Brazilian phone number. First registration asks for shop name, a six-digit PIN and selling formats with serving weights and retail prices in cents. A random 256-bit device credential and phone are remembered in versioned localStorage (`yp-shop-v1`) without an application expiry; browser clearing/private mode can remove them. Supabase stores only the device token hash and PBKDF2 PIN hash. Another device needs phone plus PIN. Admin PIN recovery revokes all remembered devices atomically. Phone numbers are self-declared, not verified by SMS.

Apply `supabase/schema/customer_profiles.sql` after the original schema for a fresh installation. Edge deployment must include `lib/projection.ts` as a relative dependency. All customer tables and RPCs are denied to anon/authenticated roles and accessed through the Edge function's explicit authorization. Admin-only customer directory includes profile details, price averages and CSV export.

The customer-provided baseline is 5,500–6,000 usable grams per base packet. Product administration can change these yields. Fardos multiply by equivalent packets once. Each selling format is a separate whole-inventory scenario: floor(total usable grams / serving grams), times selling price, minus actual base cost. Other cart items and all operating/packaging costs are excluded and disclosed. Negative results remain negative; no completed servings means undefined margin. Orders save a server-calculated snapshot using authenticated profile data and canonical catalog prices. Profile version checks reject stale estimates; idempotent order reads also require a valid device belonging to the same shop.

Regression checks: `node --test tests/*.test.cjs`. The Edge handler suite replaces only its HTTP dependencies with an in-memory fixture; it never creates live orders or changes production ordering settings.

## Recompra e acompanhamento comercial

- **Minha loja → Meus pedidos:** histórico privado, paginado. Repetir atualiza o catálogo, informa itens indisponíveis e mudanças de preço/apresentação, remove descontos antigos e soma ao carrinho apenas após revisão.
- **Favoritos:** preferências por loja, ordenadas primeiro dentro de cada linha. Disponibilidade e quantidades continuam independentes.
- **Carrinhos:** sincronização autenticada com revisão e controle de concorrência. Alterações locais ainda não sincronizadas permanecem recuperáveis. A criação do pedido verifica e fecha a revisão em uma transação; tentativas antigas não reabrem um carrinho preparado.
- **Administração → Oportunidades:** carrinhos sem alteração por 2 horas, arquivamento por revisão, recompra vencida e frequência editável (1–365 dias). Sem frequência manual, usa a mediana dos intervalos das últimas 6 datas de compra, exigindo pelo menos 3 datas. Apenas compras confirmadas/concluídas entram na previsão. Anotações não alteram a data de compra. Pedidos preparados/em atendimento nos últimos 7 dias suspendem o alerta de recompra; a equipe pode adiar por mais 7 dias.
- **Sugestão no carrinho:** regras de produto de origem → complemento específico, prioridade e preço especial opcional. Uma sugestão elegível por vez; sugestão geral como alternativa. A regra inicial associa Saborize Saborizantes à Base neutra Saborize, pelo preço vigente.

`supabase/schema/customer_retention.sql` contém o esquema aplicado e as funções. Novas tabelas mantêm RLS e acesso direto bloqueado para `anon`/`authenticated`; a Edge Function autentica o aparelho ou administrador antes de usar credenciais de serviço. Os avisos informativos de RLS sem políticas refletem esse bloqueio deliberado.

Verificação: `npm run typecheck`, `npm run build:vercel` e `node --test tests/projection.test.cjs tests/cart-flavors.test.cjs tests/order-projection.test.cjs tests/retention.test.cjs`. `tests/retention-db.sql` verifica as transações, a frequência e as permissões com fixtures totalmente revertidas por `ROLLBACK`.

## Fardos, códigos internos e equipe

- **Produtos → Editar → Preço e rendimento → Permitir compra por fardo** controla a venda por fardo de cada produto, incluindo todos os seus sabores. Desativado, os clientes compram apenas por pacote/unidade; novos pedidos e a sincronização do carrinho validam essa regra no servidor.
- Carrinhos antigos mostram os fardos bloqueados para remoção ou conversão explícita em pacotes, somando quantidades existentes. Repetir pedido informa os fardos indisponíveis; pedidos já salvos conservam seus valores e quantidades.
- Aplicar `supabase/schema/product_bundle_availability.sql` antes da atualização da Edge Function. A coluna tem padrão `true`, mantendo todos os produtos existentes habilitados. Salvamentos de versões antigas que omitam a opção preservam a configuração atual.
- Cada fardo contém **5 pacotes do mesmo sabor**. Preço do fardo = preço do pacote × 5, calculado na API e mantido por triggers no banco.
- Os contadores de fardos e pacotes ficam juntos por sabor. O carrinho conserva as apresentações separadamente para permitir edição, mas soma os pacotes equivalentes na projeção e na mensagem do WhatsApp.
- A mensagem agrupa cada sabor pelo código interno salvo no pedido. Edições futuras do catálogo não alteram códigos, preços ou quantidades históricos.
- `yp_flavors.sku` recebe códigos iniciais únicos por linha (ex.: `YOGO-EI-001`). São códigos do portal, editáveis em **Produtos → Sabores**; não representam uma importação de códigos ERP. O código da linha/produto continua em `yp_products.sku`.
- Administração usa login e senha. E-mails técnicos aleatórios existem apenas internamente no Supabase Auth; nenhum endereço é solicitado à equipe e nenhum convite é enviado.
- O responsável cadastra, redefine senhas e desativa acessos na aba **Equipe**. Todos podem alterar a própria senha em **Configurações**. O primeiro acesso do responsável exige substituir a senha inicial.
- Toda chamada administrativa exige associação ativa e uma sessão válida no banco. Alterações de senha e desativações invalidam sessões anteriores, inclusive tokens renovados a partir delas.
- Migração: `supabase/schema/bundles_codes_admin.sql`. Aplicar depois de `customer_retention.sql` e antes da atualização da Edge Function.
- Verificação: `npm run typecheck` e `node --test tests/*.test.cjs`. Os testes de pedidos usam HTTP e banco isolados, sem criar pedidos reais.

## Edição e exclusão do catálogo

Os editores de produtos e sabores usam campos identificados, blocos de informação e rodapé de ações separado da área de rolagem. A edição de sabor substitui temporariamente a lista para deixar o formulário visível imediatamente.

A ação **Excluir** exige confirmação com o nome do item. Excluir um produto também exclui seus sabores; pedidos, valores e métricas históricos permanecem disponíveis. Os registros são marcados com `deleted_at`, removidos do catálogo e dos editores, e ficam indisponíveis para novos pedidos. Favoritos relacionados são removidos e sugestões afetadas são desativadas. Carrinhos existentes permanecem intactos para o cliente revisar os itens indisponíveis.

A migração `supabase/schema/catalog_deletion.sql` deve ser aplicada após `bundles_codes_admin.sql`. Ela adiciona a RPC transacional de exclusão, proteção contra edição de itens excluídos e índices parciais para permitir reutilizar nomes e códigos de cadastros incorretos. Registros excluídos com atividade aparecem identificados nas métricas do período.

Verificação da exclusão: testes HTTP isolados em `tests/admin-access.test.cjs` e `tests/order-projection.test.cjs`, além de `tests/catalog-deletion-db.sql`, cujos dados de teste são integralmente desfeitos por rollback.
