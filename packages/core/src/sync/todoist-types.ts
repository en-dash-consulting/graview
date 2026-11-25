/*
 * What the parts of a Todoist task are to a Graview kind, apart from the
 * transport — so the checker (`graview check`) judges a declared mapping and
 * the connection runs it by one table.
 */

/** A task's parts, and the field types each may be held in. `parent` is not here: it is one of the kind's relations. */
export const TODOIST_FITS = {
  content: ["string", "text"],
  description: ["string", "text"],
  due: ["date", "datetime"],
  deadline: ["date"],
  priority: ["integer", "number", "enum"],
  labels: ["list"],
  section: ["string", "enum"],
  assignee: ["string", "email"],
  completed: ["boolean"],
} as const satisfies Readonly<Record<string, readonly string[]>>;

export type TodoistPart = keyof typeof TODOIST_FITS;

/**
 * The priority an option names, as people see it in Todoist: 1 (p1, the most
 * urgent) to 4 (p4, no priority). Todoist's API numbers them the other way
 * ("p1 will return 4 in the API", developer.todoist.com/api/v1/sync/tasks.md);
 * the transport turns them over.
 */
export function todoistPriorityOf(option: string): number | undefined {
  const word = option.toLowerCase().replace(/[^a-z0-9]/g, "");
  const said = /^p?([1-4])$/.exec(word);
  if (said) return Number(said[1]);
  return ({ urgent: 1, veryurgent: 1, high: 2, medium: 3, low: 4, normal: 4, none: 4 } as Record<string, number>)[word];
}

/** An enum's options by priority, when they name each of the four once; undefined when they do not. */
export function todoistPriorities(options: readonly string[]): ReadonlyMap<number, string> | undefined {
  const named = new Map<number, string>();
  for (const option of options) {
    const priority = todoistPriorityOf(option);
    if (priority === undefined || named.has(priority)) return undefined;
    named.set(priority, option);
  }
  return named.size === 4 ? named : undefined;
}

/** A personal API token as Todoist writes one (40 hexadecimal characters): never in a document. */
export const TODOIST_SECRET = /(?:^|[^A-Za-z0-9])[0-9a-f]{40}(?![A-Za-z0-9])/i;

/** The environment prefix a Todoist connection's token is read under: `<prefix>_TOKEN`. */
export const TODOIST_AUTH_ENV = "TODOIST";
