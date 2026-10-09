# Página de links da Yogomarcas

A página pública está em `/links`. No admin, a aba **Links** permite editar perfil,
logo, textos, cores, rodapé e até 50 links. Cada link tem título, endereço, descrição,
ícone, imagem, etiqueta, formato (botão, destaque ou ícone social), visibilidade e
datas opcionais de início e término. A ordem dos ícones sociais é independente da
lista de cartões: ambos respeitam a ordem relativa definida no editor.

O perfil aceita a imagem no formato original (sem corte), redondo ou quadrado com
cantos arredondados. O fundo branco é opcional e acompanha o formato escolhido.
Para exibir apenas a marca sem fundo, use PNG ou WebP transparente e desative o
fundo branco. O nome pode ser mostrado ou ocultado abaixo da imagem, permitindo
usar um símbolo redondo no topo e o nome da empresa separado. Por padrão, imagens
mantêm o formato original, sem fundo acrescentado, e o nome fica visível.
WhatsApp e Instagram usam seus ícones de marca em todos os botões e na prévia.

Em cada link, **Escolher ícone** abre a biblioteca completa Tabler Icons, com busca
por nome, prévia, filtros de contorno/preenchido e paginação. Os nomes oficiais são
em inglês; palavras comuns como “sorvete”, “telefone” e “coração” também funcionam.
Clicar em um ícone atualiza o rascunho e a prévia. Fechar sem selecionar não altera
o link; **Salvar e publicar** confirma a escolha junto das demais alterações.
O modal adapta a grade ao celular e permite navegar por teclado.

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
Function `order-portal` com `lib/link-hub.ts`, `lib/tabler-icons.ts` e
`lib/tabler-icon-names.ts` entre as dependências relativas e
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

## Biblioteca de ícones

`@tabler/icons` está fixada em 3.49.0 (6.238 ícones, licença MIT). Os hooks de build
executam `npm run icons:prepare`, que copia os SVGs oficiais e sua licença para
`public/vendor/tabler/<versão>/`. Esses arquivos são gerados, ignorados no Git e
servidos localmente com cache imutável. O navegador baixa somente os SVGs exibidos;
o modal carrega sob demanda e mostra 60 opções por página.

O catálogo permitido é versionado em `lib/tabler-icon-names.ts` e compartilhado
com a API, para rejeitar nomes inexistentes e caminhos arbitrários. Os valores
antigos (`whatsapp`, `instagram` etc.) continuam aceitos, mapeados para Tabler.
Ao atualizar a dependência, execute `npm run icons:update`, revise e versione o
catálogo gerado; publique a API com as dependências acima antes do frontend.
As opções de aparência vivem no JSON existente e não exigem migração. Edições
vindas de uma aba antiga preservam as opções de perfil ausentes no envio.
