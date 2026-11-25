/*
 * THE OTHER SYSTEM A RECORD IS KEPT IN STEP WITH, as its page says it —
 * apart from `kept-in-step.ts`, which the compile reaches, so that only a
 * page that draws a record (`@graview/core/words`) carries it.
 */

type Loose = { readonly system?: unknown; readonly kind?: unknown };

/** What a record's page says of the other system that keeps it in step (`keptInStepWith`). */
export interface KeptInStepWith {
  /** The connection's name in the declaration. */
  readonly connection: string;
  readonly system: "notion" | "google-calendar" | "todoist";
  /** "Notion · Tasks", "Google Calendar", "Todoist": the system, and the data source by its name where the declaration names one. */
  readonly words: string;
  /** Where it is there: a record made from Todoist's opens at its task, and one made from a Notion page at its page; otherwise the database, when the declaration names it by id. */
  readonly href?: string;
}

const NOTION_HEX = /^[0-9a-f]{32}$/;
const notionHex = (id: string) => id.replace(/-/g, "").toLowerCase();

/**
 * THE OTHER SYSTEM A RECORD IS KEPT IN STEP WITH, said on its page: the
 * first connection that keeps its kind — a Notion data source (named, when
 * the declaration names it by its name), a Google calendar or a Todoist project — with a link
 * to the page in Notion where the record came from there (its id carries
 * the page's), else to the database. Read loosely from the declaration, as
 * `fieldsKeptInStep` is; undefined when nothing keeps the kind.
 */
export function keptInStepWith(connections: unknown, kind: string, id: string): KeptInStepWith | undefined {
  if (!connections || typeof connections !== "object") return undefined;
  for (const [name, raw] of Object.entries(connections as Record<string, Loose & { readonly sources?: unknown; readonly source?: unknown; readonly database?: unknown }>)) {
    if (!raw || typeof raw !== "object") continue;
    if (raw.system === "google-calendar" && raw.kind === kind) return { connection: name, system: "google-calendar", words: "Google Calendar" };
    if (raw.system === "todoist" && raw.kind === kind) {
      const task = id.startsWith(`${kind}:${name}-`) ? id.slice(`${kind}:${name}-`.length) : "";
      return { connection: name, system: "todoist", words: "Todoist", ...(/^[A-Za-z0-9]{6,}(?:-\d+)?$/.test(task) ? { href: `https://app.todoist.com/app/task/${task.split("-")[0]}` } : {}) };
    }
    if (raw.system !== "notion") continue;
    const sources = Array.isArray(raw.sources) ? (raw.sources as { readonly kind?: unknown; readonly source?: unknown }[]) : [{ kind: raw.kind, source: raw.source }];
    const source = sources.find((one) => one && one.kind === kind);
    if (!source) continue;
    const named = typeof source.source === "string" && !NOTION_HEX.test(notionHex(source.source)) ? source.source : undefined;
    const page = id.startsWith(`${kind}:${name}-`) ? id.slice(`${kind}:${name}-`.length) : undefined;
    const database = typeof raw.database === "string" ? notionHex(raw.database) : undefined;
    const at = page && NOTION_HEX.test(page) ? page : database && NOTION_HEX.test(database) ? database : undefined;
    return { connection: name, system: "notion", words: named ? `Notion · ${named}` : "Notion", ...(at ? { href: `https://www.notion.so/${at}` } : {}) };
  }
  return undefined;
}
