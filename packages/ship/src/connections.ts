import type { AnySchema, GraviewApp, Store } from "@graview/core";
import { NOTION_AUTH_ENV, connection, notionSourcesOf, sharedLinks, type ConnectionDeclaration, type Fetcher, type GoogleTokenRequest, type SyncReport, type SyncState } from "@graview/core/sync";

/**
 * THE APP'S DECLARED CONNECTIONS, RUN BESIDE ITS STORE (`connections.<name>`).
 *
 * `graview serve` and `graview preview` start this for a served store: each
 * connection's engine runs every `every` seconds (30 by default) and soon
 * after a change made here, one pass at a time. What the engine keeps — its
 * cursor and its links — is written to a JSON file beside the app's data
 * after each pass, so a restart picks up where it stopped instead of
 * sending everything again; an in-memory preview keeps it in memory.
 *
 * No `node:` builtin is reached from here, so a host on the runtime entry
 * runs it too: the file the state is kept in, and the credentials file a
 * declaration names, are `./connections-file.ts`'s (main entry only).
 *
 * Credentials are never in the declaration. By default they come from the
 * environment, and failing that from the KEY=value file `auth.file` names:
 * for a Google calendar `<auth.env>_CLIENT_ID`, `_CLIENT_SECRET` and
 * `_REFRESH_TOKEN` (auth.env is "GOOGLE" unless declared); for a Notion
 * database the internal integration's secret, `<auth.env>_TOKEN` (auth.env
 * is "NOTION" unless declared, so `NOTION_TOKEN`). A host that keeps them
 * itself (Graview Cloud, per workspace) hands `token` instead — Google's
 * access token, asked again with `{ refresh: true }` when Google refuses
 * one, or Notion's secret.
 *
 * Every connection shares one set of links (`sharedLinks()`), so a Notion
 * relation finds the record another connection keeps (a check's reindeer, in
 * the fleet's table), and after each pass every engine links what it held
 * for a page another one has linked since — the order they run in does not
 * matter. A host gets this by running them here; one that makes its own
 * engines with `connection()` passes them one `links`.
 */

export interface ConnectionTokenRequest extends GoogleTokenRequest {
  /** The connection's name in the declaration. */
  readonly connection: string;
  readonly declaration: ConnectionDeclaration;
}

export interface RunConnectionsOptions<S extends AnySchema> {
  readonly app: GraviewApp<S>;
  readonly store: Store<S>;
  /** Where the engines' state is kept between runs (`fileConnectionState(path)` beside the data). Absent: in memory, gone when the process stops. */
  readonly state?: ConnectionStateStore;
  /** Reads the KEY=value file a declaration's `auth.file` names (`readEnvFile`). Absent: that file is not read. */
  readFile?(path: string): Readonly<Record<string, string>>;
  /**
   * THE HOST SEAM: a connection's credential — a Google access token, or a
   * Notion integration's secret (`declaration.system` says which). Absent:
   * read from the credentials the declaration names.
   */
  token?(request: ConnectionTokenRequest): Promise<string> | string;
  /** A Google calendar's id, when the host keeps it. Absent: the declaration's, or the environment variable it names. */
  calendar?(request: { readonly connection: string; readonly declaration: ConnectionDeclaration }): string | undefined;
  /** A Notion database's id, when the host keeps it. Absent: the declaration's, or the environment variable it names. */
  database?(request: { readonly connection: string; readonly declaration: ConnectionDeclaration }): string | undefined;
  /** Where credentials and a calendar's `env` are read. `process.env` by default. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Google's API and its token endpoint, and Notion's API, for a test to script (`scriptedNotion().fetch`). */
  readonly fetch?: Fetcher;
  /** Run nothing, and say so: `graview serve --no-sync`. */
  readonly paused?: boolean;
  /** How long after a change made here a pass starts, in ms (1500 by default). */
  readonly settle?: number;
  /** Each pass's news and each problem, as a line. */
  say?(line: string): void;
}

export interface RunningConnections {
  /** The connections running, by name. */
  readonly running: readonly string[];
  /** One pass of every running connection now, after any pass already going. */
  runNow(): Promise<Readonly<Record<string, SyncReport>>>;
  /** Stops the timers, after the pass going finishes. */
  stop(): Promise<void>;
}

/** Every connection's engine state, by connection name. */
export type ConnectionStates = Record<string, SyncState>;

/** Where the engines' state is kept between runs: read once at start, written after each pass. */
export interface ConnectionStateStore {
  read(): ConnectionStates;
  write(states: ConnectionStates): void;
}

/** What a connection reads its credentials and calendar from: the environment, then the declared file. */
function lookupFor(declaration: ConnectionDeclaration, env: Readonly<Record<string, string | undefined>>, readFile?: (path: string) => Readonly<Record<string, string>>) {
  const file: Readonly<Record<string, string>> = declaration.auth?.file && readFile ? readFile(declaration.auth.file) : {};
  return (key: string): string | undefined => env[key] || file[key] || undefined;
}

/** Where a refresh token is traded for an access token. */
export const GOOGLE_TOKEN_URL = "https://oauth2.googleapis.com/token";

/**
 * A token source from a refresh token: an access token kept until a minute
 * before it ends, minted again when asked to refresh.
 */
function refreshingToken(credentials: { readonly clientId: string; readonly clientSecret: string; readonly refreshToken: string }, name: string, post: Fetcher) {
  let held = { token: "", until: 0 };
  return async (request?: GoogleTokenRequest): Promise<string> => {
    if (!request?.refresh && Date.now() < held.until) return held.token;
    const response = await post(GOOGLE_TOKEN_URL, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ client_id: credentials.clientId, client_secret: credentials.clientSecret, refresh_token: credentials.refreshToken, grant_type: "refresh_token" }).toString(),
    });
    const body = (await response.json()) as { access_token?: string; expires_in?: number; error?: string };
    if (!response.ok || !body.access_token) throw new Error(`connection ${name}: Google refused the refresh token (${body.error ?? response.status})`);
    held = { token: body.access_token, until: Date.now() + ((body.expires_in ?? 3600) - 60) * 1000 };
    return held.token;
  };
}

/** One pass's news in a line, or nothing when there was none. */
export function sayReport(report: SyncReport): string | undefined {
  const notion = report.system === "notion";
  const place = notion ? "Notion" : "the calendar";
  const said: string[] = [];
  if (report.applied.length) said.push(`took ${report.applied.length} from ${place}`);
  if (report.pushed.length) said.push(`sent ${report.pushed.length} to ${notion ? "Notion" : "it"}`);
  // Whom the pass invited and took off, counted (Roadmap f-sync-guest-changes-in-history): only writes that reached the calendar.
  const invited = (report.guests ?? []).filter((one) => one.invited.length > 0);
  const invitedCount = invited.reduce((sum, one) => sum + one.invited.length, 0);
  const removedCount = (report.guests ?? []).reduce((sum, one) => sum + one.removed.length, 0);
  if (invitedCount) said.push(`invited ${invitedCount} to ${invited.length} event${invited.length === 1 ? "" : "s"}`);
  if (removedCount) said.push(`${removedCount} taken off`);
  if (report.gone.length) said.push(`${report.gone.length} gone there`);
  // A change coming in that this store refused names the calendar's event or Notion's page, which may have no record here.
  if (report.refused.length) said.push(`refused: ${report.refused.map((one) => `${one.resource ? `${notion ? "Notion's page" : "the calendar's"} ${one.id}` : one.localId} (${one.error})`).join(", ")}`);
  if (report.resolved.length) said.push(`${report.resolved.length} conflict${report.resolved.length === 1 ? "" : "s"} settled`);
  if (report.conflicts.length) said.push(`${report.conflicts.length} conflict${report.conflicts.length === 1 ? "" : "s"} held`);
  // What the transport did there, as it said it: "Made 3 properties in Notion: Status, Due and Owner".
  if (report.said?.length) said.push(...report.said);
  if (report.offline) said.push(`could not reach ${place}${report.problem ? ` (${report.problem})` : ""}; will try again`);
  return said.length > 0 ? said.join(" · ") : undefined;
}

/** The systems a connection's changes are authored by: a change of theirs landing here starts no pass. */
const CONNECTION_SYSTEMS = new Set(["google-calendar", "notion"]);

export function runConnections<S extends AnySchema>(options: RunConnectionsOptions<S>): RunningConnections {
  const say = options.say ?? (() => undefined);
  const declared = Object.entries(options.app.connections ?? {});
  const env = options.env ?? (globalThis as { process?: { env?: Record<string, string | undefined> } }).process?.env ?? {};
  const kept: ConnectionStates = options.state?.read() ?? {};
  const engines: { name: string; every: number; engine: ReturnType<typeof connection<S>>["engine"] }[] = [];
  const links = sharedLinks();

  for (const [name, declaration] of declared) {
    if (options.paused || declaration.paused) {
      say(`${name}: paused${options.paused ? " (--no-sync)" : " (declared)"}; nothing is synced`);
      continue;
    }
    const lookup = lookupFor(declaration, env, options.readFile);
    if (declaration.system === "notion") {
      const databaseId = options.database?.({ connection: name, declaration }) ?? (typeof declaration.database === "string" ? declaration.database : lookup(declaration.database.env));
      if (!databaseId) {
        say(`${name}: not started: no database id in ${typeof declaration.database === "string" ? "the declaration" : declaration.database.env}`);
        continue;
      }
      const secretName = `${declaration.auth?.env ?? NOTION_AUTH_ENV}_TOKEN`;
      let secret: () => Promise<string> | string;
      if (options.token) {
        const host = options.token;
        secret = () => host({ connection: name, declaration });
      } else {
        const value = lookup(secretName);
        if (!value) {
          say(`${name}: not started: ${secretName} is not set${declaration.auth?.file ? ` in the environment or ${declaration.auth.file}` : " in the environment"}`);
          continue;
        }
        secret = () => value;
      }
      const made = connection<S>({
        name,
        declaration,
        app: options.app,
        store: options.store,
        databaseId,
        token: secret,
        ...(options.token ? {} : { secretName }),
        ...(options.fetch ? { fetch: options.fetch } : {}),
        ...(kept[name] ? { state: kept[name] } : {}),
        say: (line) => say(`${name}: ${line}`),
        links,
      });
      engines.push({ name, every: (declaration.every ?? 30) * 1000, engine: made.engine });
      say(`${name}: ${declaration.direction === "read" ? "reading" : "keeping in step with"} a Notion database into ${notionSourcesOf(declaration).map((one) => one.kind).join(", ")}, every ${declaration.every ?? 30} s`);
      continue;
    }
    const calendarId =options.calendar?.({ connection: name, declaration }) ?? (typeof declaration.calendar === "string" ? declaration.calendar : lookup(declaration.calendar.env));
    if (!calendarId) {
      say(`${name}: not started: no calendar id in ${typeof declaration.calendar === "string" ? "the declaration" : declaration.calendar.env}`);
      continue;
    }
    let token: (request?: GoogleTokenRequest) => Promise<string> | string;
    if (options.token) {
      const host = options.token;
      token = (request) => host({ ...request, connection: name, declaration });
    } else {
      const prefix = declaration.auth?.env ?? "GOOGLE";
      const keys = { clientId: `${prefix}_CLIENT_ID`, clientSecret: `${prefix}_CLIENT_SECRET`, refreshToken: `${prefix}_REFRESH_TOKEN` };
      const values = { clientId: lookup(keys.clientId), clientSecret: lookup(keys.clientSecret), refreshToken: lookup(keys.refreshToken) };
      const missing = (Object.keys(keys) as (keyof typeof keys)[]).filter((key) => !values[key]).map((key) => keys[key]);
      if (missing.length > 0) {
        say(`${name}: not started: ${missing.join(", ")} ${missing.length === 1 ? "is" : "are"} not set${declaration.auth?.file ? ` in the environment or ${declaration.auth.file}` : " in the environment"}`);
        continue;
      }
      token = refreshingToken(values as { clientId: string; clientSecret: string; refreshToken: string }, name, options.fetch ?? (globalThis.fetch as Fetcher));
    }
    const made = connection<S>({
      name,
      declaration,
      app: options.app,
      store: options.store,
      calendarId,
      token,
      ...(options.fetch ? { fetch: options.fetch } : {}),
      ...(kept[name] ? { state: kept[name] } : {}),
    });
    engines.push({ name, every: (declaration.every ?? 30) * 1000, engine: made.engine });
    say(`${name}: ${declaration.direction === "read" ? "reading" : "keeping in step with"} a Google calendar into ${declaration.kind}, every ${declaration.every ?? 30} s`);
  }

  /* One pass at a time: a pass asked for while one runs is queued once, and every asker waits on that one. */
  let going: Promise<Readonly<Record<string, SyncReport>>> | undefined;
  let queued: Promise<Readonly<Record<string, SyncReport>>> | undefined;
  let stopped = false;
  const pass = async (): Promise<Readonly<Record<string, SyncReport>>> => {
    const reports: Record<string, SyncReport> = {};
    for (const { name, engine } of engines) {
      try {
        const report = await engine.run();
        reports[name] = report;
        const line = sayReport(report);
        if (line) say(`${name}: ${line}`);
        kept[name] = engine.snapshot;
      } catch (error) {
        say(`${name}: the pass failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    // A page one connection's relation reached before another connection read it is linked now, with nothing sent.
    for (const { name, engine } of engines) {
      try {
        const linked = engine.resolveHeld();
        if (linked.length > 0) {
          say(`${name}: linked ${linked.length} to records another connection read`);
          kept[name] = engine.snapshot;
        }
      } catch (error) {
        say(`${name}: linking failed: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
    options.state?.write(kept);
    return reports;
  };
  const runNow = (): Promise<Readonly<Record<string, SyncReport>>> => {
    if (!going) {
      going = pass().finally(() => {
        going = undefined;
      });
      return going;
    }
    queued ??= going.then(() => {
      queued = undefined;
      return stopped ? {} : runNow();
    });
    return queued;
  };

  const timers: ReturnType<typeof setInterval>[] = [];
  let settling: ReturnType<typeof setTimeout> | undefined;
  let unsubscribe: (() => void) | undefined;
  if (engines.length > 0) {
    const every = Math.min(...engines.map((one) => one.every));
    timers.push(setInterval(() => void runNow(), every));
    // A change made here — not one a connection itself landed — starts a pass soon after.
    unsubscribe = options.store.subscribe((_diff, ops) => {
      if (ops.every((op) => op.author.kind === "system" && CONNECTION_SYSTEMS.has(op.author.id ?? ""))) return;
      if (settling) clearTimeout(settling);
      settling = setTimeout(() => void runNow(), options.settle ?? 1500);
    });
    void runNow();
  }

  return {
    running: engines.map((one) => one.name),
    runNow,
    async stop() {
      stopped = true;
      for (const timer of timers) clearInterval(timer);
      if (settling) clearTimeout(settling);
      unsubscribe?.();
      await going;
    },
  };
}
