/**
 * WHERE A RECORD'S CHANGE STARTS: the record's own values for every field
 * its derived edit asks for (Roadmap f-edit-form-prefilled).
 *
 * "Change the feature" opened with "—" in every field, so a person changing
 * one fact could not see the others and a screen reader heard blanks. The
 * form starts from what the record holds; `changedArgs` sends only what was
 * changed from there, so the rest is left as it is and the change says only
 * what changed. Nothing for any other act, or a subject that is not there.
 *
 * A file of its own, apart from `form.ts`: the scene's ask reads these and
 * nothing else of a form, and a bundler places a whole file where it is
 * reached.
 */
export function editStart(
  mutation: { readonly derived?: { readonly act: string }; readonly subject?: { readonly arg: string }; readonly writes?: readonly string[] },
  graph: { getNode(id: string): Readonly<Record<string, unknown>> | undefined },
  args: Readonly<Record<string, unknown>>,
): Readonly<Record<string, unknown>> {
  const id = mutation.derived?.act === "edit" && mutation.subject ? args[mutation.subject.arg] : undefined;
  const node = typeof id === "string" ? graph.getNode(id) : undefined;
  return node ? Object.fromEntries((mutation.writes ?? []).filter((field) => node[field] !== undefined && node[field] !== null).map((field) => [field, node[field]])) : {};
}

/** What a form that started at `start` sends: every argument but those still as they started. */
export function changedArgs(args: Readonly<Record<string, unknown>>, start: Readonly<Record<string, unknown>>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(args).filter(([name, value]) => !Object.hasOwn(start, name) || JSON.stringify(value) !== JSON.stringify(start[name])));
}
