import type { Fetcher } from "./google-calendar.js";
import { notionKey, notionProperty } from "./notion.js";

/**
 * A SCRIPTED NOTION: the endpoints a Notion connection reaches, in memory.
 *
 * Retrieve, make and archive a database, and the data sources it holds
 * (Notion's 2025-09-03 API: a database of one source, or of several); query
 * a source (a `last_edited_time` filter, oldest first, `has_more` and
 * `next_cursor`); make, read and change a page, put one in the trash. It answers as Notion does where a connection
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

/** One data source: a table of pages under a database. */
interface Source {
  id: string;
  title: string;
  properties: Map<string, { id: string; name: string; type: string; options: string[] }>;
  database: Container;
}

/** A database: a name, shared or not, holding its data sources. */
interface Container {
  id: string;
  title: string;
  sources: Source[];
  shared: boolean;
  archived: boolean;
}

interface SourceSpec {
  readonly title?: string;
  readonly properties: Readonly<Record<string, string>>;
  readonly options?: Readonly<Record<string, readonly string[]>>;
}

export interface ScriptedNotion {
  readonly fetch: Fetcher;
  readonly secret: string;
  /** Every request answered, in order (never the secret). */
  readonly requests: ScriptedRequest[];
  /** A database shared with the integration, of one data source with properties by name and type ("Status": "status"); its id. */
  database(spec: SourceSpec): string;
  /** Another data source in a database, with its own properties; its id. */
  source(databaseId: string, spec: SourceSpec): string;
  /** A database's data sources' ids, in order. */
  sources(databaseId: string): string[];
  /** Shares a database with the integration, or takes it back. */
  share(databaseId: string, shared: boolean): void;
  /** A page as Notion would answer it. */
  page(id: string): Json | undefined;
  /** A database's or a data source's pages (a database's first source), archived ones too when asked. */
  pages(databaseId: string, archived?: boolean): Json[];
  /** Another person makes a page in a database's first source, or in the source named, with plain values by property name (people as names). */
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
  const databases = new Map<string, Container>();
  const sources = new Map<string, Source>();
  const pages = new Map<string, Json>();
  const requests: ScriptedRequest[] = [];
  let limited = 0;
  let retryAfter = 1;

  const minute = () => new Date(Math.floor(clock / 60_000) * 60_000).toISOString();
  const findDatabase = (id: string) => databases.get(notionKey(id));
  const findSource = (id: string) => sources.get(notionKey(id));
  /** A source by its id, or a database's first. */
  const sourceOrFirst = (id: string) => findSource(id) ?? findDatabase(id)?.sources[0];
  const sourceOfPage = (page: Json) => findSource(String((page["parent"] as Json)["data_source_id"]));
  const inTrash = (page: Json) => page["in_trash"] === true;
  const findPage = (id: string) => pages.get(notionKey(id));
  const shown = (page: Json) => structuredClone(page);

  /** A property object as the API was handed it, kept as Notion answers it. */
  const kept = (database: Source, name: string, input: Json): Json => {
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
  const blank = (database: Source): Json => {
    const out: Json = {};
    for (const property of database.properties.values()) {
      out[property.name] = kept(database, property.name, { [property.type]: property.type in EMPTY ? EMPTY[property.type] : null });
    }
    return out;
  };

  const writeProperties = (database: Source, page: Json, input: Json) => {
    const properties = page["properties"] as Json;
    for (const [name, value] of Object.entries(input)) properties[name] = kept(database, name, value as Json);
  };

  const plain = (database: Source, values: Readonly<Record<string, unknown>>): Json => {
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

  const makePage = (database: Source, input: Json): Json => {
    made += 1;
    const page: Json = {
      object: "page",
      id: uuid(made, "b0"),
      created_time: minute(),
      last_edited_time: minute(),
      archived: false,
      in_trash: false,
      parent: { type: "data_source_id", data_source_id: database.id, database_id: database.database.id },
      properties: blank(database),
    };
    writeProperties(database, page, input);
    pages.set(notionKey(String(page["id"])), page);
    return page;
  };

  const titled = (title: string) => [{ type: "text", text: { content: title }, plain_text: title }];
  const databaseShown = (database: Container): Json => ({
    object: "database",
    id: database.id,
    title: titled(database.title),
    in_trash: database.archived,
    data_sources: database.sources.map((source) => ({ id: source.id, name: source.title })),
  });

  const sourceShown = (database: Source): Json => ({
    object: "data_source",
    id: database.id,
    title: titled(database.title),
    parent: { type: "database_id", database_id: database.database.id },
    properties: Object.fromEntries(
      [...database.properties.values()].map((property) => [
        property.name,
        { id: property.id, name: property.name, type: property.type, [property.type]: ["select", "multi_select", "status"].includes(property.type) ? { options: property.options.map((name, at) => ({ id: `opt-${at}`, name, color: "default" })) } : {} },
      ]),
    ),
  });

  const visible = (id: string): Container => {
    const database = findDatabase(id);
    if (!database || !database.shared || database.archived) {
      if (findSource(id)) throw new Refusal(400, "validation_error", `Provided database_id ${id} is a data source, not a database. Use the data sources API instead, or pass the ID of the database itself.`);
      throw new Refusal(404, "object_not_found", `Could not find database with ID: ${id}. Make sure the relevant pages and databases are shared with your integration.`);
    }
    return database;
  };
  const visibleSource = (id: string): Source => {
    const source = findSource(id);
    if (!source || !source.database.shared || source.database.archived) throw new Refusal(404, "object_not_found", `Could not find data_source with ID: ${id}. Make sure the relevant pages and databases are shared with your integration.`);
    return source;
  };

  const createSource = (database: Container, spec: SourceSpec): Source => {
    made += 1;
    const source: Source = { id: uuid(made, "c0"), title: spec.title ?? database.title, properties: new Map(), database };
    let at = 0;
    for (const [name, type] of Object.entries(spec.properties)) {
      at += 1;
      source.properties.set(name, { id: type === "title" ? "title" : `p${at}`, name, type, options: [...(spec.options?.[name] ?? [])] });
    }
    database.sources.push(source);
    sources.set(notionKey(source.id), source);
    return source;
  };

  const createDatabase = (spec: SourceSpec): Container => {
    made += 1;
    const database: Container = { id: uuid(made, "d0"), title: spec.title ?? "Untitled", sources: [], shared: true, archived: false };
    databases.set(notionKey(database.id), database);
    createSource(database, spec);
    return database;
  };

  /** A data source's properties as the API is handed them: names to `{ <type>: { options? } }`. */
  const specOf = (body: Json | undefined, title: string): SourceSpec => {
    const properties: Record<string, string> = {};
    const options: Record<string, string[]> = {};
    for (const [name, spec] of Object.entries((body?.["properties"] as Record<string, Json>) ?? {})) {
      const type = Object.keys(spec)[0]!;
      properties[name] = type;
      const listed = (spec[type] as Json | undefined)?.["options"] as Json[] | undefined;
      if (listed) options[name] = listed.map((option) => String(option["name"]));
    }
    return { title, properties, options };
  };
  const words = (parts: unknown) => ((parts as Json[] | undefined) ?? []).map((part) => String((part["text"] as Json)?.["content"] ?? "")).join("");

  const answer = (method: string, path: string, body: Json): Json => {
    let match: RegExpExecArray | null;
    if (method === "POST" && path === "/databases") {
      if (body["properties"]) throw new Refusal(400, "validation_error", "body.properties should be not present, instead was `{…}`. A database's properties are its data source's: send initial_data_source.properties.");
      return databaseShown(createDatabase(specOf(body["initial_data_source"] as Json | undefined, words(body["title"]))));
    }
    if (method === "POST" && path === "/data_sources") {
      const database = visible(String((body["parent"] as Json | undefined)?.["database_id"] ?? ""));
      return sourceShown(createSource(database, specOf(body, words(body["title"]))));
    }
    if ((match = /^\/databases\/([^/]+)$/.exec(path)) && method === "GET") return databaseShown(visible(decodeURIComponent(match[1]!)));
    if ((match = /^\/databases\/([^/]+)\/query$/.exec(path))) throw new Refusal(400, "invalid_request_url", "Invalid request URL: a database is queried through its data source, POST /v1/data_sources/{id}/query.");
    if ((match = /^\/data_sources\/([^/]+)$/.exec(path)) && method === "GET") return sourceShown(visibleSource(decodeURIComponent(match[1]!)));
    if ((match = /^\/data_sources\/([^/]+)\/query$/.exec(path)) && method === "POST") {
      const database = visibleSource(decodeURIComponent(match[1]!));
      const since = ((body["filter"] as Json | undefined)?.["last_edited_time"] as Json | undefined)?.["on_or_after"] as string | undefined;
      const all = [...pages.values()]
        .filter((page) => sourceOfPage(page) === database && !inTrash(page))
        .filter((page) => !since || String(page["last_edited_time"]) >= since)
        .sort((a, b) => String(a["last_edited_time"]).localeCompare(String(b["last_edited_time"])));
      const size = Math.min(Number(body["page_size"] ?? 100), 100);
      const start = Number(body["start_cursor"] ?? 0);
      const results = all.slice(start, start + size).map(shown);
      const more = start + size < all.length;
      return { object: "list", results, has_more: more, next_cursor: more ? String(start + size) : null };
    }
    if (method === "POST" && path === "/pages") {
      const parent = (body["parent"] as Json | undefined) ?? {};
      if (parent["database_id"] && !parent["data_source_id"]) {
        const database = visible(String(parent["database_id"]));
        if (database.sources.length > 1) throw new Refusal(400, "validation_error", "Databases with multiple data sources are not supported as a page's parent: use parent.data_source_id.");
        return shown(makePage(database.sources[0]!, (body["properties"] as Json) ?? {}));
      }
      return shown(makePage(visibleSource(String(parent["data_source_id"] ?? "")), (body["properties"] as Json) ?? {}));
    }
    if ((match = /^\/pages\/([^/]+)$/.exec(path))) {
      const page = findPage(decodeURIComponent(match[1]!));
      const database = page ? sourceOfPage(page) : undefined;
      if (!page || !database?.database.shared) throw new Refusal(404, "object_not_found", `Could not find page with ID: ${match[1]}. Make sure the relevant pages and databases are shared with your integration.`);
      if (method === "GET") return shown(page);
      if (method === "PATCH") {
        const trashing = body["in_trash"] ?? body["archived"];
        if (inTrash(page) && trashing !== false) {
          if (trashing === true) return shown(page);
          throw new Refusal(400, "validation_error", "Can't edit block that is archived. You must unarchive the block before editing.");
        }
        if (typeof trashing === "boolean") {
          page["in_trash"] = trashing;
          page["archived"] = trashing;
        }
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
      page["in_trash"] = true;
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
    source(databaseId, spec) {
      const database = findDatabase(databaseId);
      if (!database) throw new Error(`scripted notion: no database ${databaseId}`);
      return createSource(database, spec).id;
    },
    sources: (databaseId) => findDatabase(databaseId)?.sources.map((source) => source.id) ?? [],
    share(databaseId, shared) {
      const database = findDatabase(databaseId);
      if (database) database.shared = shared;
    },
    page: (id) => {
      const page = findPage(id);
      return page ? shown(page) : undefined;
    },
    pages: (databaseId, archived = false) => {
      const source = sourceOrFirst(databaseId);
      return [...pages.values()].filter((page) => source !== undefined && sourceOfPage(page) === source && (archived || !inTrash(page))).map(shown);
    },
    add(databaseId, values) {
      const database = sourceOrFirst(databaseId);
      if (!database) throw new Error(`scripted notion: no database ${databaseId}`);
      return shown(makePage(database, plain(database, values)));
    },
    edit(pageId, values) {
      const page = findPage(pageId);
      if (!page) throw new Error(`scripted notion: no page ${pageId}`);
      const database = sourceOfPage(page)!;
      writeProperties(database, page, plain(database, values));
      touch(page);
      return shown(page);
    },
    archive(pageId) {
      const page = findPage(pageId);
      if (!page) throw new Error(`scripted notion: no page ${pageId}`);
      page["archived"] = true;
      page["in_trash"] = true;
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
