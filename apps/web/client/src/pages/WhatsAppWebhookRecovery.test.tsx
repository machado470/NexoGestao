import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

import { DlqSummaryCards } from "./WhatsAppWebhookRecoveryPage";
import {
  buildSelectedReplayInput,
  buildSingleReplayInput,
  buildWebhookEventListParams,
  canReplayEvent,
  defaultWebhookFilters,
  filterEventsBySearch,
  forceReplayRequiresConfirmation,
  getMetadata,
  getOperationalState,
  type WebhookEvent,
} from "./WhatsAppWebhookRecovery.logic";

describe("WhatsApp webhook recovery UI", () => {
  it("renders DLQ stats summary cards", () => {
    const html = renderToStaticMarkup(
      <DlqSummaryCards
        statsPayload={{
          failedCount: 7,
          oldestFailedAgeSeconds: 7200,
          failedByProvider: { cloud: 5, twilio: 2 },
          failedByOrg: { org_a: 7 },
          retryAttemptsSummary: { max: 4, avg: 2 },
        }}
      />
    );

    expect(html).toContain("Falhas na DLQ");
    expect(html).toContain("7");
    expect(html).toContain("cloud: 5");
    expect(html).toContain("org_a: 7");
  });

  it("builds BFF filter params without leaking local search", () => {
    expect(
      buildWebhookEventListParams({
        ...defaultWebhookFilters,
        status: "FAILED",
        provider: " cloud ",
        traceId: " trace-1 ",
        providerMessageId: " wamid-1 ",
        createdAtFrom: "2026-05-01T10:00",
        createdAtTo: "2026-05-06T10:00",
        search: "database timeout",
      })
    ).toEqual({
      status: "FAILED",
      provider: "cloud",
      traceId: "trace-1",
      providerMessageId: "wamid-1",
      createdAtFrom: "2026-05-01T10:00",
      createdAtTo: "2026-05-06T10:00",
      cursor: undefined,
      limit: 50,
    });
  });

  it("renders event statuses and filters search locally", () => {
    const events: WebhookEvent[] = [
      { id: "evt_failed", status: "FAILED", provider: "cloud", errorMessage: "signature mismatch" },
      { id: "evt_processed", status: "PROCESSED", provider: "cloud" },
    ];

    expect(events.map(event => event.status)).toEqual(["FAILED", "PROCESSED"]);
    expect(filterEventsBySearch(events, "signature")).toEqual([events[0]]);
  });

  it("renders normalized metadata instead of raw payload", () => {
    const event: WebhookEvent = {
      id: "evt_1",
      payloadMetadata: { messageType: "text", phoneLast4: "1234" },
    };

    expect(getMetadata(event)).toEqual({ messageType: "text", phoneLast4: "1234" });
    expect(JSON.stringify(getMetadata(event))).not.toContain("rawPayload");
  });

  it("builds replay single mutation input", () => {
    const mutate = vi.fn();
    const input = buildSingleReplayInput({ id: "evt_failed", status: "FAILED" });

    mutate(input);

    expect(mutate).toHaveBeenCalledWith({ id: "evt_failed", force: undefined });
  });

  it("builds replay selected mutation input", () => {
    const mutate = vi.fn();
    const input = buildSelectedReplayInput([
      { id: "evt_failed", status: "FAILED" },
      { id: "evt_processed", status: "PROCESSED" },
      { id: "evt_received", status: "RECEIVED" },
    ]);

    mutate(input);

    expect(mutate).toHaveBeenCalledWith({ ids: ["evt_failed", "evt_processed"], force: true });
  });

  it("requires confirmation for force replay of non-FAILED processed events", () => {
    expect(canReplayEvent({ status: "FAILED" })).toBe(true);
    expect(forceReplayRequiresConfirmation({ status: "FAILED" })).toBe(false);
    expect(canReplayEvent({ status: "PROCESSED" })).toBe(true);
    expect(forceReplayRequiresConfirmation({ status: "PROCESSED" })).toBe(true);
  });

  it("maps loading, empty, error and ready states", () => {
    expect(getOperationalState({ isLoading: true, events: [] })).toBe("loading");
    expect(getOperationalState({ isError: true, events: [] })).toBe("error");
    expect(getOperationalState({ events: [] })).toBe("empty");
    expect(getOperationalState({ events: [{ id: "evt_1", status: "FAILED" }] })).toBe("ready");
  });
});
