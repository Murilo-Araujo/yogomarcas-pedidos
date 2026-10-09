# Página de links da Yogomarcas

A página pública está em `/links`. No admin, a aba **Links** permite editar perfil,
logo, textos, cores, rodapé e até 50 links. Cada link tem título, endereço, descrição,
ícone, imagem, etiqueta, formato (botão, destaque ou ícone social), visibilidade e
datas opcionais de início e término. A ordem dos ícones sociais é independente da
lista de cartões: ambos respeitam a ordem relativa definida no editor.

A prévia mostra a edição atual; **Salvar e publicar** aplica as mudanças de uma vez.
O editor preserva o rascunho ao alternar abas e avisa antes de fechar a janela.
Se outra pessoa publicar primeiro, a versão antiga é recusada para evitar perda de
alterações. Recarregue a versão publicada antes de repetir sua edição.

As datas são exibidas no fuso do dispositivo de quem edita e gravadas em UTC.
O servidor só entrega links visíveis no momento da consulta. A página atualiza os
links a cada minuto e ao voltar à aba; um link expirado some da página já aberta.
Ocultar um link sempre prevalece sobre o agendamento. Alterações exigem a mesma
sessão administrativa do catálogo, com senha definitiva e acesso ativo.

O resumo considera os últimos 30 dias no fuso America/Sao_Paulo. São contagens de
visitas e cliques, não visitantes únicos; não são guardados identificadores de
visitantes nessas métricas. O contador agrega atomicamente por dia e por link e
possui limitação de requisições no servidor. Prévia não registra métricas.

## Domínio próprio

O endereço informado foi `link.yogomarkets.com.br`. O código já encaminha a raiz
desse host para `/links`, preservando as rotas atuais do portal de pedidos.

Para ativar, confirme a grafia do domínio e adicione-o ao projeto Vercel
`yogomarcas-pedidos`. Use o registro DNS informado pela Vercel e aguarde a validação
do domínio e do certificado. Depois abra a raiz e confirme a página de links.
Por último, no admin, em **Endereço para compartilhamento**, salve a URL definitiva.
O botão de compartilhar, o QR Code e os metadados usarão esse endereço.
Enquanto o campo estiver vazio, compartilhamento e QR Code usam o endereço visitado.
Esta implementação não altera DNS nem registra um domínio.

## Banco e implantação

Aplicar `supabase/migrations/20261009175127_link_hub.sql`, depois publicar a Edge
Function `order-portal` com `lib/link-hub.ts` entre as dependências relativas e
implantar o Next.js. A migração só cria tabelas e funções novas e os links iniciais.
Não altera preços, produtos, clientes, pedidos ou configurações existentes.

`yp_link_hub` armazena a configuração e a versão; `yp_link_hub_daily` guarda os
contadores. Ambas têm RLS e acesso direto revogado para anon/authenticated. Apenas
o backend com service role acessa os dados; todas as ações de edição passam pela
autenticação administrativa explícita. Funções SQL usam security invoker.
Não incluir credenciais administrativas ou service role no navegador.

Validação: `npm run typecheck`, `node --test tests/*.test.cjs` e
`npm run build:vercel`. O roteiro SQL `tests/link-hub-db.sql` é para um Postgres
isolado, após aplicar somente a migração e criar os papéis padrão do Supabase.
