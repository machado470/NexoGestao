import { describe, expect, it } from "vitest";
import { retryTransientRead } from "./read-query-retry";

describe("temporary read recovery", () => {
  it.each([408, 429, 500, 502, 503, 504])(
    "retries HTTP %s once",
    httpStatus => {
      const error = { data: { httpStatus } };
      expect(retryTransientRead(0, error)).toBe(true);
      expect(retryTransientRead(1, error)).toBe(false);
    }
  );
  it.each([400, 401, 403, 404, 409, 422])(
    "never repeats HTTP %s",
    httpStatus => {
      expect(
        retryTransientRead(0, {
          data: { httpStatus },
          message: "Failed to fetch",
        })
      ).toBe(false);
    }
  );
  it("recovers transport failures but does not retry unknown errors", () => {
    expect(retryTransientRead(0, new TypeError("Failed to fetch"))).toBe(true);
    expect(
      retryTransientRead(0, { cause: new TypeError("NetworkError") })
    ).toBe(true);
    expect(retryTransientRead(0, new Error("Invalid response"))).toBe(false);
    expect(retryTransientRead(0, null)).toBe(false);
    expect(
      retryTransientRead(0, {
        data: { code: "FORBIDDEN" },
        message: "Load failed",
      })
    ).toBe(false);
  });
});
