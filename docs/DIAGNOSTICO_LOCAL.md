# Diagnóstico conjunto pelo WSL

Mantenha `NEXO_DEV_SEED=0 pnpm dev:full` em execução. Em outro terminal, na raiz do projeto:

```bash
node scripts/diagnose-local.mjs
```

Requer Node >= 20.12, dependências instaladas e Prisma Client gerado pelo boot.
Informe a mesma conta do navegador; a senha fica oculta e não é salva.
O login normal pode registrar uma métrica LOGIN. As demais chamadas são GET;
o banco é consultado em uma transação explicitamente somente leitura.
Não executa seed, migrations, recálculo, alterações de cadastro ou pagamentos.

O JSON aparece no terminal e em `work/diagnostico-local.json`. Envie esse JSON
na conversa. Ele contém branch/commit, organização autenticada, contagens do
banco e resultados separados da API e do BFF. Não contém credenciais, nomes,
conteúdo de registros ou logs completos. EMPTY_PAGE significa página vazia;
confirme o total e o banco antes de concluir que toda a organização está vazia.
UNAVAILABLE/NOT_CHECKED nunca significam contagem zero.

Usa as portas API_PORT/WEB_PORT e NEXO_API_URL do ambiente/.env. Somente HTTP
local e banco com host local são aceitos. O script autentica sua própria sessão;
não consegue provar que os cookies do navegador estão corretos. Se o relatório
estiver correto e a tela divergir, investigaremos a sessão/cache do navegador.

Fluxo de trabalho: corrigimos o código na branch de auditoria, você atualiza
pelo Git no WSL, executa o diagnóstico e devolve o resultado. O VS Code serve
para abrir o projeto e editar; não precisa de agente instalado.
