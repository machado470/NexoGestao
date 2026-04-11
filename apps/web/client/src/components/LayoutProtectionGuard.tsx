import { useEffect, type CSSProperties } from "react";

const ROOT_SELECTORS = [".app-root", ".nexo-app-shell", ".nexo-app-content"];
const FORBIDDEN_STYLE_PROPERTIES = [
  "transform",
  "filter",
  "backdropFilter",
] as const;

type ForbiddenComputedStyle = "transform" | "filter" | "backdrop-filter";

function isAllowedComputedValue(
  property: ForbiddenComputedStyle,
  value: string
) {
  if (!value) return true;

  const normalized = value.trim().toLowerCase();
  if (!normalized || normalized === "none") return true;

  if (property === "backdrop-filter") {
    return normalized === "none";
  }

  return false;
}

function hasForbiddenGlobalClassName(className: string) {
  return /(\btransform\b|\bfilter\b|\bbackdrop-(blur|brightness|contrast|grayscale|hue-rotate|invert|opacity|saturate|sepia)\b|\boverflow-hidden\b)/.test(
    className
  );
}

export function LayoutProtectionGuard() {
  useEffect(() => {
    if (!import.meta.env.DEV || typeof document === "undefined") return;

    const warn = (message: string, details: Record<string, unknown>) => {
      console.warn(`[LayoutProtection] ${message}`, details);
    };

    const checkGlobals = () => {
      ROOT_SELECTORS.forEach(selector => {
        document.querySelectorAll<HTMLElement>(selector).forEach(node => {
          const styles = window.getComputedStyle(node);

          if (!isAllowedComputedValue("transform", styles.transform)) {
            warn("Transform global detectado em wrapper raiz.", {
              selector,
              transform: styles.transform,
            });
          }

          if (!isAllowedComputedValue("filter", styles.filter)) {
            warn("Filter global detectado em wrapper raiz.", {
              selector,
              filter: styles.filter,
            });
          }

          if (
            !isAllowedComputedValue("backdrop-filter", styles.backdropFilter)
          ) {
            warn("Backdrop-filter global detectado em wrapper raiz.", {
              selector,
              backdropFilter: styles.backdropFilter,
            });
          }

          if (styles.overflow === "hidden" && selector === ".app-root") {
            warn("Overflow hidden global detectado no wrapper raiz.", {
              selector,
              overflow: styles.overflow,
            });
          }

          if (hasForbiddenGlobalClassName(node.className)) {
            warn("Classe proibida detectada em wrapper raiz.", {
              selector,
              className: node.className,
            });
          }
        });
      });

      if (document.body.style.overflow === "hidden") {
        warn("Body com overflow hidden global detectado.", {
          overflow: document.body.style.overflow,
        });
      }
    };

    const observer = new MutationObserver(checkGlobals);
    observer.observe(document.documentElement, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["class", "style"],
    });

    checkGlobals();

    return () => observer.disconnect();
  }, []);

  return null;
}

export function sanitizeRootWrapperStyle(style?: CSSProperties) {
  if (!style) return undefined;

  const nextStyle = { ...style };
  let changed = false;

  FORBIDDEN_STYLE_PROPERTIES.forEach(property => {
    if (property in nextStyle) {
      delete nextStyle[property];
      changed = true;
    }
  });

  if (nextStyle.overflow === "hidden") {
    delete nextStyle.overflow;
    changed = true;
  }

  if (!changed) return style;

  if (import.meta.env.DEV) {
    console.warn(
      "[LayoutProtection] Estilo proibido removido de wrapper raiz.",
      style
    );
  }

  return nextStyle;
}
