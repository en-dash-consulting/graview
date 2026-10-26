import type { Fetcher } from "./google-calendar.js";
import { notionKey, notionProperty } from "./notion.js";

/**
 * A SCRIPTED NOTION: the endpoints a Notion connection reaches, in memory.
 *
 * Retrieve, make and archive a database; query one (a `last_edited_time`
 * filter, oldest first, `has_more` and `next_cursor`); make, read and
 * change a page, archive one. It answers as Notion does where a connection
 * would notice: a secret it does not take is 401, a database not shared
 * with the integration is 404, a piece of rich text over 2000 characters or
 * a status option the database lacks is 400, and `limit(n)` answers the
 * next `n` requests 429 with a `Retry-After`. Its clock keeps
 * `last_edited_time` to the minute, as Notion does, and moves only when
 * told (`tick`).
 *
 * The connection's tests run against it, and so does
 * `scripts/verify-notion.mjs --stub`, which proves the harness's claims are
 * wired before a real workspace is reached. `edit`, `add` and `archive` are
 * another person, working in Notion.
 */

type Json = Record<string, unknown>;

export interface ScriptedNotionOptions {
  /** The integration secret it takes. */
  readonly secret?: string;
  /** Where its clock starts. */
  readonly start?: string;
}

export interface ScriptedRequest {
  readonly method: string;
  readonly path: string;
  readonly body?: Json;
}

interface Database {
  id: string;
  title: string;
  properties: Map<string, { id: string; name: string; type: string; options: string[] }>;
  shared: boolean;
  archived: boolean;
}

export interface ScriptedNotion {
  readonly fetch: Fetcher;
  readonly secret: string;
  /** Every request answered, in order (never the secret). */
  readonly requests: ScriptedRequest[];
  /** A database shared with the integration, with properties by name and type ("Status": "status"); its id. */
  database(spec: { readonly title?: string; readonly properties: Readonly<Record<string, string>>; readonly options?: Readonly<Record<string, readonly string[]>> }): string;
  /** Shares a database with the integration, or takes it back. */
  share(databaseId: string, shared: boolean): void;
  /** A page as Notion would answer it. */
  page(id: string): Json | undefined;
  /** A database's pages, archived ones too when asked. */
  pages(databaseId: string, archived?: boolean): Json[];
  /** Another person makes a page, with plain values by property name (people as names). */
  add(databaseId: string, values: Readonly<Record<string, unknown>>): Json;
  /** Another person changes a page's properties, with plain values by property name. */
  edit(pageId: string, values: Readonly<Record<string, unknown>>): Json;
  /** Another person archives a page. */
  archive(pageId: string): void;
  /** The next `count` requests are answered 429, asking for `retryAfter` seconds. */
  limit(count: number, retryAfter?: number): void;
  /** Moves the clock on. */
  tick(ms: number): void;
}

const uuid = (n: number, salt: string) => {
  const hex = `${salt}${n.toString(16)}`.padStart(32, "0").slice(-32);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
};

/** What an empty property of each type holds, where it is not `null`. */
const EMPTY: Readonly<Record<string, unknown>> = { title: [], rich_text: [], multi_select: [], people: [], checkbox: false };

class Refusal extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

export function scriptedNotion(options: ScriptedNotionOptions = {}): ScriptedNotion {
  const secret = options.secret ?? "secret_scriptedNotionIntegrationSecret0001";
  let clock = Date.parse(options.start ?? "2026-10-25T10:00:00.000Z");
  let made = 0;
  const databases = new Map<string, Database>();
  const pages = new Map<string, Json>();
  const requests: ScriptedRequest[] = [];
  let limited = 0;
  let retryAfter = 1;

  const minute = () => new Date(Math.floor(clock / 60_000) * 60_000).toISOString();
  const findDatabase = (id: string) => databases.get(notionKey(id));
  const findPage = (id: string) => pages.get(notionKey(id));
  const shown = (page: Json) => structuredClone(page);

  /** A property object as the API was handed it, kept as Notion answers it. */
  const kept = (database: Database, name: string, input: Json): Json => {
    const property = database.properties.get(name);
    if (!property) throw new Refusal(400, "validation_error", `${name} is not a property that exists.`);
    const type = property.type;
    if (!(type in input)) throw new Refusal(400, "validation_error", `${name} is expected to be ${type}.`);
    const value = input[type];
    const option = (name2: string) => {
      if (!property.options.includes(name2)) {
        if (type === "status") throw new Refusal(400, "validation_error", `Invalid status option. Status option "${name2}" does not exist".`);
        property.options.push(name2);
      }
      return { id: `opt-${property.options.indexOf(name2)}`, name: name2, color: "default" };
    };
    switch (type) {
      case "title":
      case "rich_text": {
        const parts = (value as Json[]) ?? [];
        for (const part of parts) {
          const content = String((part["text"] as Json | undefined)?.["content"] ?? "");
          if (content.length > 2000) throw new Refusal(400, "validation_error", `body.properties.${name}.${type}[0].text.content.length should be ≤ \`2000\`, instead was \`${content.length}\`.`);
        }
        if (parts.length > 100) throw new Refusal(400, "validation_error", `body.properties.${name}.${type}.length should be ≤ \`100\`.`);
        return { id: property.id, type, [type]: parts.map((part) => { const content = String((part["text"] as Json)["content"] ?? ""); return { type: "text", text: { content, link: null }, plain_text: content, href: null }; }) };
      }
      case "select":
      case "status":
        return { id: property.id, type, [type]: value === null ? null : option(String((value as Json)["name"])) };
      case "multi_select":
        return { id: property.id, type, multi_select: ((value as Json[]) ?? []).map((one) => option(String(one["name"]))) };
      case "date":
        return { id: property.id, type, date: value === null ? null : { start: String((value as Json)["start"]), end: null, time_zone: null } };
      case "people":
        return { id: property.id, type, people: ((value as Json[]) ?? []).map((person) => ({ object: "user", id: String(person["id"] ?? person["name"]), ...(person["name"] ? { name: person["name"] } : {}) })) };
      default:
        return { id: property.id, type, [type]: value ?? (type === "checkbox" ? false : null) };
    }
  };

  /** A new page's properties: every one of the database's, empty unless given. */
  const blank = (database: Database): Json => {
    const out: Json = {};
    for (const property of database.properties.values()) {
      out[property.name] = kept(database, property.name, { [property.type]: property.type in EMPTY ? EMPTY[property.type] : null });
    }
    return out;
  };

  const writeProperties = (database: Database, page: Json, input: Json) => {
    const properties = page["properties"] as Json;
    for (const [name, value] of Object.entries(input)) properties[name] = kept(database, name, value as Json);
  };

  const plain = (database: Database, values: Readonly<Record<string, unknown>>): Json => {
    const out: Json = {};
    for (const [name, value] of Object.entries(values)) {
      const type = database.properties.get(name)?.type;
      if (!type) throw new Error(`scripted notion: ${database.title} has no property ${name}`);
      out[name] = type === "people" ? { people: ((value as string[] | null) ?? []).map((who) => ({ id: `user-${who}`, name: who })) } : notionProperty(type, value);
    }
    return out;
  };

  const touch = (page: Json) => {
    page["last_edited_time"] = minute();
  };

  const makePage = (database: Database, input: Json): Json => {
    made += 1;
    const page: Json = {
      object: "page",
      id: uuid(made, "b0"),
      created_time: minute(),
      last_edited_time: minute(),
      archived: false,
      in_trash: false,
      parent: { type: "database_id", database_id: database.id },
      properties: blank(database),
    };
    writeProperties(database, page, input);
    pages.set(notionKey(String(page["id"])), page);
    return page;
  };

  const databaseShown = (database: Database): Json => ({
    object: "database",
    id: database.id,
    title: [{ type: "text", text: { content: database.title }, plain_text: database.title }],
    archived: database.archived,
    properties: Object.fromEntries(
      [...database.properties.values()].map((property) => [
        property.name,
        { id: property.id, name: property.name, type: property.type, [property.type]: ["select", "multi_select", "status"].includes(property.type) ? { options: property.options.map((name, at) => ({ id: `opt-${at}`, name, color: "default" })) } : {} },
      ]),
    ),
  });

  const visible = (id: string): Database => {
    const database = findDatabase(id);
    if (!database || !database.shared || database.archived) throw new Refusal(404, "object_not_found", `Could not find database with ID: ${id}. Make sure the relevant pages and databases are shared with your integration.`);
    return database;
  };

  const createDatabase = (spec: { title?: string; properties: Readonly<Record<string, string>>; options?: Readonly<Record<string, readonly string[]>> }): Database => {
    made += 1;
    const database: Database = { id: uuid(made, "d0"), title: spec.title ?? "Untitled", properties: new Map(), shared: true, archived: false };
    let at = 0;
    for (const [name, type] of Object.entries(spec.properties)) {
      at += 1;
      database.properties.set(name, { id: type === "title" ? "title" : `p${at}`, name, type, options: [...(spec.options?.[name] ?? [])] });
    }
    databases.set(notionKey(database.id), database);
    return database;
  };

  const answer = (method: string, path: string, body: Json): Json => {
    let match: RegExpExecArray | null;
    if (method === "POST" && path === "/databases") {
      const properties: Record<string, string> = {};
      const options: Record<string, string[]> = {};
      for (const [name, spec] of Object.entries((body["properties"] as Record<string, Json>) ?? {})) {
        const type = Object.keys(spec)[0]!;
        properties[name] = type;
        const listed = (spec[type] as Json | undefined)?.["options"] as Json[] | undefined;
        if (listed) options[name] = listed.map((option) => String(option["name"]));
      }
      const title = ((body["title"] as Json[] | undefined) ?? []).map((part) => String((part["text"] as Json)?.["content"] ?? "")).join("");
      return databaseShown(createDatabase({ title, properties, options }));
    }
    if ((match = /^\/databases\/([^/]+)$/.exec(path)) && method === "GET") return databaseShown(visible(decodeURIComponent(match[1]!)));
    if ((match = /^\/databases\/([^/]+)\/query$/.exec(path)) && method === "POST") {
      const database = visible(decodeURIComponent(match[1]!));
      const since = ((body["filter"] as Json | undefined)?.["last_edited_time"] as Json | undefined)?.["on_or_after"] as string | undefined;
      const all = [...pages.values()]
        .filter((page) => notionKey(String((page["parent"] as Json)["database_id"])) === notionKey(database.id) && page["archived"] !== true)
        .filter((page) => !since || String(page["last_edited_time"]) >= since)
        .sort((a, b) => String(a["last_edited_time"]).localeCompare(String(b["last_edited_time"])));
      const size = Math.min(Number(body["page_size"] ?? 100), 100);
      const start = Number(body["start_cursor"] ?? 0);
      const results = all.slice(start, start + size).map(shown);
      const more = start + size < all.length;
      return { object: "list", results, has_more: more, next_cursor: more ? String(start + size) : null };
    }
    if (method === "POST" && path === "/pages") {
      const database = visible(String((body["parent"] as Json | undefined)?.["database_id"] ?? ""));
      return shown(makePage(database, (body["properties"] as Json) ?? {}));
    }
    if ((match = /^\/pages\/([^/]+)$/.exec(path))) {
      const page = findPage(decodeURIComponent(match[1]!));
      const database = page ? findDatabase(String((page["parent"] as Json)["database_id"])) : undefined;
      if (!page || !database?.shared) throw new Refusal(404, "object_not_found", `Could not find page with ID: ${match[1]}. Make sure the relevant pages and databases are shared with your integration.`);
      if (method === "GET") return shown(page);
      if (method === "PATCH") {
        if (page["archived"] === true && body["archived"] !== false) {
          if (body["archived"] === true) return shown(page);
          throw new Refusal(400, "validation_error", "Can't edit block that is archived. You must unarchive the block before editing.");
        }
        if (typeof body["archived"] === "boolean") page["archived"] = body["archived"];
        if (body["properties"]) writeProperties(database, page, body["properties"] as Json);
        touch(page);
        return shown(page);
      }
    }
    if ((match = /^\/blocks\/([^/]+)$/.exec(path)) && method === "DELETE") {
      const database = findDatabase(decodeURIComponent(match[1]!));
      if (database) {
        database.archived = true;
        return { object: "block", id: database.id, archived: true };
      }
      const page = findPage(decodeURIComponent(match[1]!));
      if (!page) throw new Refusal(404, "object_not_found", "Could not find block.");
      page["archived"] = true;
      touch(page);
      return { object: "block", id: page["id"], archived: true };
    }
    throw new Refusal(400, "invalid_request_url", `Invalid request URL: ${method} ${path}`);
  };

  const respond = (status: number, body: Json, headers: Record<string, string> = {}) => ({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
    headers: { get: (name: string) => headers[name.toLowerCase()] ?? null },
  });

  const fetch: Fetcher = async (url, init) => {
    const at = new URL(url);
    const path = at.pathname.replace(/^\/v1/, "");
    const method = init?.method ?? "GET";
    const body = init?.body ? (JSON.parse(init.body) as Json) : {};
    requests.push({ method, path, ...(init?.body ? { body } : {}) });
    if (limited > 0) {
      limited -= 1;
      return respond(429, { object: "error", status: 429, code: "rate_limited", message: "You have been rate limited. Please try again in a few minutes." }, { "retry-after": String(retryAfter) });
    }
    const headers = init?.headers ?? {};
    const authorization = headers["authorization"] ?? headers["Authorization"];
    if (authorization !== `Bearer ${secret}`) return respond(401, { object: "error", status: 401, code: "unauthorized", message: "API token is invalid." });
    if (!headers["notion-version"] && !headers["Notion-Version"]) return respond(400, { object: "error", status: 400, code: "missing_version", message: "Notion-Version header failed validation." });
    try {
      return respond(200, answer(method, path, body));
    } catch (error) {
      if (error instanceof Refusal) return respond(error.status, { object: "error", status: error.status, code: error.code, message: error.message });
      throw error;
    }
  };

  return {
    fetch,
    secret,
    requests,
    database: (spec) => createDatabase(spec).id,
    share(databaseId, shared) {
      const database = findDatabase(databaseId);
      if (database) database.shared = shared;
    },
    page: (id) => {
      const page = findPage(id);
      return page ? shown(page) : undefined;
    },
    pages: (databaseId, archived = false) =>
      [...pages.values()].filter((page) => notionKey(String((page["parent"] as Json)["database_id"])) === notionKey(databaseId) && (archived || page["archived"] !== true)).map(shown),
    add(databaseId, values) {
      const database = findDatabase(databaseId);
      if (!database) throw new Error(`scripted notion: no database ${databaseId}`);
      return shown(makePage(database, plain(database, values)));
    },
    edit(pageId, values) {
      const page = findPage(pageId);
      if (!page) throw new Error(`scripted notion: no page ${pageId}`);
      const database = findDatabase(String((page["parent"] as Json)["database_id"]))!;
      writeProperties(database, page, plain(database, values));
      touch(page);
      return shown(page);
    },
    archive(pageId) {
      const page = findPage(pageId);
      if (!page) throw new Error(`scripted notion: no page ${pageId}`);
      page["archived"] = true;
      touch(page);
    },
    limit(count, after = 1) {
      limited = count;
      retryAfter = after;
    },
    tick(ms) {
      clock += ms;
    },
  };
}
