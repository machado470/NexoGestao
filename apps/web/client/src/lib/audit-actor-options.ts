type Person = { id: string; name?: string | null; email?: string | null };
type HistoricalActor = { actorPersonId?: string | null; actorName?: string | null };

/** Merge only authorized sources, retaining the API's person ID as option value. */
export function buildAuditActorOptions(
  people: Person[], summary: HistoricalActor[], events: HistoricalActor[], selectedId = ""
): Array<{ id: string; label: string }> {
  const options = new Map<string, { id: string; label: string; named: boolean }>();
  const add = (id: string | null | undefined, name?: string | null, secondary?: string | null) => {
    if (!id) return;
    const named = Boolean(name?.trim());
    const previous = options.get(id);
    if (previous && (previous.named || !named)) return;
    options.set(id, { id, label: `${name?.trim() || "Ator não identificado"} · ${secondary || id}`, named });
  };
  people.forEach(person => add(person.id, person.name, person.email));
  summary.forEach(actor => add(actor.actorPersonId, actor.actorName));
  events.forEach(actor => add(actor.actorPersonId, actor.actorName));
  add(selectedId);
  return Array.from(options.values(), ({ id, label }) => ({ id, label }));
}
