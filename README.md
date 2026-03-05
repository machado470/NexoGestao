# NexoGestão — Plataforma Modular de Gestão Operacional

O **NexoGestão** é uma plataforma de gestão modular com integração via WhatsApp, focada em organizar operação, reduzir erro humano e automatizar comunicação.

Ele conecta:

cliente → operação → financeiro → execução → risco → histórico

Sem planilhas paralelas.  
Sem mensagem perdida.  
Sem controle informal.

---

## 🎯 Propósito

Pequenas e médias empresas não quebram por falta de cliente.

Quebram por desorganização operacional.

O NexoGestão existe para:

- Organizar operação
- Padronizar execução
- Automatizar comunicação
- Reduzir risco humano
- Registrar histórico real

Ele transforma rotina desorganizada em sistema estruturado.

---

## 🧠 Conceito Central

O NexoGestão não é um ERP pesado.

Ele é um núcleo inteligente (NexoCore) com módulos conectados.

Tudo gira em torno da operação real da empresa.

---

## 🏗 Estrutura Modular

### 👥 Módulo Clientes
- ✅ Cadastro completo com endereço
- ✅ Histórico de atendimento
- ✅ Relacionamento centralizado
- ✅ Status ativo/inativo
- ✅ Número WhatsApp integrado

---

### 📅 Módulo Agenda
- ✅ Agendamentos com data/hora
- ✅ Status do agendamento (scheduled, confirmed, done, canceled)
- ✅ Notas e observações
- ✅ Controle de comparecimento

---

### 🧾 Módulo Ordens de Serviço
- ✅ Criação de O.S.
- ✅ Registro de execução
- ✅ Status da ordem (open, assigned, in_progress, done, canceled)
- ✅ Prioridade (low, medium, high)
- ✅ Histórico por cliente

---

### 💰 Módulo Financeiro
- ✅ Registro de cobranças
- ✅ Controle de pagamento (pending, overdue, paid)
- ✅ Rastreamento de valores
- ✅ Histórico de transações

---

### 📲 Integração WhatsApp — "Meu Acessor"

O WhatsApp não é suporte. É canal operacional.

Funcionalidades implementadas:

- ✅ Visualização de conversas por cliente
- ✅ Envio de mensagens
- ✅ Rastreamento de status (pending, sent, delivered, read, failed)
- ✅ Suporte a mídia (imagens, vídeos)
- ✅ Histórico de contatos (phone, email, whatsapp, in_person, other)
- ✅ Integração com dados do cliente

Comunicação automatizada, mas editável.

---

## 👥 Módulo Pessoas

- ✅ Cadastro de colaboradores
- ✅ Atribuição de tarefas
- ✅ Histórico de atividades

---

## 🛡️ Módulo Governança

- ✅ Auditoria de operações
- ✅ Rastreamento de mudanças
- ✅ Relatórios de conformidade

---

## 🔁 Fluxo Operacional

Cliente
→ Agenda
→ Ordem de Serviço
→ Execução
→ Financeiro
→ Comunicação automática (WhatsApp)
→ Histórico
→ Risco recalculado

Sem planilha paralela.
Sem controle fora do sistema.

---

## 🎯 Público-Alvo Inicial

Empresas de serviço:

- Limpeza
- Manutenção
- Assistência técnica
- Pequenas clínicas
- Escritórios
- Prestadores recorrentes

Negócios que vivem no WhatsApp e planilha.

---

## 🚀 CI/CD
Os workflows de CI/CD para Staging e Produção foram configurados no GitHub Actions. O deploy para Staging é acionado automaticamente em pushes para a branch `development`, enquanto o deploy para Produção é acionado em pushes para a branch `main`.

## 🏗 Arquitetura Técnica

### Stack Atual

**Frontend (apps/web):**
- React 19 + TypeScript
- Tailwind CSS 4
- tRPC 11 (Type-safe RPC)
- Wouter (Roteamento)
- Manus OAuth (Autenticação)

**Backend (apps/web/server):**
- Express.js 4 + TypeScript
- tRPC 11
- Drizzle ORM
- TiDB (MySQL compatível)
- JWT Sessions
- Manus OAuth Integration

**Infraestrutura:**
- Manus Platform (Hosting + Database)
- Docker Compose (Local development)
- Git + GitHub (Version control)

---

## 📊 Status de Implementação

| Funcionalidade | Status | Notas |
|---|---|---|
| Autenticação | ✅ Funcional | JWT + OAuth Manus |
| Clientes | ✅ Funcional | CRUD completo, paginação |
| Agendamentos | ✅ Funcional | CRUD completo |
| Ordens de Serviço | ✅ Funcional | CRUD completo |
| Finanças | ✅ Funcional | Overview + CRUD |
| WhatsApp | ✅ Funcional | Visualização, envio, histórico |
| Histórico de Contatos | ✅ Funcional | Múltiplos tipos, rastreamento |
| Pessoas | ✅ Funcional | CRUD completo |
| Governança | ✅ Funcional | Auditoria básica |
| Dashboard | ✅ Funcional | Overview executivo |

---

## 🚀 Começar Localmente

### Pré-requisitos

- Node.js 22+
- pnpm (gerenciador de pacotes)
- Git

### Instalação

```bash
# Clonar repositório
git clone https://github.com/machado470/NexoGestao.git
cd NexoGestao

# Instalar dependências
pnpm install

# Configurar variáveis de ambiente
cp apps/web/.env.example apps/web/.env

# Executar migrações do banco
cd apps/web
pnpm db:push

# Iniciar servidor de desenvolvimento
pnpm dev
```

### Acessar a aplicação

- Frontend: http://localhost:3000
- API: http://localhost:3000/api/trpc

---

## 🧪 Testes

```bash
# Executar todos os testes
pnpm test

# Executar testes em modo watch
pnpm test:watch

# Cobertura de testes
pnpm test:coverage
```

**Status Atual:** 5/5 testes passando ✅

---

## 📁 Estrutura do Projeto

```
NexoGestao/
├── apps/
│   ├── api/                    # Backend (NestJS) - Legado
│   └── web/                    # Frontend + Backend (React + Express)
│       ├── client/
│       │   ├── src/
│       │   │   ├── pages/      # Páginas principais
│       │   │   ├── components/ # Componentes reutilizáveis
│       │   │   ├── contexts/   # React contexts
│       │   │   ├── lib/        # Utilitários
│       │   │   └── App.tsx     # Roteamento
│       │   └── public/         # Assets estáticos
│       ├── server/
│       │   ├── routers/        # tRPC routers
│       │   ├── db.ts           # Query helpers
│       │   └── _core/          # Framework core
│       ├── drizzle/            # Migrações do banco
│       ├── shared/             # Tipos compartilhados
│       └── package.json
├── docs/                       # Documentação
├── docker-compose.yml          # Local development
└── README.md
```

---

## 🔐 Autenticação

O NexoGestão usa **Manus OAuth** para autenticação segura.

### Fluxo de Login

1. Usuário clica em "Login"
2. Redireciona para portal Manus OAuth
3. Após autenticação, retorna com JWT
4. Cookie de sessão é criado
5. Usuário autenticado acessa dashboard

### Proteção de Rotas

Todas as rotas operacionais requerem autenticação:
- `/customers`
- `/appointments`
- `/service-orders`
- `/finances`
- `/whatsapp`
- `/people`
- `/governance`

Rotas públicas:
- `/` (Landing page)
- `/login`
- `/register`

---

## 🔗 Integração Frontend-Backend

Todas as funcionalidades usam **tRPC** para comunicação type-safe:

```typescript
// Frontend
const { data, isLoading } = trpc.data.customers.list.useQuery({ page: 1, limit: 10 });

// Backend
export const customersRouter = router({
  list: publicProcedure
    .input(z.object({ page: z.number(), limit: z.number() }))
    .query(async ({ input, ctx }) => {
      return await getCustomers(ctx.org.id, input.page, input.limit);
    }),
});
```

---

## 📝 Próximos Passos

1. **Integração com WhatsApp Business API** - Sincronizar mensagens em tempo real
2. **Notificações em tempo real** - Implementar WebSocket para atualizações instantâneas
3. **NexoAgent com IA** - Agente que processa mensagens automaticamente
4. **Módulo de Estoque** - Controle de itens e consumo
5. **Relatórios avançados** - Dashboards com análises profundas
6. **Mobile app** - Aplicativo nativo para iOS/Android

---

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Faça fork do repositório
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

---

## 📄 Licença

Este projeto está sob licença MIT. Veja o arquivo LICENSE para detalhes.

---

## 📞 Suporte

Para suporte, abra uma issue no GitHub ou entre em contato através do WhatsApp.

---

## 🙏 Agradecimentos

Desenvolvido com ❤️ para pequenas e médias empresas que querem organizar sua operação.

---

**Última atualização:** 2026-03-05  
**Versão:** 1.0.0  
**Status:** Em desenvolvimento ativo
