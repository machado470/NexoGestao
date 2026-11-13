import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Router } from "wouter";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AuthServiceGate } from "./AuthServiceGate";
import { shouldBootstrapSessionForPath } from "@/lib/routeAccess";

afterEach(() => vi.unstubAllEnvs());

describe("auth availability on static hosting", () => {
  it("does not mount credential forms or auth side effects on Pages", () => {
    vi.stubEnv("VITE_STATIC_HOSTING", "true");
    const mountAuth = vi.fn();
    function AuthForm() {
      mountAuth();
      return (
        <form>
          <input type="password" />
        </form>
      );
    }
    const html = renderToStaticMarkup(
      <Router base="/NexoGestao" ssrPath="/NexoGestao/login" ssrSearch="">
        <AuthServiceGate>
          <AuthForm />
        </AuthServiceGate>
      </Router>
    );

    expect(mountAuth).not.toHaveBeenCalled();
    expect(html).toContain("Acesso à plataforma indisponível");
    expect(html).toContain('href="/NexoGestao/produto"');
    expect(html).not.toContain("<form");
  });

  it.each(["false", ""])(
    "keeps real authentication when static hosting is %j",
    value => {
      vi.stubEnv("VITE_STATIC_HOSTING", value);
      const html = renderToStaticMarkup(
        <AuthServiceGate>
          <form>
            <input type="password" />
          </form>
        </AuthServiceGate>
      );
      expect(html).toContain("<form");
      expect(html).not.toContain("Acesso à plataforma indisponível");
      expect(shouldBootstrapSessionForPath("/login")).toBe(true);
      expect(shouldBootstrapSessionForPath("/executive-dashboard")).toBe(true);
    }
  );

  it.each([
    "/",
    "/login",
    "/register",
    "/auth/confirm-email",
    "/executive-dashboard",
  ])("does not request sessions without a backend at %s", path => {
    vi.stubEnv("VITE_STATIC_HOSTING", "true");
    expect(shouldBootstrapSessionForPath(path)).toBe(false);
  });
});
