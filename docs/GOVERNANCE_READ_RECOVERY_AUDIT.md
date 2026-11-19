# Governança: recuperação independente de fontes

Governança consulta estado operacional, avaliação automática, execuções, sinais e próxima ação. Essas leituras não tinham a política transitória aplicada nas outras telas e podiam manter erro visível durante uma nova tentativa.

As cinco consultas agora aguardam a sessão autenticada e usam `transientReadOptions`: uma tentativa adicional para falhas temporárias, sem repetir falhas de acesso/validação. A região afetada mostra carregamento enquanto recupera uma consulta com erro, preservando as outras fontes. O aviso agregado conta apenas falhas encerradas; a ação de recuperação consulta somente fontes com erro que não estejam em andamento. O botão agregado tem altura mínima de 44 px. A referência da avaliação distingue consulta de atualidade em andamento de ausência de indicação de desatualização.

Risco, pontuação, decisões, evidências, ordem dos sinais e destinos continuam vindo dos contratos oficiais. Nenhuma mutation ou motor de decisão local foi introduzido. Consultas manuais são agregadas com `Promise.allSettled`, e os estados de cada query seguem sendo a fonte da interface.

## Validação local

- 20 testes de contrato de Governança e política de retry; TypeScript e build Vite.
- `governance-read-recovery.cjs`, Chromium com fixtures em 320/390 px: para cada uma das cinco fontes, primeira resposta 503 e segunda resposta retida; carregamento sem erro/vazio indevido; falha persistente com aviso parcial; dados de outras fontes preservados; retry explícito requisitando somente a fonte afetada; recuperação final sem overflow horizontal ou writes.
- `mobile-evidence-governance.cjs`: regressão de Auditoria/Timeline/Governança em múltiplas larguras, metadados, paginação, filtros, fuso, permissões e desktop.

## Limites

Somente respostas simuladas. API de produção e Safari/iPhone real não testados. Uma tentativa adicional não garante disponibilidade; após esgotá-la, há erro e opção de nova consulta. Nenhuma indisponibilidade é convertida em estado normal ou ausência de risco.
