# Consistência do destino de restore — 12/11/2026

Base `a2052f0d`, branch `fix/restore-destino-consistente`, raiz `/workspace/NexoGestao`; início limpo, sem AGENTS.md aplicável. README/schema, restore/backup, drill, testes e runbook consultados. O PR #1052 foi integrado com os três checks aprovados.

## Falhas e correções

`scripts/restore-db.sh` validava host/banco de `DATABASE_URL`, mas restaurava em `DB_CONTAINER` sem conferir a porta publicada. Um contêiner parado ainda permitia fallback para psql do host, enquanto o smoke continuava tentando o contêiner. Parâmetros de URL podiam alterar o destino interpretado pelo cliente; o nome do banco era verificado antes de decodificar percent-encoding.

O script agora:

- Exige contêiner explicitamente escolhido em execução, publicação **única** em `127.0.0.1:<porta da URL>`, PostgreSQL interno em 5432 e usuário igual ao da URL. Contêiner ausente/parado/divergente falha sem fallback.
- Usa a mesma decisão de destino no restore e smoke. No contêiner, usa socket PostgreSQL padrão e porta interna explícita; migrations continuam usando a URL que corresponde à publicação verificada.
- Decodifica e valida nomes de banco/usuário antes dos bloqueios de produção; rejeita fragmentos, parâmetros desconhecidos, parâmetros repetidos e opções que redirecionariam a conexão. Permite somente `schema`, opções TLS e ajustes explícitos não destinados a roteamento documentados no runbook.
- Remove variáveis libpq de roteamento/serviço/opções no psql de host e as relevantes no contêiner; não deixa `PGHOSTADDR`/`PGSERVICE` sobreporem o destino validado.

Mantidos checksum exato, gzip, confirmação não interativa explícita e bloqueios de produção/remoto. A restrição de formatos é intencional neste utilitário não produtivo. Arquivos: restore, testes existentes de checksum ampliados e runbook.

## Evidências

- [Antes](restore-target-evidence/before.txt): regressões reproduziram aceitação de porta divergente, contêiner parado, binding público, parâmetro de host e banco de produção codificado. psql/pnpm/docker simulados, sem banco real.
- [Depois](restore-target-evidence/after.txt): **26 testes Node aprovados**, incluindo checker, checksum e destino; casos inválidos não executam comandos de banco. Contêiner correspondente passa; ambiente com PGHOSTADDR/PGSERVICE não altera o psql do host.
- [Regressão do backup](restore-target-evidence/backup-regression.txt): suíte shell passou. `bash -n scripts/restore-db.sh` e `git diff --check` passaram.
- [Drill real](restore-target-evidence/real-drill.txt): PostgreSQL 15 Alpine local (tag `postgres:15`, já disponível), projeto Compose único, porta dinâmica, banco `nexogestao_outbox_test`. Migrations aplicadas, tabela/registro fictícios, backup canônico, DELETE do registro de prova, restore pelo script corrigido e consulta do valor `synthetic-persisted` aprovados; migrations pós-restore sem pendências e smoke aprovado.

No drill, somente o registro fictício do banco criado por esta execução foi removido para verificar recuperação. Container/rede encerrados, diretório temporário removido e volumes preservados. Sem produção, provedor externo ou mensagem enviada. Não se repetiram build/tipos API/web porque seus fontes não mudaram.

## Limites

A conferência protege contra divergências de configuração observadas; não certifica que qualquer serviço local seja seguro para sobrescrever nem autentica o backup. Continuam obrigatórios alvo descartável confirmado e autorização de restore. Offsite/alerta, DR owner, objetivos de recuperação e exercício em ambiente aprovado continuam pendentes: AU12 permanece parcial, assim como AU08/AU11.
