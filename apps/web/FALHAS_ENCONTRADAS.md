# Análise de Falhas - NexoGestão SaaS

## Falhas Identificadas

### 1. **Teste de Logout Falhando**
- **Arquivo**: `server/auth.logout.test.ts`
- **Problema**: O teste tenta chamar `caller.auth.logout()` mas o procedimento está em `caller.session.logout()`
- **Causa**: O router foi reorganizado, o logout foi movido para `session` router, não `auth` router
- **Solução**: Atualizar o teste para chamar `caller.session.logout()`

### 2. **Falta de Logout no Auth Router**
- **Arquivo**: `server/routers/auth.ts`
- **Problema**: Não há procedimento de logout no auth router
- **Solução**: Adicionar logout procedure ao auth router ou atualizar teste

### 3. **Senhas em Texto Plano**
- **Arquivo**: `server/routers/auth.ts` (linhas 41, 94)
- **Problema**: Senhas são armazenadas sem hash (TODO comentado)
- **Solução**: Implementar bcrypt para hash de senhas

### 4. **Falta de Validação de Formulários**
- **Arquivo**: `client/src/components/CreateCustomerModal.tsx`
- **Problema**: Não há validação de email ou telefone
- **Solução**: Adicionar validação com regex ou biblioteca

### 5. **Contexto de Autenticação Incompleto**
- **Arquivo**: `client/src/contexts/AuthContext.tsx`
- **Problema**: Contexto usa tRPC mas não está totalmente integrado com o sistema de sessão
- **Solução**: Integrar com `useAuth()` hook do template

### 6. **Modais Sem Tratamento de Erros**
- **Arquivo**: `client/src/components/CreateCustomerModal.tsx` e similares
- **Problema**: Modais não tratam erros de rede ou validação do servidor
- **Solução**: Adicionar try-catch e feedback de erro

### 7. **Falta de Tabelas de Dados**
- **Arquivo**: `client/src/pages/Dashboard.tsx`
- **Problema**: Seções mostram "Nenhum registro" mas não exibem dados criados
- **Solução**: Implementar tabelas com dados reais

### 8. **Importação Incorreta do useAuth**
- **Arquivo**: `client/src/pages/Dashboard.tsx`
- **Problema**: Importa de `@/contexts/AuthContext` mas deveria usar `@/_core/hooks/useAuth`
- **Solução**: Atualizar imports para usar o hook correto

### 9. **Falta de Proteção de Rotas**
- **Arquivo**: `client/src/App.tsx`
- **Problema**: Dashboard não está protegido, qualquer um pode acessar
- **Solução**: Adicionar verificação de autenticação nas rotas

### 10. **Banco de Dados Não Sincronizado**
- **Arquivo**: `drizzle/schema.ts`
- **Problema**: Schema pode estar desatualizado com as migrações
- **Solução**: Executar `pnpm db:push` para sincronizar

## Prioridade de Correção

1. **CRÍTICA**: Falha no teste de logout (1)
2. **CRÍTICA**: Proteção de rotas (9)
3. **ALTA**: Senhas em texto plano (3)
4. **ALTA**: Contexto de autenticação (5)
5. **MÉDIA**: Validação de formulários (4)
6. **MÉDIA**: Tratamento de erros (6)
7. **BAIXA**: Tabelas de dados (7)
8. **BAIXA**: Banco de dados (10)
