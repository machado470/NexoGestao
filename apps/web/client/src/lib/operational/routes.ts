export type OperationalRouteFilters = Record<string, string | number | boolean | null | undefined>;

export function buildOperationalRoute(path: string, filters?: OperationalRouteFilters): string {
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  if (!filters) return cleanPath;

  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    params.set(key, String(value));
  });

  const query = params.toString();
  return query ? `${cleanPath}?${query}` : cleanPath;
}
