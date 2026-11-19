import { can, type Permission, type Role } from "./rbac";

export function canVisitMobileRoute(role: Role | null, target: string) {
  if (!role || !target.startsWith("/") || target.startsWith("//")) return false;
  const path = target.split(/[?#]/)[0];
  const required: Record<string, Permission> = {
    "/customers": "customers:read",
    "/appointments": "appointments:read",
    "/calendar": "appointments:read",
    "/service-orders": "orders:read",
    "/quotes": "catalog:read",
    "/service-catalog": "catalog:read",
    "/inventory": "inventory:manage",
    "/fiscal": "fiscal:manage",
    "/financial-health": "financial-health:read",
    "/finances": "finance:read",
    "/timeline": "reports:read",
    "/governance": "governance:read",
    "/people": "people:manage",
    "/settings": "settings:manage",
  };
  const route = Object.keys(required).find(
    key => path === key || path.startsWith(key + "/")
  );
  if (route) return can(role, required[route]);
  return ["/executive-dashboard", "/whatsapp", "/profile"].includes(path);
}
