# Edição de cliente no celular e rótulos da O.S. — 12/11/2026

Base `af8a1cec`, branch final `fix/edicao-mobile-e-rotulos-os`, raiz `/workspace/NexoGestao`, início limpo, sem AGENTS.md aplicável. README/manifests, rotas, editores e menus consultados. PR #1063 integrado com os três checks aprovados.

## Achados e correções

**Editor de O.S. — corrigido.** O navegador confirmou oito campos sem id/label associado. `apps/web/client/src/components/EditServiceOrderModal.tsx` agora usa useId por instância e htmlFor/id em título, descrição, prioridade, data agendada, responsável, status, valor e vencimento. Motivo de cancelamento e resumo final condicionais ganharam id/nome via aria-label. Não altera handlers, valores, estados, permissões ou bloqueios de O.S. encerrada. [DOM antes](edit-labels-evidence/before.json), [ensaio inicial](edit-labels-evidence/before.txt).

**Acesso à edição de cliente no celular — corrigido.** O teste passou no desktop, mas a versão 390 px não oferecia Mais ações/Editar dados: o menu existia apenas na tabela md:block. [Tela anterior](edit-labels-evidence/customer-mobile-before.png). `apps/web/client/src/pages/CustomersPage.tsx` extrai o mesmo menu para renderCustomerSecondaryActions e o reutiliza no cartão e na tabela. Mantém callbacks e permissões de abrir/agendar/O.S./financeiro/WhatsApp/editar, sem duplicar lógica. O agrupamento no cartão interrompe propagação do clique para a seleção e permite quebra de linha para acomodar as ações.

**Rótulos da edição de cliente — já resolvidos.** Os campos já usavam htmlFor/id e foram validados sem modificar EditCustomerModal. **Edição de cobrança — não exercitada:** EditChargeModal não tem consumidor na interface atual (apenas referências de teste/arquitetura); nenhuma nova ação ou rota foi criada nesta etapa.

## Verificações

- **806 testes web / 100 arquivos aprovados.** [Log](edit-labels-evidence/tests.txt).
- Typecheck, lint:os, build web e diff --check passaram. [Tipos](edit-labels-evidence/types.txt), [lint](edit-labels-evidence/lint.txt), [build](edit-labels-evidence/build.txt). PNPM 10.30.3 via npx.
- Chromium com API/BFF/PostgreSQL reais: editor de O.S. e de cliente em **1440 e 390 px** confirmaram controles visíveis com rótulo/id e IDs únicos; preenchimento pelos rótulos e salvamento pelos botões normais. Após reload, novos título da O.S. e nome do cliente permaneceram no banco e na tela. [Resultado](edit-labels-evidence/browser.json), [execução](edit-labels-evidence/browser.txt).
- Após o ajuste final de flex-wrap no cartão, a versão **390 px foi repetida e passou** para os dois editores, incluindo persistência e ausência de overflow horizontal da página. [Resultado final mobile](edit-labels-evidence/mobile-final.json), [log](edit-labels-evidence/mobile-final.txt).
- Capturas: [editor de O.S.](edit-labels-evidence/order-390.png), [editor de cliente](edit-labels-evidence/customer-390.png). A seção financeira da O.S. foi expandida na verificação. Campos condicionais de cancelamento/resumo final foram conferidos por código, não renderizados nesta amostra.

Não houve nova regressão de negócio na amostra. A harness precisou usar “Salvar” no cliente e “Salvar alterações” na O.S.; o bloqueio mobile posterior era real e foi resolvido pelo menu compartilhado. Não se repetiram testes API, pois seus fontes/contratos não mudaram.

## Dados e limites

Organização, ADMIN verificado, pessoa, cliente e O.S. fictícios preparados como fixtures. Alterações de título/nome foram feitas na interface; registros próprios e relações removidos ao terminar. Serviços/containers locais encerrados; volumes preservados. Nenhum registro compartilhado, deploy ou envio externo. Harness temporária com credenciais fictícias não versionada.

Validação em viewport mobile não substitui dispositivo, teclado virtual ou leitor de tela real. A amostra usou ADMIN e O.S. atribuída aberta; bloqueios de perfis/estados encerrados foram preservados no código, mas não exercitados visualmente nesta rodada. AU08/AU11/AU12 continuam parciais conforme dependências registradas.
