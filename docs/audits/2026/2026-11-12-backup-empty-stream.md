# Rejeição de stream SQL vazio no backup — 12/11/2026

Base `ccfa2c8b`, branch `fix/backup-rejeita-dump-vazio`, raiz `/workspace/NexoGestao`, início limpo; sem AGENTS.md aplicável. README/manifests, engine e regressões consultados. PR #1057 integrado; Compose e um quality-gate passaram, outro ainda em execução na última consulta.

## Falha confirmada e correção

O engine verificava `-s` no arquivo gzip e sua integridade. Uma saída vazia de pg_dump com exit zero, porém, vira gzip válido com cabeçalho, portanto maior que zero. O script podia publicar um arquivo sem SQL como backup bem-sucedido. O pg_dump normal de um banco sem tabelas ainda emite conteúdo: não se está proibindo bancos vazios, e sim stream sem byte algum.

`scripts/backup-db.sh` agora consome integralmente a descompressão e conta seus bytes. O pipeline com pipefail preserva a verificação de integridade gzip; exige tamanho descomprimido positivo antes de publicar dump/sidecar, aplicar retenção ou enviar ao offsite. Não cria cópia SQL descomprimida em disco. Formato de backup, checksum, origem, locks e retenção foram preservados.

## Evidências

- [Antes](backup-empty-evidence/before.txt): sete cenários passaram e os dois de stream vazio reprovaram porque host/contêiner retornavam sucesso. A regressão verifica que o artefato incorretamente aceito descomprime para zero bytes.
- [Depois](backup-empty-evidence/after.txt): **42 testes Node passaram**, incluindo os três cenários acrescentados ao arquivo de origem (stream vazio host/contêiner e saída parcial com falha do pg_dump). Casos reprovados não publicam .sql.gz e não deixam arquivos parciais/trava.
- [Regressão](backup-empty-evidence/regression.txt): suíte shell existente passou. `bash -n scripts/backup-db.sh` e `git diff --check` passaram.

As regressões usam engine real, gzip/checksum reais e pg_dump/docker simulados; dados SQL fictícios em diretórios temporários próprios, removidos. O arquivo de testes já é executado no CI. Nenhum banco real, provider, cron ou deploy nesta etapa; não se repetiram build/tipos API/web.

## Limites

Conteúdo não vazio e checksum não garantem SQL semanticamente completo, origem autêntica ou restaurabilidade. O drill de restore continua necessário, assim como prova offsite/alerta e definições de responsável/RPO/RTO. AU12 segue parcial; AU08/AU11 também.
