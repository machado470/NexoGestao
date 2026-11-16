# Verificação após a mesclagem da PR 1025

A PR 1025 foi mesclada na main em `cc5cf93d2351f476ece8d188712ac5d3f2d6e814`. A árvore desse commit é idêntica à árvore validada localmente e publicada em `fa61a0202f2f68821501871c6390ff286d434e52`.

## CI: teste de onboarding desatualizado

O job quality-gates da main falhou na etapa Real multi-tenant isolation E2E. O teste de onboarding da organização A esperava HTTP 201 apesar de A ter apenas uma O.S. aberta e de a ordem concluída e a cobrança pertencerem à organização B. A regra nova corretamente respondeu HTTP 400.

O teste foi alinhado ao contrato: primeiro confirma a recusa, mantendo as duas organizações pendentes; depois prepara O.S. concluída e cobrança vinculada próprias de A, confirma HTTP 201 e verifica que apenas A foi liberada. Nenhuma validação de produção foi relaxada.

Verificação local: o mesmo comando `pnpm --filter ./apps/api test:integration:real` usado na etapa do CI passou com PostgreSQL e Redis temporários: 14 suítes e 68 testes passaram; 17 casos foram ignorados pelas configurações existentes. O provedor WhatsApp permaneceu mock, sem envio externo.

## Publicação

O workflow api-docker da main concluiu com sucesso. O workflow pages compilou o frontend, mas a etapa Deploy to GitHub Pages falhou com HTTP 404 e orientou habilitar Pages nas configurações do repositório. Essa configuração não foi alterada durante a verificação. A validação Production Compose ainda estava em andamento na consulta inicial.

Referências:

- CI: https://github.com/machado470/NexoGestao/actions/runs/42561048130
- Pages: https://github.com/machado470/NexoGestao/actions/runs/42561048107
