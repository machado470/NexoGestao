# REGRA DO SISTEMA — NEXOGESTAO

O NexoGestao NÃO é um “EAD”.
É um motor de governança operacional com execução rastreável.

## Princípios
- Backend é a autoridade
- Nada de “dados fake pra demo”
- Eventos e auditoria precisam ser defensáveis
- Jobs idempotentes
- Seeds idempotentes
- Risco baseado em comportamento real

## Ciclo mínimo
1) Atribuir trilha
2) Executar itens (com registro)
3) Recalcular risco
4) Gerar ações corretivas (se necessário)
5) Registrar tudo na auditoria/timeline
