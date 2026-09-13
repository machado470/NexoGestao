import { z } from "zod";
import { protectedProcedure, router } from "../_core/trpc";
import { authedGet, authedPost, type NexoContext } from "../_core/nexoTransport";

const operationalActionType = z.enum(["RETRY_WHATSAPP_MESSAGE", "SEND_PAYMENT_REMINDER", "RECALCULATE_RISK", "RUN_GOVERNANCE_CHECK"]);
const operationalActionInput = z.object({
  actionType: operationalActionType,
  entityType: z.string().min(1),
  entityId: z.string().min(1),
  sourceSignalId: z.string().min(1).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
}).strict();
const operationalResult = z.object({ actionType: operationalActionType, status: z.enum(["REQUESTED", "EXECUTING", "EXECUTED", "FAILED", "CANCELED"]) }).passthrough();
const queueStatus = z.object({ queue: z.string(), waiting: z.number(), active: z.number(), completed: z.number(), failed: z.number(), delayed: z.number(), degraded: z.boolean(), degradedReasons: z.array(z.string()) });
const dlqStatus = z.object({ queue: z.string(), backlog: z.number(), failed: z.number(), lastFailureAt: z.string().nullable() });
const incident = z.object({ id: z.string(), severity: z.enum(["INFO", "WARNING", "CRITICAL"]), code: z.string(), title: z.string(), description: z.string(), source: z.string(), createdAt: z.string() });
const operationsSummary = z.object({
  status: z.enum(["ok", "degraded"]), degradedReasons: z.array(z.string()),
  metrics: z.object({ retries: z.number(), failedJobs: z.number(), failedWebhooks: z.number() }),
  queues: z.array(queueStatus), dlq: z.array(dlqStatus),
  recoveryActions: z.array(z.object({ id: z.string(), label: z.string(), method: z.literal("POST"), available: z.boolean() }).passthrough()),
}).passthrough();

const tenantFactStatus = z.enum(["available", "unavailable", "not_configured", "unknown"]);
const tenantFactBase = {
  status: tenantFactStatus,
  observedAt: z.string().datetime(),
  reasonCode: z.string().nullable(),
};
const resourcesFact = z.object({
  key: z.literal("resources"), ...tenantFactBase,
  facts: z.object({
    customersVolume: z.number().int().nonnegative().nullable(), customersUpdatedAt: z.string().datetime().nullable(),
    appointmentsVolume: z.number().int().nonnegative().nullable(), appointmentsUpdatedAt: z.string().datetime().nullable(),
    serviceOrdersVolume: z.number().int().nonnegative().nullable(), serviceOrdersUpdatedAt: z.string().datetime().nullable(),
    chargesVolume: z.number().int().nonnegative().nullable(), chargesUpdatedAt: z.string().datetime().nullable(),
    paymentsVolume: z.number().int().nonnegative().nullable(), paymentsUpdatedAt: z.string().datetime().nullable(),
  }).strict(),
}).strict();
const whatsappFact = z.object({
  key: z.literal("whatsapp"), ...tenantFactBase,
  facts: z.object({ failedMessages: z.number().int().nonnegative().nullable() }).strict(),
}).strict();
const webhooksFact = z.object({
  key: z.literal("webhooks"), ...tenantFactBase,
  facts: z.object({
    configuredEndpoints: z.number().int().nonnegative().nullable(), activeEndpoints: z.number().int().nonnegative().nullable(),
    pendingDeliveries: z.number().int().nonnegative().nullable(), successfulDeliveries: z.number().int().nonnegative().nullable(),
    failedDeliveries: z.number().int().nonnegative().nullable(),
  }).strict(),
}).strict();
const billingFact = z.object({
  key: z.literal("billing"), ...tenantFactBase,
  facts: z.object({ subscriptionStatus: z.string().nullable() }).strict(),
}).strict();
const operationConfigFact = z.object({
  key: z.literal("operation_config"), ...tenantFactBase,
  facts: z.object({ executionMode: z.string().nullable(), updatedAt: z.string().datetime().nullable() }).strict(),
}).strict();

export const tenantOperationsSummary = z.object({
  contractVersion: z.literal(1),
  generatedAt: z.string().datetime(),
  facts: z.tuple([resourcesFact, whatsappFact, webhooksFact, billingFact, operationConfigFact]),
}).strict();

export const operationsRouter = router({
    tenantSummary: protectedProcedure.output(tenantOperationsSummary).query(({ ctx }) => authedGet(ctx as NexoContext, "/v1/operations/tenant-summary")),
    summary: protectedProcedure.output(operationsSummary).query(({ ctx }) => authedGet(ctx as NexoContext, "/internal/operations/summary")),
    incidents: protectedProcedure.output(z.array(incident)).query(({ ctx }) => authedGet(ctx as NexoContext, "/internal/operations/incidents")),
    queues: protectedProcedure.output(z.array(queueStatus)).query(({ ctx }) => authedGet(ctx as NexoContext, "/internal/operations/queues")),
    dlq: protectedProcedure.output(z.array(dlqStatus)).query(({ ctx }) => authedGet(ctx as NexoContext, "/internal/operations/dlq")),
    diagnostics: protectedProcedure.query(({ ctx }) => authedGet(ctx as NexoContext, "/internal/operational-actions/diagnostics")),
    requestAction: protectedProcedure.input(operationalActionInput).output(operationalResult).mutation(({ ctx, input }) => authedPost(ctx as NexoContext, "/internal/operational-actions/request", input)),
    executeAction: protectedProcedure.input(operationalActionInput).output(operationalResult).mutation(({ ctx, input }) => authedPost(ctx as NexoContext, "/internal/operational-actions/execute", input)),
    cancelAction: protectedProcedure.input(operationalActionInput).output(operationalResult).mutation(({ ctx, input }) => authedPost(ctx as NexoContext, "/internal/operational-actions/cancel", input)),
    recoverAction: protectedProcedure.input(z.object({ executionId: z.string().min(1), recoveryReason: z.string().optional() }).strict()).mutation(({ ctx, input }) => authedPost(ctx as NexoContext, "/internal/operational-actions/recover-stuck", input)),
    webhookDeliveries: protectedProcedure.input(z.object({ status: z.enum(["PENDING", "PROCESSING", "SUCCESS", "FAILED"]).optional(), limit: z.number().int().min(1).max(100).optional() }).strict().optional()).query(({ ctx, input }) => authedGet(ctx as NexoContext, "/webhooks/deliveries", input ?? {})),
    replayWebhook: protectedProcedure.input(z.object({ deliveryId: z.string().min(1) }).strict()).mutation(({ ctx, input }) => authedPost(ctx as NexoContext, `/webhooks/deliveries/${input.deliveryId}/replay`)),
  })
