# Ensaios locais de leitura

`read-stages.cjs` executa somente GET em um destino de loopback com dados fictícios. Usa as páginas de Clientes, Agendamentos, O.S., inbox e a projeção do resumo dos oito clientes visíveis. Não chama provedores de pagamento ou mensagens.

Requisitos: API local iniciada, banco de teste migrado/populado, uma organização de teste com clientes e um login válido exportado no formato Playwright (`cookies`, contendo `nexo_token`). O arquivo contém credenciais: mantenha-o fora do repositório. Não use uma organização de produção.

```bash
NEXO_LOAD_CONFIRM_ISOLATED=1 \
NEXO_LOAD_STORAGE_STATE=/tmp/login-teste.json \
NEXO_LOAD_API_PID=12345 \
node scripts/load/read-stages.cjs > /tmp/resultado-carga.json
```

`NEXO_LOAD_API_PID` é opcional; informe o PID do processo Node da API para amostrar RSS em Linux. `NEXO_LOAD_TARGET` aceita uma URL local alternativa (padrão `http://127.0.0.1:3340/v1/`). URLs de fora do loopback são rejeitadas e redirecionamentos não são seguidos.

As quatro etapas usam 5 clientes por 15 s, 10 por 30 s, 20 por 45 s e 5 por 20 s. Cada cliente faz uma chamada por vez, com pausa de 100 ms e timeout de 5 s. O ensaio encerra as novas chamadas após cinco erros inesperados. O tempo pode exceder os 110 s pelas chamadas em andamento. A saída inclui status HTTP, percentis das respostas 200, bytes, RPS observado e amostras de RSS. Erros 429 são contabilizados separadamente; sua ocorrência não demonstra disponibilidade normal. O resumo só passa se todas as rotas tiverem pelo menos um sucesso em cada etapa e não houver erro inesperado.

É um ensaio curto de concorrência, rampa e recuperação. As chamadas são de uma organização e o tempo de resposta influencia a taxa gerada. RPS observado não é capacidade máxima. Um resultado local em modo development não comprova os limitadores de produção, estabilidade por horas, capacidade multiempresa, ausência de vazamentos ou SLA. Não altere limites de produção para reproduzir estes números.

O teste multiempresa com PostgreSQL e Redis reais fica em `apps/api/test/integration/capacity-multitenant-postgres-redis.integration.spec.ts`, com opt-in separado. Consulte o relatório `docs/audits/2026/2026-11-11-capacity-corrections.md` para os comandos e limites da evidência.
