export const SIDEBAR_COLLAPSED_WIDTH = 88;
export const SIDEBAR_EXPANDED_WIDTH = 292;
/** Below this width the app uses the mobile navigation (same as useIsMobile). */
export const SIDEBAR_MOBILE_BREAKPOINT = 768;
/** From this width the expanded sidebar takes real space instead of overlaying. */
export const SIDEBAR_PUSH_BREAKPOINT = 1280;

/**
 * - mobile: no desktop sidebar (bottom navigation + drawer).
 * - overlay: expanded sidebar floats over the page with a backdrop.
 * - push: expanded sidebar takes real space and the content follows it.
 */
export type SidebarMode = "mobile" | "overlay" | "push";

export type SidebarLayout = {
  mode: SidebarMode;
  sidebarWidth: number;
  contentOffset: number;
  showBackdrop: boolean;
  collapseOnNavigate: boolean;
  collapseOnEscape: boolean;
};

export function resolveSidebarMode(viewportWidth: number): SidebarMode {
  if (!Number.isFinite(viewportWidth) || viewportWidth < SIDEBAR_MOBILE_BREAKPOINT) {
    return "mobile";
  }
  return viewportWidth >= SIDEBAR_PUSH_BREAKPOINT ? "push" : "overlay";
}

export function resolveSidebarLayout(
  mode: SidebarMode,
  collapsed: boolean
): SidebarLayout {
  if (mode === "mobile") {
    return {
      mode,
      sidebarWidth: 0,
      contentOffset: 0,
      showBackdrop: false,
      collapseOnNavigate: false,
      collapseOnEscape: false,
    };
  }

  const sidebarWidth = collapsed ? SIDEBAR_COLLAPSED_WIDTH : SIDEBAR_EXPANDED_WIDTH;

  if (mode === "push") {
    return {
      mode,
      sidebarWidth,
      contentOffset: sidebarWidth,
      showBackdrop: false,
      collapseOnNavigate: false,
      collapseOnEscape: false,
    };
  }

  return {
    mode,
    sidebarWidth,
    contentOffset: SIDEBAR_COLLAPSED_WIDTH,
    showBackdrop: !collapsed,
    collapseOnNavigate: true,
    collapseOnEscape: true,
  };
}

/**
 * Each route mounts its own MainLayout, so the sidebar state is re-created on
 * every navigation. In push mode the user's choice to keep it expanded must
 * survive that remount; in every other mode it starts collapsed. Reloads
 * always start collapsed because the memory lives only in the current page.
 */
export function resolveInitialSidebarCollapsed(
  mode: SidebarMode,
  rememberedPushExpanded: boolean
): boolean {
  return !(mode === "push" && rememberedPushExpanded);
}
