# Informações, novidades e reajustes do catálogo

## O que muda

- Produtos: modo de preparo, água e tempo opcionais, etapas, observações e até 12 informações adicionais. Disponível para produtos individuais e linhas com sabores. Rendimento continua compartilhado com a estimativa de lucro.
- Novidades: selecionar um produto/linha, texto opcional e duração em dias ou meses. O período começa ao salvar; o banner horizontal aparece acima dos produtos nos dois catálogos. Encerrar manualmente ou renovar salvando novamente. Itens ocultos/removidos não aparecem.
- Reajustes: percentual de aumento de 0,01% a 100%, para todo o catálogo ou produtos/linhas selecionados. Prévia obrigatória; aplicação imediata ou agendada no horário de Brasília. Inclui sabores e preços cadastrados de itens ocultos. Arredonda para cima em múltiplos de R$ 0,05, com fardo de 5 pacotes. Preços especiais de sugestões e pedidos históricos permanecem como registrados.
- Agendamentos usam os preços vigentes na execução. Histórico registra valores anteriores e novos; é possível cancelar antes da aplicação. Execução a cada minuto, mesmo com o navegador fechado.

## Publicação

Em 9 de outubro de 2026, o responsável autorizou explicitamente a publicação no repositório público `Murilo-Araujo/yogomarcas-pedidos`, a atualização do banco e a ativação do agendador. A migração foi aplicada no projeto existente e a Edge Function foi publicada como versão 13. Os hashes dos preços de produtos e sabores foram conferidos antes e depois: permaneceram iguais. As tabelas de novidades e reajustes foram criadas vazias.

Ordem de ativação usada:

1. Aplicar `supabase/migrations/20261009151216_catalog_management.sql` no projeto `tryqemvbdrvlrxcqthpp`. A migração preserva as instruções de preparo existentes e cria estruturas vazias de novidades/reajustes. Não cadastra um reajuste nem altera preços por percentual.
2. Publicar `supabase/functions/order-portal/index.ts` com `lib/retention.ts`, `lib/projection.ts`, `lib/delivery-address.ts`, `lib/catalog-management.ts` e o `deno.json` atual. Preservar `verify_jwt=false`, pois a função tem rotas públicas e autenticação administrativa explícita, com validação de sessão e permissões antes das novas ações.
3. Conferir resposta pública, rejeição de novas ações sem autenticação, permissões e execução de `yp-price-adjustments` no `pg_cron`. O job não modifica nada até um administrador cadastrar um reajuste.
4. Publicar a versão revisada no projeto Vercel existente `yogomarcas-pedidos`, preservando `pedidos.yogomarcas.com.br`.
5. Conferir os três fluxos no admin e ambos os catálogos. Não criar reajustes nem novidades reais durante a verificação sem solicitação.

Não publicar o frontend/Edge antes da migração: as novas ações dependem das tabelas e funções adicionadas.

## Validação

- Build Next.js de produção e TypeScript.
- 110 testes automatizados passaram, incluindo autenticação, validação, persistência de preparo/informações e apresentação nos dois catálogos.
- Testes de carrinho, pedidos e projeção de lucro existentes.
- Migração e `tests/catalog-management-db.sql` executados em PostgreSQL isolado via PGlite 0.5.8: prazos em meses/dias, arredondamento, sabores/fardos, idempotência, prévia desatualizada, agendamento, cancelamento, atomicidade, permissões e rollback.
- `pg_cron` instalado em produção, com `yp-price-adjustments` ativo a cada minuto e execução automática confirmada como `succeeded` em 09/10/2026 às 16:41 UTC. O agendador SQL também foi testado isoladamente.
- A conferência visual interativa ficou limitada pela indisponibilidade do Chromium neste ambiente (download retornou arquivo inválido). Renderização dos componentes foi validada nos testes; conferir desktop e celular antes da ativação final.

Comandos: `node --test tests/*.test.cjs`, `npx tsc --noEmit -p tsconfig.app.json`, `npx next build --webpack`.
