function randomPart() {
  return Math.random().toString(36).slice(2, 10)
}

export function buildIdempotencyKey(scope: string, entityId?: string | null) {
  return [scope, entityId || "-", Date.now().toString(36), randomPart()].join(":")
}
