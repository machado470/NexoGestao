# Financeiro — Nexo Operating System UI

Financeiro é o cockpit de conversão **execução → receita**. A página `/finances` não deve parecer uma tabela administrativa de ERP: ela deve ajudar o operador a decidir, cobrar, reduzir risco de caixa, enxergar evidência e executar apenas ações reais já existentes.

## Hierarquia obrigatória

1. **Hero Executivo Financeiro:** somente dinheiro recebido, dinheiro pendente e dinheiro em risco.
2. **FAÇA AGORA:** bloco dominante de decisão imediata, com motivo, impacto, segurança e CTA real.
3. **Pipeline Financeiro:** fluxo visual principal `Cliente → Cobrança → Envio → Contato → Pagamento → Recebimento`, com gargalo destacado.
4. **Pulso Financeiro:** leitura executiva curta sobre conversão cobrança → pagamento, receita travada, maior gargalo e segurança operacional.
5. **Radar compacto:** alertas rápidos com consequência e CTA curto, sem virar dashboard paralelo.
6. **Carteira operacional:** cobranças selecionáveis em cards/linhas operacionais, não tabela administrativa pesada.
7. **Detalhe financeiro:** Decisão operacional → Prova operacional financeira → Comunicação / WhatsApp → Contexto financeiro.

## Pipeline Financeiro

O pipeline oficial de Financeiro é:

**Cliente → Cobrança → Envio → Contato → Pagamento → Recebimento**

Regras do pipeline:

- usar somente dados já carregados na página;
- não inventar histórico, envio, contato, pagamento ou automação;
- não transformar Timeline/Governança em etapa principal;
- usar linguagem humana e operacional;
- acionar apenas CTAs reais já existentes, como WhatsApp contextual, criação de cobrança, registro de pagamento e navegação para Cliente/O.S.

## Carteira e detalhe

- A carteira deve destacar cliente, valor, vencimento/atraso, origem operacional humanizada, prioridade, próxima ação e CTA principal.
- A carteira não deve exibir ID bruto de cobrança, O.S., cliente ou UUID.
- O detalhe financeiro deve iniciar por **decisão operacional**, com próxima ação, motivo, impacto e segurança.
- Depois da decisão, o detalhe deve mostrar a **Prova operacional financeira** antes dos mini-cards de contexto financeiro; Comunicação/WhatsApp vem antes do contexto.
- Telefones crus não devem aparecer; use “Contato cadastrado”, “WhatsApp disponível” ou “Sem contato retornado”, salvo se existir regra global de máscara segura.

## Timeline financeira humanizada

Eventos conhecidos devem ser traduzidos para:

- Cobrança preparada
- Lembrete de cobrança enviado
- Cobrança registrada
- Pagamento registrado
- Cobrança cancelada
- Evento financeiro registrado

Fallback obrigatório: **Evento financeiro registrado**.

## Regra anti-vazamento técnico

A UI do operador não deve exibir UUID, hash, ID cru, telefone cru, eventType, actionKey, backend, BFF, endpoint, payload, metadata, tokens internos, pipes, setas brutas ou nomes técnicos de ação/evento.

Quando a fonte atual não trouxer dado suficiente, usar fallback honesto de negócio, como “Evento financeiro registrado”, “Sem O.S. vinculada”, “Sem contato retornado” ou “Origem não informada pela fonte atual”.

## Governança financeira

Financeiro deve ter bloco compacto de impacto operacional com dinheiro em risco, cobranças vencidas, risco para caixa e reflexo em Timeline/Governança/WhatsApp/Cliente. Esse bloco é leitura de UI sobre dados carregados; não cria regra nova de backend.

## Limites preservados

Esta direção não altera backend, API, Prisma, rotas, contratos, segurança multi-tenant, WhatsAppPage, automações reais, mocks ou seeds. A página pode apenas reorganizar e humanizar dados já carregados e acionar fluxos reais existentes.
