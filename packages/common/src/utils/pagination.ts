export function getPagination(page: number = 1, limit: number = 10) {
  const skip = (page - 1) * limit;
  const take = limit;
  return { skip, take };
}
