import { describe, expect, it } from "vitest";
import {
  isExpectedUnauthenticatedError,
  resolveAuthBootstrapState,
  type AuthBootstrapState,
} from "./AuthContext";

describe("AuthContext auth bootstrap state", () => {
  it("trata 401 como estado anônimo esperado", () => {
    const error401 = { data: { httpStatus: 401 } };
    const unauthorizedCode = { data: { code: "UNAUTHORIZED" } };

    expect(isExpectedUnauthenticatedError(error401)).toBe(true);
    expect(isExpectedUnauthenticatedError(unauthorizedCode)).toBe(true);
  });

  it("não classifica erro real de bootstrap como unauthenticated", () => {
    const backendError = { data: { httpStatus: 503, code: "INTERNAL_SERVER_ERROR" } };

    expect(isExpectedUnauthenticatedError(backendError)).toBe(false);
  });

  it.each<{
    input: Parameters<typeof resolveAuthBootstrapState>[0];
    expected: AuthBootstrapState;
  }>([
    {
      input: { isInitializing: true, bootstrapError: null, user: null },
      expected: "booting",
    },
    {
      input: { isInitializing: false, bootstrapError: null, user: null },
      expected: "unauthenticated",
    },
    {
      input: {
        isInitializing: false,
        bootstrapError: null,
        user: { id: "user-1", normalizedRole: null },
      },
      expected: "authenticated",
    },
    {
      input: {
        isInitializing: false,
        bootstrapError: new Error("backend down"),
        user: null,
      },
      expected: "failed",
    },
  ])("resolve estado global: $expected", ({ input, expected }) => {
    expect(resolveAuthBootstrapState(input)).toBe(expected);
  });
});
