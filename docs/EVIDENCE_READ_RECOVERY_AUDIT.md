# Timeline e Auditoria: recuperação de consultas

## Alteração

As consultas dessas telas não usavam a recuperação transitória compartilhada. Uma primeira falha temporária mostrava erro imediatamente; ao tentar de novo, a mensagem podia permanecer enquanto a resposta seguinte estava em andamento.

Timeline e consultas de registros/resumo/pessoas da Auditoria agora usam uma tentativa adicional somente para erros temporários, conforme `transientReadOptions`. Falhas de acesso/validação não recebem nova tentativa automática, e nenhuma mutation foi alterada.

Durante a recuperação de uma consulta com erro, a região dos registros mostra carregamento, sem manter a falha anterior ou apresentar ausência de registros antes da resposta. Listagem e resumo da Auditoria continuam independentes, e filtros permanecem preenchidos/aplicados. O botão de recuperação do estado de erro compartilhado e o da Auditoria têm altura mínima de 44 px.

## Validação local

- 27 testes: contratos de Timeline/Auditoria e política de recuperação de consultas.
- TypeScript e build Vite.
- `scripts/audits/evidence-read-recovery.cjs`, Chromium com fixtures em 320/390 px: primeira resposta 503 seguida de tentativa retida mostra carregamento; recuperação ocorre após a segunda resposta, com duas chamadas; falha persistente termina em erro; tentar novamente troca a falha por carregamento e preserva filtros; filtro de data envia o intervalo no fuso da empresa; tela vazia só aparece após resposta válida sem registros; nenhuma mutation e nenhum overflow horizontal.
- `mobile-evidence-governance.cjs`: regressão de Timeline/Auditoria/Governança em múltiplas larguras, filtros, evidências, permissões e recuperação das fontes.

## Limites

Respostas simuladas, sem alteração de registros reais. API de produção e Safari/iPhone real não testados. Uma tentativa adicional não garante disponibilidade do serviço; após esgotar a recuperação, a tela mantém erro e ação explícita para tentar novamente.
