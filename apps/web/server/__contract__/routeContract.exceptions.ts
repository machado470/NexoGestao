import type { ContractException } from "./routeContract";

/**
 * C8 PR2 — justified exceptions of the BFF → API contract analysis.
 *
 * Rules (enforced by bff-api-routes.contract.test.ts):
 * - every exception names one finding kind, one file and a specific owner (`fn`) and/or `route`;
 *   body-field exceptions also name the single `field`. No directory/module wildcards;
 * - an exception that no longer matches any finding fails the test (remove it);
 * - a body-field exception covers only that field: any other field of the same call still fails.
 */
export const CONTRACT_EXCEPTIONS: ContractException[] = [
  // --- Transport core: the path is the caller's argument; every caller is analysed instead.
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoClient.ts", fn: "requestNexo", reason: "Núcleo de transporte: monta `${NEXO_API_URL}${path}` com o caminho recebido; cada chamador é verificado." },
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoTransport.ts", fn: "authedFetch.raw", reason: "Wrapper exportado de transporte; o caminho vem do chamador." },
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoTransport.ts", fn: "authedGet", reason: "Wrapper exportado de transporte; o caminho vem do chamador." },
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoTransport.ts", fn: "authedPost", reason: "Wrapper exportado de transporte; o caminho vem do chamador." },
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoTransport.ts", fn: "authedPatch", reason: "Wrapper exportado de transporte; o caminho vem do chamador." },
  { kind: "UNRESOLVED_PATH", file: "apps/web/server/_core/nexoTransport.ts", fn: "authedGetPage.raw", reason: "Wrapper exportado de transporte; o caminho vem do chamador." },

  // --- fetch calls to services other than the NexoGestão API.
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/oauth.ts", fn: "exchangeCodeForTokens.tokenRes", reason: "Troca de código OAuth com o Google (GOOGLE_TOKEN_URL)." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/llm.ts", fn: "invokeLLM.response", reason: "Serviço de LLM (Forge/OpenAI)." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/imageGeneration.ts", fn: "generateImage.response", reason: "Serviço de geração de imagem (Forge)." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/map.ts", fn: "makeRequest.response", reason: "Serviço de mapas (Forge)." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/notification.ts", fn: "notifyOwner.response", reason: "Serviço de notificação do proprietário (Forge)." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/_core/voiceTranscription.ts", fn: "transcribeAudio.response", reason: "Download do áudio e serviço de transcrição (Forge); duas chamadas na mesma função." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/storage.ts", fn: "buildDownloadUrl.response", reason: "Proxy de armazenamento (Forge), URL de download." },
  { kind: "EXTERNAL_FETCH", file: "apps/web/server/storage.ts", fn: "storagePut.response", reason: "Proxy de armazenamento (Forge), upload." },

  // --- API routes intentionally reachable without a JWT and without @Public().
  { kind: "ROUTE_WITHOUT_ACCESS_DECLARATION", file: "apps/api/src/health/health.controller.ts", route: "GET /health", reason: "Health check público da plataforma (sem dados de tenant)." },
  { kind: "ROUTE_WITHOUT_ACCESS_DECLARATION", file: "apps/api/src/health/health.controller.ts", route: "GET /health/readiness", reason: "Healthcheck do deploy no Railway (healthcheckPath /v1/health/readiness)." },
  { kind: "ROUTE_WITHOUT_ACCESS_DECLARATION", file: "apps/api/src/health/health.controller.ts", route: "GET /health/liveness", reason: "Liveness probe público (sem dados de tenant)." },
  { kind: "ROUTE_WITHOUT_ACCESS_DECLARATION", file: "apps/api/src/payments/payments.controller.ts", route: "POST /payments/webhook/stripe", reason: "Webhook da Stripe autenticado pela assinatura (stripe-signature + constructEvent)." },
  { kind: "CALL_TO_UNDECLARED_ACCESS_ROUTE", file: "apps/web/server/routers/integrations.ts", fn: "integrationsRouter.readiness.raw", route: "GET /health/readiness", reason: "O BFF consulta o mesmo healthcheck público de readiness da API." },

  // --- Body fields the target DTO does not whitelist.
  {
    kind: "BODY_FIELD_NOT_IN_DTO",
    file: "apps/web/server/routers/customers.ts",
    fn: "customersRouter.update.response",
    route: "PATCH /customers/:id",
    field: "cpfCnpj",
    reason: "PENDÊNCIA C8 (decisão opção A, PR separado): o schema do BFF aceita cpfCnpj, mas UpdateCustomerDto não declara; a tela de edição não envia hoje. Corrigir DTO+UI ou remover do schema do BFF.",
  },
  {
    kind: "BODY_FIELD_NOT_IN_DTO",
    file: "apps/web/server/routers/customers.ts",
    fn: "customersRouter.update.response",
    route: "PATCH /customers/:id",
    field: "address",
    reason: "PENDÊNCIA C8 (decisão opção A, PR separado): o schema do BFF aceita address, mas UpdateCustomerDto não declara; a tela de edição não envia hoje. Corrigir DTO+UI ou remover do schema do BFF.",
  },
  {
    kind: "BODY_FIELD_NOT_IN_DTO",
    file: "apps/web/server/routers/whatsapp.ts",
    fn: "whatsappRouter.sendMessage",
    route: "POST /whatsapp/messages",
    field: "conversationId",
    reason: "Desvio de fluxo: com conversationId a função retorna antes por /whatsapp/conversations/:id/messages; nesta chamada ele é undefined e o JSON.stringify o omite.",
  },
];
