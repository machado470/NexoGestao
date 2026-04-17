# DEV_RULES

Regras obrigatórias para o boot local do NexoGestao.

1. Não adicionar novos scripts de desenvolvimento sem necessidade real.
2. Não adicionar novas flags de boot sem revisão técnica formal.
3. Não aumentar a complexidade do boot local com fallback oculto ou auto-decisões.
4. O fluxo local deve priorizar simplicidade, previsibilidade e estabilidade.
5. `scripts/dev-full.sh` é estável: apenas correções críticas futuras.
6. Integrações opcionais nunca podem bloquear o boot local e devem logar como `[OPTIONAL]`.
