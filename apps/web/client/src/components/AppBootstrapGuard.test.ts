import { describe, expect, it } from "vitest";
import type { AppBootstrapState } from "./AppBootstrapGuard";

describe("AppBootstrapGuard", () => {
  it("mantém estados de bootstrap explícitos", () => {
    const states: AppBootstrapState[] = [
      "initializing",
      "unauthenticated",
      "authenticated",
      "error",
    ];

    expect(states).toEqual([
      "initializing",
      "unauthenticated",
      "authenticated",
      "error",
    ]);
  });
});
