# Auditoria dos quatro PDFs — 10/09/2026

Fonte definitiva para os 149 itens desta revisão: `expected.json`. Valores são centavos de real, já finais. Não aplicar novamente 4,5%. Foram conferidas visualmente as seis páginas de tabelas e comparados os dados com o banco e a API pública.

- 67 itens Expresso Italiano, 20 Frozen Yogurt, 18 Iogurte Grego, 43 saborizantes e 1 base neutra Saborize.
- 97 preços por pacote e 97 preços de fardo corrigidos. Nenhuma divergência de gramagem.
- AÇAÍ C/ GUARANÁ e ACEROLA da linha Expresso desativados por ausência no PDF atual. Registros e histórico preservados.
- Lubrificante (fora dos PDFs) preservado; não certificado por esta auditoria.
- Fardo = 5 pacotes, conforme configuração existente, não como informação extraída dos PDFs.
- `before.json` e `after.json` preservam os estados comerciais. `apply-audit.sql` é uma operação única com guarda contra concorrência, não um seed para reaplicar.
- `verification.json`: 149/149 itens iguais no banco e na API pública; histórico de pedidos preservado.
- Os scripts e manifests de 05/09 são históricos e não devem ser reaplicados sobre estes dados.
