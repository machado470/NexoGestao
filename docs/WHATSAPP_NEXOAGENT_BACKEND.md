# WhatsApp e NexoAgent - Estrutura Completa do Backend

## 📋 Visão Geral

O NexoGestão possui uma estrutura completa para gerenciar WhatsApp e histórico de contatos. Abaixo está documentado tudo que já existe no backend.

---

## 🗄️ Schema do Banco de Dados

### 1. Tabela: `contactHistory` (Rastreamento de Contatos)

**Localização:** `drizzle/schema.ts` (linhas 177-192)

```typescript
export const contactHistory = mysqlTable("contactHistory", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  contactType: mysqlEnum("contactType", ["phone", "email", "whatsapp", "in_person", "other"]).notNull(),
  subject: varchar("subject", { length: 255 }).notNull(),
  description: text("description"),
  notes: text("notes"),
  contactedBy: varchar("contactedBy", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**Tipos TypeScript:**
- `ContactHistory` - Tipo de leitura
- `InsertContactHistory` - Tipo de inserção

**Campos:**
- `id` - Identificador único (auto-increment)
- `organizationId` - ID da organização
- `customerId` - ID do cliente
- `contactType` - Tipo de contato: `phone`, `email`, `whatsapp`, `in_person`, `other`
- `subject` - Assunto do contato (obrigatório)
- `description` - Descrição do contato
- `notes` - Notas adicionais
- `contactedBy` - Quem fez o contato
- `createdAt` - Data de criação
- `updatedAt` - Data de atualização

---

### 2. Tabela: `whatsappMessages` (Mensagens WhatsApp)

**Localização:** `drizzle/schema.ts` (linhas 194-211)

```typescript
export const whatsappMessages = mysqlTable("whatsappMessages", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull(),
  customerId: int("customerId").notNull(),
  messageId: varchar("messageId", { length: 255 }).unique(),
  direction: mysqlEnum("direction", ["inbound", "outbound"]).notNull(),
  content: text("content").notNull(),
  status: mysqlEnum("status", ["pending", "sent", "delivered", "read", "failed"]).default("pending").notNull(),
  senderNumber: varchar("senderNumber", { length: 20 }),
  receiverNumber: varchar("receiverNumber", { length: 20 }),
  mediaUrl: text("mediaUrl"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});
```

**Tipos TypeScript:**
- `WhatsappMessage` - Tipo de leitura
- `InsertWhatsappMessage` - Tipo de inserção

**Campos:**
- `id` - Identificador único (auto-increment)
- `organizationId` - ID da organização
- `customerId` - ID do cliente
- `messageId` - ID único da mensagem (único)
- `direction` - Direção: `inbound` (recebida) ou `outbound` (enviada)
- `content` - Conteúdo da mensagem (obrigatório)
- `status` - Status: `pending`, `sent`, `delivered`, `read`, `failed` (padrão: `pending`)
- `senderNumber` - Número do remetente
- `receiverNumber` - Número do destinatário
- `mediaUrl` - URL de mídia anexada (imagem, vídeo, etc.)
- `createdAt` - Data de criação
- `updatedAt` - Data de atualização

---

### 3. Campo em `customers` (Número WhatsApp)

**Localização:** `drizzle/schema.ts` (linha 70)

```typescript
whatsappNumber: varchar("whatsappNumber", { length: 20 }),
```

Cada cliente pode ter um número WhatsApp associado para facilitar o rastreamento de conversas.

---

## 🔌 API Backend (tRPC Routers)

### 1. Contact Router

**Localização:** `server/routers/contact.ts`

#### Procedures:

##### 1.1 `createContactHistory` (Mutation)
Cria um novo registro de contato.

**Input:**
```typescript
{
  customerId: number,
  contactType: "phone" | "email" | "whatsapp" | "in_person" | "other",
  subject: string,
  description?: string,
  notes?: string,
  contactedBy?: string
}
```

**Uso:**
```typescript
const result = await trpc.contact.createContactHistory.mutate({
  customerId: 1,
  contactType: "whatsapp",
  subject: "Envio de orçamento",
  description: "Orçamento enviado via WhatsApp",
  contactedBy: "João Silva"
});
```

---

##### 1.2 `getContactHistory` (Query)
Obtém histórico de contatos de um cliente.

**Input:**
```typescript
{
  customerId: number
}
```

**Uso:**
```typescript
const history = await trpc.contact.getContactHistory.query({
  customerId: 1
});
```

---

##### 1.3 `deleteContactHistory` (Mutation)
Deleta um registro de contato.

**Input:**
```typescript
{
  id: number
}
```

**Uso:**
```typescript
await trpc.contact.deleteContactHistory.mutate({
  id: 5
});
```

---

### 2. WhatsApp Messages Router

**Localização:** `server/routers/contact.ts`

#### Procedures:

##### 2.1 `createWhatsappMessage` (Mutation)
Cria uma nova mensagem WhatsApp.

**Input:**
```typescript
{
  customerId: number,
  direction: "inbound" | "outbound",
  content: string,
  senderNumber?: string,
  receiverNumber?: string,
  mediaUrl?: string
}
```

**Uso:**
```typescript
const msg = await trpc.contact.createWhatsappMessage.mutate({
  customerId: 1,
  direction: "outbound",
  content: "Olá! Tudo bem?",
  senderNumber: "+5511999999999",
  receiverNumber: "+5511888888888"
});
```

---

##### 2.2 `getWhatsappMessages` (Query)
Obtém todas as mensagens WhatsApp de um cliente.

**Input:**
```typescript
{
  customerId: number
}
```

**Uso:**
```typescript
const messages = await trpc.contact.getWhatsappMessages.query({
  customerId: 1
});
```

---

##### 2.3 `updateWhatsappMessageStatus` (Mutation)
Atualiza o status de uma mensagem.

**Input:**
```typescript
{
  id: number,
  status: string
}
```

**Uso:**
```typescript
await trpc.contact.updateWhatsappMessageStatus.mutate({
  id: 1,
  status: "delivered"
});
```

---

##### 2.4 `deleteWhatsappMessage` (Mutation)
Deleta uma mensagem WhatsApp.

**Input:**
```typescript
{
  id: number
}
```

**Uso:**
```typescript
await trpc.contact.deleteWhatsappMessage.mutate({
  id: 1
});
```

---

## 🗂️ Database Helper Functions

**Localização:** `server/db.ts`

### Contact History Functions

```typescript
// Criar novo contato
export async function createContactHistory(data: InsertContactHistory)

// Obter contatos de um cliente
export async function getContactHistoryByCustomer(customerId: number)

// Deletar contato
export async function deleteContactHistory(id: number)
```

---

### WhatsApp Messages Functions

```typescript
// Criar nova mensagem
export async function createWhatsappMessage(data: InsertWhatsappMessage)

// Obter mensagens de um cliente
export async function getWhatsappMessagesByCustomer(customerId: number)

// Atualizar status da mensagem
export async function updateWhatsappMessageStatus(id: number, status: string)

// Deletar mensagem
export async function deleteWhatsappMessage(id: number)
```

---

## 🔗 NexoAgent / NexoProxy Router

**Localização:** `server/routers/nexo-proxy.ts`

Este router atua como proxy para a API do NexoGestão (servidor externo).

### Configuração

```typescript
const NEXO_API_URL = process.env.NEXO_API_URL || "http://localhost:3001";
```

### Endpoints Disponíveis

#### 1. Bootstrap
- `nexo.bootstrap.firstAdmin` - Criar primeiro admin

#### 2. Auth (Autenticação)
- `nexo.auth.login` - Login
- `nexo.auth.me` - Obter dados do usuário

#### 3. Customers (Clientes)
- `nexo.customers.list` - Listar clientes
- `nexo.customers.create` - Criar cliente

#### 4. Appointments (Agendamentos)
- `nexo.appointments.list` - Listar agendamentos

#### 5. Service Orders (Ordens de Serviço)
- `nexo.serviceOrders.list` - Listar ordens

#### 6. Finance (Finanças)
- `nexo.finance.overview` - Overview financeiro

#### 7. Admin
- `nexo.admin.overview` - Overview admin

---

## 📊 Fluxo de Dados

### Fluxo de Criação de Mensagem WhatsApp

```
Frontend (React)
    ↓
trpc.contact.createWhatsappMessage.mutate()
    ↓
Backend (contact.ts)
    ↓
db.createWhatsappMessage()
    ↓
Database (whatsappMessages table)
```

### Fluxo de Recuperação de Histórico

```
Frontend (React)
    ↓
trpc.contact.getWhatsappMessages.query()
    ↓
Backend (contact.ts)
    ↓
db.getWhatsappMessagesByCustomer()
    ↓
Database (whatsappMessages table)
    ↓
Frontend (React) - Renderiza mensagens
```

---

## 🚀 Próximos Passos

### Funcionalidades que podem ser adicionadas:

1. **Integração com API WhatsApp Business**
   - Receber webhooks de mensagens
   - Enviar mensagens via API
   - Sincronizar status de mensagens

2. **NexoAgent - Agente de IA**
   - Processar mensagens com IA
   - Responder automaticamente
   - Classificar mensagens

3. **Dashboard de WhatsApp**
   - Visualizar conversas
   - Enviar mensagens
   - Histórico de contatos

4. **Notificações em Tempo Real**
   - WebSocket para mensagens novas
   - Notificações push

5. **Relatórios**
   - Análise de contatos
   - Estatísticas de WhatsApp
   - Tendências de comunicação

---

## 📝 Notas Importantes

- Todas as operações de WhatsApp são vinculadas a um `organizationId` (organização)
- Cada mensagem é vinculada a um `customerId` (cliente)
- O status padrão de uma mensagem é `pending`
- As mensagens são ordenadas por data de criação (mais recentes primeiro)
- Suporta múltiplos tipos de contato (phone, email, whatsapp, in_person, other)

---

## 🔐 Autenticação

- Todas as operações de contato e WhatsApp requerem `protectedProcedure`
- O `organizationId` é obtido automaticamente de `ctx.user.id`
- Apenas usuários autenticados podem criar/ler/atualizar/deletar mensagens

---

Documento gerado em: 2026-03-02
