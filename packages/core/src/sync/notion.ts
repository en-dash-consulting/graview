import type { Fetcher } from "./google-calendar.js";
import { NOTION_FITS, NOTION_LEFT_ALONE, NOTION_READ_ONLY, notionFits } from "./notion-types.js";
import type { RemoteAck, RemoteChange, RemoteSystem, RemoteWrite } from "./types.js";

/**
 * A Notion database, as a transport.
 *
 * One data source of a database is one resource (`pages`), and each of its
 * pages one record. A database holds one data source, or several (since
 * Notion's 2025-09-03 API, a database may gather several tables under one
 * name); a database of one is read through it, and one of several is named
 * by `source`, its name or its id, or refused with a sentence naming them.
 * Everything Notion-specific is here — property objects, `last_edited_time`,
 * `has_more`, `archived` — and the engine sees plain values keyed by the
 * names its mapping uses:
 *
 * - A property is named by its name in Notion, matched as written and then
 *   ignoring case, spaces and punctuation ("dueDate" finds "Due date"); a
 *   `titleRef` that matches no property is the database's title. A name
 *   that finds no property, or one of a type its field cannot hold, is left
 *   out and said once (`say`).
 * - Values are plain: words for a title, rich text, select, status, URL,
 *   email and phone; a number; `true`/`false`; a list of names for a
 *   multi-select and for people (read only — never written); a date's start,
 *   a day or an instant as Notion has it. An empty property is `null`.
 * - A PULL asks for the pages edited since the last one it saw, oldest
 *   first, following `next_cursor` to the end; without a cursor, and every
 *   `sweepEvery`, it reads the whole database, and a page it knew (`known`)
 *   that is no longer there — archived, in the trash, moved out — is gone.
 * - A version is the page's `last_edited_time` (Notion keeps it to the
 *   minute) with a hash of its values, so our own write coming back is an
 *   echo and somebody's edit within the same minute is still news.
 * - A PUSH makes a page in the database, sets the properties of one, or
 *   archives one. Words go as plain text, cut into Notion's 2000-character
 *   pieces.
 * - Notion asking us to slow down (429) is waited out as its `Retry-After`
 *   says, within a bound; a refused secret (401) and a database the
 *   integration cannot see (404) are said as sentences that say what to do.
 */

export const NOTION_API = "https://api.notion.com/v1";
export const NOTION_VERSION = "2025-09-03";

export interface NotionOptions {
  /** The database's id: the 32 characters in its link, before `?v=`. */
  readonly databaseId: string;
  /** The data source to keep in step, by its name or id, when the database holds several. */
  readonly source?: string;
  /** The internal integration's secret, asked before every request. */
  token(): Promise<string> | string;
  /** What the secret is called where it is kept (`NOTION_TOKEN`), for the sentence a refusal says. Never its value. */
  readonly secretName?: string;
  readonly fetch?: Fetcher;
  readonly baseUrl?: string;
  /** Pages per request of a pull (Notion allows up to 100). Every page is followed. */
  readonly pageSize?: number;
  /**
   * The names the mapping uses, each with the type of the field it lands
   * in (absent when any type is welcome). Absent: every property Notion
   * keeps in step, by its own name.
   */
  readonly refs?: Readonly<Record<string, string | undefined>>;
  /** A name that, finding no property of its own, is the database's title. */
  readonly titleRef?: string;
  /** The pages this sync has linked, by Notion's id, so a full read can tell which are gone. */
  known?(): readonly string[];
  /** How often a pull reads the whole database to see what was archived, in ms (10 minutes by default). */
  readonly sweepEvery?: number;
  /** The longest a run waits out Notion's rate limit, in ms (60 seconds by default). */
  readonly maxWait?: number;
  /** A note said once: a name that finds no property, a property left alone. */
  say?(line: string): void;
  now?(): number;
  sleep?(ms: number): Promise<void>;
}

/** What Notion answered, when it was not a yes. */
export class NotionError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly code?: string,
  ) {
    super(message);
    this.name = "NotionError";
  }
}

type Json = Record<string, unknown>;
interface Property {
  readonly name: string;
  readonly type: string;
  /** A select's, a multi-select's or a status's options, by name. */
  readonly options: readonly string[];
}

/** A value written as the option the property already has, where one is the same words ("in-progress" is "In progress"). */
function asOption(property: Property, value: unknown): unknown {
  const one = (word: unknown) => (typeof word === "string" ? (property.options.find((option) => option === word) ?? property.options.find((option) => loose(option) === loose(word)) ?? word) : word);
  return Array.isArray(value) ? value.map(one) : one(value);
}

const MOST_TEXT = 2000;
const MOST_PIECES = 100;
const DEFAULT_SWEEP = 10 * 60 * 1000;

/** The same id however it was written: lower case, no hyphens. */
export const notionKey = (id: string) => id.replace(/-/g, "").toLowerCase();
/** A name compared loosely: "Due date", "dueDate" and "due_date" are one. */
const loose = (name: string) => name.toLowerCase().replace(/[^a-z0-9]/g, "");

/** A property's value, plain. */
export function notionValue(property: Json): unknown {
  const type = String(property["type"] ?? "");
  const raw = property[type];
  switch (type) {
    case "title":
    case "rich_text": {
      const text = ((raw as Json[] | undefined) ?? []).map((part) => String(part["plain_text"] ?? (part["text"] as Json | undefined)?.["content"] ?? "")).join("");
      return text === "" ? null : text;
    }
    case "number":
      return typeof raw === "number" ? raw : null;
    case "select":
    case "status":
      return raw && typeof raw === "object" ? ((raw as Json)["name"] ?? null) : null;
    case "multi_select": {
      const names = ((raw as Json[] | undefined) ?? []).map((option) => String(option["name"]));
      return names.length > 0 ? names : null;
    }
    case "date":
      return raw && typeof raw === "object" ? ((raw as Json)["start"] ?? null) : null;
    case "checkbox":
      return raw === true;
    case "url":
    case "email":
    case "phone_number":
      return typeof raw === "string" && raw !== "" ? raw : null;
    case "people": {
      const names = ((raw as Json[] | undefined) ?? []).map((person) => String(person["name"] ?? person["id"]));
      return names.length > 0 ? names : null;
    }
    default:
      return undefined;
  }
}

/** Words as Notion's rich text: plain, in pieces of at most 2000 characters, a pair of surrogates never split. */
export function notionText(value: unknown): Json[] {
  const text = value === null || value === undefined ? "" : Array.isArray(value) ? value.join(", ") : String(value);
  const pieces: Json[] = [];
  for (let at = 0; at < text.length; ) {
    let end = Math.min(at + MOST_TEXT, text.length);
    const last = text.charCodeAt(end - 1);
    if (end < text.length && last >= 0xd800 && last <= 0xdbff) end -= 1;
    pieces.push({ type: "text", text: { content: text.slice(at, end) } });
    at = end;
  }
  if (pieces.length > MOST_PIECES) {
    throw new Error(`notion: ${text.length} characters is more than a Notion property holds (${MOST_TEXT * MOST_PIECES})`);
  }
  return pieces;
}

/** A plain value as the property object Notion takes, for a property of `type`. */
export function notionProperty(type: string, value: unknown): Json {
  const empty = value === null || value === undefined || value === "";
  switch (type) {
    case "title":
    case "rich_text":
      return { [type]: notionText(value) };
    case "number":
      return { number: empty ? null : Number(value) };
    case "select":
    case "status":
      return { [type]: empty ? null : { name: String(value) } };
    case "multi_select":
      return { multi_select: empty ? [] : (Array.isArray(value) ? value : [value]).map((name) => ({ name: String(name) })) };
    case "date":
      return { date: empty ? null : { start: String(value) } };
    case "checkbox":
      return { checkbox: value === true };
    case "url":
    case "email":
    case "phone_number":
      return { [type]: empty ? null : String(value) };
    default:
      throw new Error(`notion: a ${type} property is not written from here`);
  }
}

/** A short, stable hash of a page's values: what makes an edit in the same minute as ours news. */
function hashOf(values: Json): string {
  const text = JSON.stringify(Object.keys(values).sort().map((key) => [key, values[key] ?? null]));
  let hash = 0x811c9dc5;
  for (let at = 0; at < text.length; at++) {
    hash ^= text.charCodeAt(at);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** Every value Notion keeps in step on a page, by property name. */
function valuesOf(page: Json): Json {
  const out: Json = {};
  for (const [name, property] of Object.entries((page["properties"] as Record<string, Json> | undefined) ?? {})) {
    if (!NOTION_FITS[String(property["type"])]) continue;
    out[name] = notionValue(property);
  }
  return out;
}

/** A page's version: when it was last edited, and what it holds. */
export function notionVersion(page: Json): string {
  return `${String(page["last_edited_time"] ?? "")}~${hashOf(valuesOf(page))}`;
}

interface Cursor {
  readonly since?: string;
  readonly swept: number;
}
const readCursor = (cursor: string | undefined): Cursor | undefined => {
  if (!cursor) return undefined;
  try {
    const parsed = JSON.parse(cursor) as Partial<Cursor>;
    return typeof parsed.swept === "number" ? { swept: parsed.swept, ...(typeof parsed.since === "string" ? { since: parsed.since } : {}) } : undefined;
  } catch {
    return undefined;
  }
};

export function notion(options: NotionOptions): RemoteSystem {
  const doFetch = options.fetch ?? (globalThis.fetch as Fetcher);
  const base = options.baseUrl ?? NOTION_API;
  const databaseId = options.databaseId;
  const secret = options.secretName ?? "the integration's secret";
  const now = options.now ?? (() => Date.now());
  const sleep = options.sleep ?? ((ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms)));
  const maxWait = options.maxWait ?? 60_000;
  const said = new Set<string>();
  const note = (line: string) => {
    if (said.has(line)) return;
    said.add(line);
    options.say?.(line);
  };

  /** One request, Notion's rate limit waited out; anything but a yes thrown as a `NotionError`. */
  const call = async (method: string, path: string, body?: Json): Promise<Json> => {
    let waited = 0;
    for (;;) {
      const response = await doFetch(`${base}${path}`, {
        method,
        headers: {
          authorization: `Bearer ${await options.token()}`,
          "notion-version": NOTION_VERSION,
          "content-type": "application/json",
        },
        ...(body ? { body: JSON.stringify(body) } : {}),
      });
      if (response.status === 429) {
        const after = Number(response.headers?.get("retry-after") ?? "");
        const wait = Math.min(Number.isFinite(after) && after > 0 ? after * 1000 : 1000, maxWait);
        if (waited + wait > maxWait) throw new NotionError(`notion: Notion is still limiting the rate after ${Math.round(waited / 1000)} s of waiting (HTTP 429); the next pass tries again`, 429, "rate_limited");
        waited += wait;
        await sleep(wait);
        continue;
      }
      const answer = (await response.json().catch(() => ({}))) as Json;
      if (response.ok) return answer;
      const code = typeof answer["code"] === "string" ? answer["code"] : undefined;
      const said = typeof answer["message"] === "string" ? answer["message"] : "";
      if (response.status === 401) {
        throw new NotionError(`notion: Notion refused ${secret} (HTTP 401): it is not an integration secret Notion takes — copy the Internal Integration Secret from the integration's page again`, 401, code);
      }
      if (response.status === 403) {
        throw new NotionError(`notion: the integration may not do this (HTTP 403): give it the capabilities to read, update and insert content`, 403, code);
      }
      throw new NotionError(`notion: HTTP ${response.status}${code ? ` ${code}` : ""}${said ? `: ${said}` : ""}`, response.status, code);
    }
  };

  /** The data source this connection keeps in step: the database's only one, or the one `source` names. */
  let sourceId: string | undefined;
  const dataSource = async (): Promise<string> => {
    if (sourceId) return sourceId;
    let answer: Json;
    try {
      answer = await call("GET", `/databases/${encodeURIComponent(databaseId)}`);
    } catch (error) {
      if (error instanceof NotionError && error.status === 404) {
        throw new NotionError(
          `notion: the integration cannot see a database ${databaseId} (HTTP 404): share the database with the integration — in Notion, the database's ••• menu → Connections → add it`,
          404,
          error.code,
        );
      }
      if (error instanceof NotionError && error.status === 400) {
        throw new NotionError(`notion: ${databaseId} is not a database id Notion takes (HTTP 400) — the id is the 32 characters in the database's link, before ?v=${error.message.replace(/^notion: HTTP 400[^:]*/, "")}`, 400, error.code);
      }
      throw error;
    }
    const sources = ((answer["data_sources"] as Json[] | undefined) ?? []).map((one) => ({ id: String(one["id"]), name: String(one["name"] ?? "") }));
    const title = ((answer["title"] as Json[] | undefined) ?? []).map((part) => String(part["plain_text"] ?? "")).join("") || databaseId;
    const named = options.source;
    const chosen = named
      ? (sources.find((one) => notionKey(one.id) === notionKey(named)) ?? sources.find((one) => one.name === named) ?? sources.find((one) => loose(one.name) === loose(named)))
      : sources.length === 1
        ? sources[0]
        : undefined;
    if (!chosen) {
      const list = sources.map((one) => one.name || one.id).join(", ");
      throw new NotionError(
        named
          ? `notion: the database ${title} has no data source ${named}; it holds ${list || "none"}`
          : `notion: the database ${title} holds ${sources.length} data sources — ${list} — so the connection says which with source`,
        400,
        "validation_error",
      );
    }
    sourceId = chosen.id;
    return chosen.id;
  };

  /** The data source's properties, by name — and a sentence when the integration cannot see it. */
  let schema: Map<string, Property> | undefined;
  const database = async (): Promise<Map<string, Property>> => {
    const answer = await call("GET", `/data_sources/${encodeURIComponent(await dataSource())}`);
    const properties = new Map<string, Property>();
    for (const [name, property] of Object.entries((answer["properties"] as Record<string, Json> | undefined) ?? {})) {
      const type = String(property["type"]);
      const options = ((property[type] as Json | undefined)?.["options"] as Json[] | undefined) ?? [];
      properties.set(name, { name, type, options: options.map((option) => String(option["name"])) });
    }
    const alone = [...properties.values()].filter((property) => !NOTION_FITS[property.type]);
    if (alone.length > 0) {
      note(`left alone in Notion: ${alone.map((property) => `${property.name} (${property.type}${NOTION_LEFT_ALONE[property.type] ? `: ${NOTION_LEFT_ALONE[property.type]}` : ""})`).join(", ")}`);
    }
    schema = properties;
    return properties;
  };

  /** The mapping's names, each to the property it finds: by name, loosely, and the title for `titleRef`. */
  const resolve = (properties: Map<string, Property>): Map<string, Property> => {
    const found = new Map<string, Property>();
    if (!options.refs) {
      for (const property of properties.values()) if (NOTION_FITS[property.type]) found.set(property.name, property);
      return found;
    }
    const byLoose = new Map([...properties.values()].map((property) => [loose(property.name), property]));
    const title = [...properties.values()].find((property) => property.type === "title");
    const missing: string[] = [];
    for (const [ref, fieldType] of Object.entries(options.refs)) {
      const property = properties.get(ref) ?? byLoose.get(loose(ref)) ?? (ref === options.titleRef ? title : undefined);
      if (!property) {
        missing.push(ref);
        continue;
      }
      if (!NOTION_FITS[property.type]) {
        note(`${ref}: the property ${property.name} is a ${property.type} property, which is not kept in step, so it is left out`);
        continue;
      }
      if (fieldType && !notionFits(property.type, fieldType)) {
        note(`${ref}: the property ${property.name} is a ${property.type} property, and a ${fieldType} field cannot hold it, so it is left out`);
        continue;
      }
      found.set(ref, property);
    }
    if (missing.length > 0) note(`no property in the database for ${missing.join(", ")}, so ${missing.length === 1 ? "it is" : "they are"} not kept in step`);
    return found;
  };

  const fieldsOf = (page: Json, resolved: Map<string, Property>): Json => {
    const properties = (page["properties"] as Record<string, Json> | undefined) ?? {};
    const out: Json = {};
    for (const [ref, property] of resolved) {
      const value = properties[property.name];
      if (value) out[ref] = notionValue(value);
    }
    return out;
  };

  /** Every page of one query: edited on or after `since`, oldest first; without it, the whole database. */
  const query = async (since: string | undefined): Promise<Json[]> => {
    const pages: Json[] = [];
    let start: string | undefined;
    for (;;) {
      const answer = await call("POST", `/data_sources/${encodeURIComponent(await dataSource())}/query`, {
        page_size: options.pageSize ?? 100,
        sorts: [{ timestamp: "last_edited_time", direction: "ascending" }],
        ...(since ? { filter: { timestamp: "last_edited_time", last_edited_time: { on_or_after: since } } } : {}),
        ...(start ? { start_cursor: start } : {}),
      });
      pages.push(...((answer["results"] as Json[] | undefined) ?? []));
      if (answer["has_more"] === true && typeof answer["next_cursor"] === "string") {
        start = answer["next_cursor"];
        continue;
      }
      return pages;
    }
  };

  /** Whether a page this sync knew is gone from the database: archived, in the trash, moved out, or not there at all. */
  const goneFromDatabase = async (id: string): Promise<boolean> => {
    try {
      const page = await call("GET", `/pages/${encodeURIComponent(id)}`);
      const parent = page["parent"] as Json | undefined;
      return page["archived"] === true || page["in_trash"] === true || notionKey(String(parent?.["data_source_id"] ?? "")) !== notionKey(await dataSource());
    } catch (error) {
      if (error instanceof NotionError && error.status === 404) return true;
      throw error;
    }
  };

  return {
    name: "notion",

    async pull(cursor) {
      const resolved = resolve(await database());
      const at = readCursor(cursor);
      const time = now();
      const whole = !at || time - at.swept >= (options.sweepEvery ?? DEFAULT_SWEEP);
      const pages = await query(whole ? undefined : at.since);
      let since = at?.since;
      const changes: RemoteChange[] = [];
      for (const page of pages) {
        const edited = String(page["last_edited_time"] ?? "");
        if (edited && (!since || edited > since)) since = edited;
        const archived = page["archived"] === true || page["in_trash"] === true;
        changes.push({ resource: "pages", id: String(page["id"]), version: notionVersion(page), ...(archived ? { deleted: true } : { fields: fieldsOf(page, resolved) }) });
      }
      if (whole && options.known) {
        const listed = new Set(pages.map((page) => notionKey(String(page["id"]))));
        for (const id of options.known()) {
          if (listed.has(notionKey(id))) continue;
          if (await goneFromDatabase(id)) changes.push({ resource: "pages", id, version: "gone", deleted: true });
        }
      }
      return { changes, cursor: JSON.stringify({ ...(since ? { since } : {}), swept: whole ? time : at.swept }) };
    },

    async push(writes) {
      const resolved = resolve(schema ?? (await database()));
      const acks: RemoteAck[] = [];
      for (const write of writes) {
        try {
          acks.push(await one(write, resolved));
        } catch (error) {
          // One refusal is not a failed run: the engine keeps the local state for this write and says so.
          acks.push({ localId: write.localId, id: write.id ?? "", version: "", error: error instanceof Error ? error.message : String(error) });
        }
      }
      return acks;
    },
  };

  async function one(write: RemoteWrite, resolved: Map<string, Property>): Promise<RemoteAck> {
    if (write.deleted && write.id) {
      try {
        await call("PATCH", `/pages/${encodeURIComponent(write.id)}`, { in_trash: true });
      } catch (error) {
        // Already gone there is what a delete asks for.
        if (!(error instanceof NotionError && error.status === 404)) throw error;
      }
      return { localId: write.localId, id: write.id, version: "" };
    }
    const properties: Json = {};
    for (const [ref, value] of Object.entries(write.fields ?? {})) {
      const property = resolved.get(ref);
      if (!property || NOTION_READ_ONLY.has(property.type)) continue;
      properties[property.name] = notionProperty(property.type, property.options.length > 0 ? asOption(property, value) : value);
    }
    if (write.id && Object.keys(properties).length === 0) return { localId: write.localId, id: write.id, version: "" };
    let page: Json;
    try {
      page = write.id
        ? await call("PATCH", `/pages/${encodeURIComponent(write.id)}`, { properties })
        : await call("POST", "/pages", { parent: { type: "data_source_id", data_source_id: await dataSource() }, properties });
    } catch (error) {
      if (write.id && error instanceof NotionError && error.status === 404) {
        throw new NotionError(`notion: the page ${write.id} is not one the integration can see any more: it was deleted, or its database is no longer shared with the integration`, 404, error.code);
      }
      throw error;
    }
    return { localId: write.localId, id: String(page["id"]), version: notionVersion(page) };
  }
}
