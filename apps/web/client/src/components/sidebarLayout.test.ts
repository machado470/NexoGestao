import { describe, expect, it } from "vitest";
import {
  SIDEBAR_COLLAPSED_WIDTH,
  SIDEBAR_EXPANDED_WIDTH,
  resolveInitialSidebarCollapsed,
  resolveSidebarLayout,
  resolveSidebarMode,
  resolveSidebarToggleA11y,
  SIDEBAR_NAV_ID,
} from "./sidebarLayout";

describe("resolveSidebarMode", () => {
  it.each([
    [320, "mobile"],
    [390, "mobile"],
    [767, "mobile"],
    [768, "overlay"],
    [1024, "overlay"],
    [1279, "overlay"],
    [1280, "push"],
    [1440, "push"],
    [1920, "push"],
  ] as const)("%ipx -> %s", (width, mode) => {
    expect(resolveSidebarMode(width)).toBe(mode);
  });

  it("falls back to mobile for invalid widths", () => {
    expect(resolveSidebarMode(Number.NaN)).toBe("mobile");
  });
});

describe("resolveSidebarLayout", () => {
  it("keeps mobile free of desktop sidebar behaviour", () => {
    for (const collapsed of [true, false]) {
      expect(resolveSidebarLayout("mobile", collapsed)).toEqual({
        mode: "mobile",
        sidebarWidth: 0,
        contentOffset: 0,
        showBackdrop: false,
        collapseOnNavigate: false,
        collapseOnEscape: false,
      });
    }
  });

  it("overlay: content stays at the collapsed width and expanded sidebar floats with a backdrop", () => {
    expect(resolveSidebarLayout("overlay", true)).toMatchObject({
      sidebarWidth: SIDEBAR_COLLAPSED_WIDTH,
      contentOffset: SIDEBAR_COLLAPSED_WIDTH,
      showBackdrop: false,
    });
    expect(resolveSidebarLayout("overlay", false)).toEqual({
      mode: "overlay",
      sidebarWidth: SIDEBAR_EXPANDED_WIDTH,
      contentOffset: SIDEBAR_COLLAPSED_WIDTH,
      showBackdrop: true,
      collapseOnNavigate: true,
      collapseOnEscape: true,
    });
  });

  it("push: content follows the sidebar width with no backdrop or auto-collapse", () => {
    expect(resolveSidebarLayout("push", true)).toEqual({
      mode: "push",
      sidebarWidth: SIDEBAR_COLLAPSED_WIDTH,
      contentOffset: SIDEBAR_COLLAPSED_WIDTH,
      showBackdrop: false,
      collapseOnNavigate: false,
      collapseOnEscape: false,
    });
    expect(resolveSidebarLayout("push", false)).toEqual({
      mode: "push",
      sidebarWidth: SIDEBAR_EXPANDED_WIDTH,
      contentOffset: SIDEBAR_EXPANDED_WIDTH,
      showBackdrop: false,
      collapseOnNavigate: false,
      collapseOnEscape: false,
    });
  });

  it("never lets the expanded sidebar cover content in push mode", () => {
    for (const collapsed of [true, false]) {
      const layout = resolveSidebarLayout("push", collapsed);
      expect(layout.contentOffset).toBe(layout.sidebarWidth);
    }
  });
});

describe("resolveInitialSidebarCollapsed", () => {
  it("keeps the expanded sidebar across route remounts only in push mode", () => {
    expect(resolveInitialSidebarCollapsed("push", true)).toBe(false);
    expect(resolveInitialSidebarCollapsed("push", false)).toBe(true);
  });

  it("always starts collapsed in overlay and mobile", () => {
    for (const remembered of [true, false]) {
      expect(resolveInitialSidebarCollapsed("overlay", remembered)).toBe(true);
      expect(resolveInitialSidebarCollapsed("mobile", remembered)).toBe(true);
    }
  });
});

describe("resolveSidebarToggleA11y", () => {
  it("announces the collapsed sidebar as expandable and controls the nav", () => {
    expect(resolveSidebarToggleA11y(true)).toEqual({
      "aria-label": "Expandir menu lateral",
      "aria-expanded": false,
      "aria-controls": SIDEBAR_NAV_ID,
      title: "Expandir menu lateral",
    });
  });

  it("announces the expanded sidebar as collapsible", () => {
    expect(resolveSidebarToggleA11y(false)).toMatchObject({
      "aria-label": "Recolher menu lateral",
      "aria-expanded": true,
      "aria-controls": SIDEBAR_NAV_ID,
    });
  });
});
