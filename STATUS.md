# REGRA DO SISTEMA — JURISFLOW

Este documento define as regras imutáveis do sistema.
Nenhuma feature pode violar estas regras.

---

## 1. PRINCÍPIO CENTRAL

O JurisFlow NÃO é um EAD.
Ele é um sistema de governança da execução humana.

O sistema não mede intenção.
Ele registra ação, consequência e risco.

---

## 2. TRILHA (TRACK)

A trilha é uma regra institucional.

- Pode existir em três estados:
  - DRAFT: rascunho, editável
  - ACTIVE: obrigação ativa
  - ARCHIVED: encerrada, imutável

- Uma trilha ACTIVE:
  - Pode ser atribuída
  - Não pode ser editada
  - Produz risco real

---

## 3. ITEM DA TRILHA (TRACK ITEM)

Item é a menor unidade executável.

Tipos:
- READING: leitura obrigatória
- ACTION: ação humana externa
- CHECKPOINT: confirmação consciente

Regras:
- Ordem é obrigatória
- Item só pode ser criado/alterado em DRAFT
- Não existe “pular item”

---

## 4. ASSIGNMENT

Assignment é o vínculo entre pessoa e trilha.

- Representa responsabilidade, não tarefa
- É criado apenas quando a trilha está ACTIVE
- Um assignment por pessoa por trilha

Campos críticos:
- progress: calculado pelo sistema
- risk: consequência da avaliação

---

## 5. EXECUÇÃO DA TRILHA

A execução é linear e controlada pelo backend.

Regras:
- O frontend nunca decide o próximo passo
- O backend define o próximo item válido
- Um item só pode ser concluído se for o próximo

A verdade da execução é:
TrackItemCompletion

---

## 6. PROGRESSO

Progresso NÃO é input humano.

- É calculado automaticamente:
  itens concluídos / itens totais
- Não pode ser alterado manualmente
- Não pode retroceder

---

## 7. AVALIAÇÃO

Avaliação encerra a trilha.

- Só ocorre após conclusão total
- Gera:
  - score
  - risk educacional
  - impacto no risco operacional

---

## 8. RISCO

Risco é consequência, não opinião.

Fontes de risco:
- Avaliação
- Inatividade
- Ações corretivas abertas
- Exceções humanas

Risco afeta:
- Estado operacional
- Acesso à execução
- Governança institucional

---

## 9. AÇÃO CORRETIVA

Ação corretiva é criada automaticamente.

- Nunca manual por padrão
- Sempre auditada
- Pode gerar reavaliação

---

## 10. AUDITORIA

Tudo que importa gera evento.

- Início de trilha
- Conclusão de item
- Avaliação
- Mudança de estado
- Ação corretiva

Sem evento, não existe.

---

## 11. REGRA FINAL

Nenhuma feature pode:
- Burlar a ordem
- Forçar progresso
- Simular conclusão
- Ocultar risco

Se violar isso, está errada.
