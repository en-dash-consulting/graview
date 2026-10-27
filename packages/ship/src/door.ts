import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { chmodSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { sameOrigin } from "@graview/core/sync";

export { sameOrigin };

/*
 * WHAT EVERY DEV-SERVER DOOR SHARES: who may knock, how much they may
 * send, and the shape of the plugin that opens it. The local door, the
 * decision door, the model door, the studio door, the files door and the
 * views door each answered these questions, and they must answer them the
 * same way.
 *
 * WHO MAY KNOCK is the person who started the dev server, and nobody else.
 * A browser says where a request came from (`Origin`, `Sec-Fetch-Site`), so
 * another site's page is refused by `sameOrigin`; but a program that is no
 * browser says nothing at all — another account on this machine, a
 * container sharing its loopback, a laptop on the network when the server
 * was started with `--host` — and to `sameOrigin` alone it looked like the
 * page. So every door also asks for a key: a secret this machine's user
 * keeps in `~/.graview/door-key` (readable by them alone), said only in the
 * terminal the dev server runs in, as the address to open
 * (`http://localhost:5173/?graview_door=<key>`). Opening it once trades the
 * key for a cookie only this server's own pages send (`HttpOnly`,
 * `SameSite=Strict`), and the address is tidied. The key is never written
 * into anything the server serves.
 */

/** The query parameter the printed address carries the key in, and the cookie it is traded for. */
export const DOOR_KEY_PARAM = "graview_door";
export const DOOR_COOKIE = "graview_door";

const HELD = Symbol.for("graview.door.key");

/** Where this machine's user keeps the key: `~/.graview/door-key`, theirs alone to read. */
export function doorKeyFile(): string {
  return process.env["GRAVIEW_DOOR_KEY_FILE"] ?? join(homedir(), ".graview", "door-key");
}

/**
 * The key every door asks for. `GRAVIEW_DOOR_KEY` when it is set (a harness
 * that starts its own server, a CI run); else the one kept in
 * `doorKeyFile()`, made the first time and kept with mode 0600, so a dev
 * server started again takes the same key and a page opened once stays let in.
 */
export function doorKey(): string {
  const said = process.env["GRAVIEW_DOOR_KEY"];
  if (said !== undefined && said.length >= 16) return said;
  const held = (globalThis as Record<symbol, string | undefined>)[HELD];
  if (held) return held;
  const file = doorKeyFile();
  let key: string | undefined;
  try {
    const kept = readFileSync(file, "utf8").trim();
    if (/^[\w-]{32,}$/.test(kept)) key = kept;
  } catch {
    // Not made yet.
  }
  if (key === undefined) {
    key = randomBytes(32).toString("base64url");
    try {
      mkdirSync(dirname(file), { recursive: true, mode: 0o700 });
      writeFileSync(file, `${key}\n`, { mode: 0o600 });
      chmodSync(file, 0o600);
    } catch {
      // A home that cannot be written: the key holds for this process, and the address printed says it.
    }
  }
  (globalThis as Record<symbol, string | undefined>)[HELD] = key;
  return key;
}

/** The `Cookie` header a page holds once it has been let in — what a harness or a test sends to be the page. */
export function doorCookie(key: string = doorKey()): string {
  return `${DOOR_COOKIE}=${key}`;
}

/** Whether a key given is the key, compared in constant time: the door's, and `graview serve`'s run key. */
export const sameKey = (given: string, key: string): boolean => {
  const a = createHash("sha256").update(given).digest();
  const b = createHash("sha256").update(key).digest();
  return timingSafeEqual(a, b) && given.length === key.length;
};
const same = sameKey;

/** A cookie a request carries, by name. */
export function cookieOf(req: IncomingMessage, name: string): string | undefined {
  const header = req.headers.cookie;
  if (typeof header !== "string") return undefined;
  for (const part of header.split(";")) {
    const at = part.indexOf("=");
    if (at > 0 && part.slice(0, at).trim() === name) return part.slice(at + 1).trim();
  }
  return undefined;
}

/** The host names and addresses the doors answer to besides this machine's loopback (`GRAVIEW_DOOR_HOSTS`, comma-separated). */
export function doorHosts(): readonly string[] {
  return (process.env["GRAVIEW_DOOR_HOSTS"] ?? "")
    .split(",")
    .map((name) => name.trim().toLowerCase())
    .filter((name) => name.length > 0);
}

/**
 * Whether a Host names this machine's loopback — `localhost`, a
 * `*.localhost` name, `127.x.x.x`, `[::1]` — or one of `doorHosts()`. An
 * address on the network, this machine's as a neighbor reaches it, is not
 * where the person who started the server opens its page unless they say so.
 */
export function loopbackHost(host: unknown, hosts: readonly string[] = doorHosts()): boolean {
  if (typeof host !== "string") return false;
  let name: string;
  try {
    name = new URL(`http://${host}`).hostname.toLowerCase();
  } catch {
    return false;
  }
  return name === "localhost" || name.endsWith(".localhost") || /^127(\.\d{1,3}){3}$/.test(name) || name === "[::1]" || hosts.includes(name);
}

/**
 * Whether this request came from the page this server serves to the person
 * who started it: from this server's own origin (`sameOrigin` from
 * `@graview/core/sync` — no other site's `Origin` or `Sec-Fetch-Site`), at a
 * Host that is this machine's loopback or one of `GRAVIEW_DOOR_HOSTS`
 * (`loopbackHost`), and
 * holding the door's key in its cookie. Asked before any body is read.
 */
export function fromThisApp(req: IncomingMessage): boolean {
  const hosts = doorHosts();
  if (!loopbackHost(req.headers.host, hosts) || !sameOrigin(req.headers, hosts)) return false;
  const given = cookieOf(req, DOOR_COOKIE);
  return given !== undefined && same(given, doorKey());
}

/** What a door says to a request without the key: where the key is. */
export const DOOR_LOCKED = "This door answers only a page opened from the address its dev server printed (it carries the door's key): open that address and try again.";

/** What a door's probe tells its own page opened without the key: closed, and how to open it. */
export const DOOR_CLOSED = "Open the address the dev server printed (it carries the door's key) to use it.";

/**
 * Whether a request is this server's own page asking whether a door is
 * open, without the key — a page opened at the plain address. Its probe is
 * answered "closed" rather than refused, so the page says how to open the
 * door and its console says nothing; the answer is the same sentence for
 * everybody and tells them nothing else.
 */
export function probeWithoutKey(req: IncomingMessage): boolean {
  if (req.method !== "GET") return false;
  const hosts = doorHosts();
  return loopbackHost(req.headers.host, hosts) && sameOrigin(req.headers, hosts);
}

/**
 * The address the key is traded at: a request carrying `?graview_door=<the
 * key>` is answered with the cookie and sent on to the same address
 * without it. Anything else passes.
 */
export function doorLogin(req: IncomingMessage, res: ServerResponse, next: () => void): void {
  if (!tradeKey(req, res, { param: DOOR_KEY_PARAM, cookie: DOOR_COOKIE, key: doorKey(), value: doorKey(), maxAge: 31536000 })) next();
}

/**
 * THE TRADE, for any key an address carries: a request whose address has
 * `?<param>=<key>` is answered 303 back to the same address without it,
 * and with `<cookie>=<value>` (`HttpOnly`, `SameSite=Strict`) when the key
 * was right. Says whether it answered; anything else passes untouched.
 * `graview serve`'s run key trades the same way, its cookie a value made
 * from the key and a session's (no `maxAge`), since the key dies with the run.
 */
export function tradeKey(
  req: IncomingMessage,
  res: ServerResponse,
  trade: { readonly param: string; readonly cookie: string; readonly key: string; readonly value: string; readonly maxAge?: number },
): boolean {
  const raw = req.url ?? "/";
  if (!raw.includes(`${trade.param}=`)) return false;
  let url: URL;
  try {
    url = new URL(raw, "http://door.invalid");
  } catch {
    return false;
  }
  const given = url.searchParams.get(trade.param);
  if (given === null) return false;
  url.searchParams.delete(trade.param);
  // Only ever back to a path on this server: "//elsewhere" is not one.
  const back = `/${url.pathname.replace(/^\/+/, "")}${url.search}`;
  res.statusCode = 303;
  res.setHeader("cache-control", "no-store");
  res.setHeader("referrer-policy", "no-referrer");
  if (same(given, trade.key)) res.setHeader("set-cookie", `${trade.cookie}=${trade.value}; Path=/; HttpOnly; SameSite=Strict${trade.maxAge !== undefined ? `; Max-Age=${trade.maxAge}` : ""}`);
  res.setHeader("location", back);
  res.end();
  return true;
}

const opened = new WeakSet<object>();

/**
 * Opens the doors on a dev server, once whichever door's plugin asks
 * first: the address that trades the key for the cookie, and that address
 * said in the terminal once the server is listening.
 */
export function openDoors(server: DevServer): void {
  if (opened.has(server)) return;
  opened.add(server);
  server.middlewares.use(doorLogin);
  const say = (port: number) => {
    const line = `  Graview's doors: open http://localhost:${port}/?${DOOR_KEY_PARAM}=${doorKey()} (the key is kept in ${doorKeyFile()})`;
    if (server.config?.logger) server.config.logger.info(line);
    else process.stdout.write(`${line}\n`);
  };
  const http = server.httpServer;
  if (!http) return;
  const now = http.address() as AddressInfo | string | null;
  if (now && typeof now === "object") say(now.port);
  else
    http.once("listening", () => {
      const at = http.address() as AddressInfo | string | null;
      if (at && typeof at === "object") say(at.port);
    });
}

/** The request's body, refused past `limit` bytes with a sentence saying what was too much. */
export function readBody(req: IncomingMessage, limit: number, what = "request"): Promise<string> {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk: Buffer) => {
      body += chunk.toString();
      if (body.length > limit) {
        reject(new Error(`That is more than ${Math.round(limit / 1_000_000)} MB of ${what} — send fewer, or smaller.`));
        req.destroy();
      }
    });
    req.on("end", () => resolve(body));
    req.on("error", reject);
  });
}

export function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader("content-type", "application/json");
  res.end(JSON.stringify(body));
}

/** The part of Vite's dev server a door's plugin uses, without importing Vite to say it. */
export interface DevServer {
  middlewares: {
    use(path: string, handler: (req: IncomingMessage, res: ServerResponse) => void): void;
    use(handler: (req: IncomingMessage, res: ServerResponse, next: () => void) => void): void;
  };
  readonly httpServer?: { address(): AddressInfo | string | null; once(event: "listening", listener: () => void): unknown } | null;
  readonly config?: { readonly logger?: { info(message: string): void } };
}

/** The shape of the Vite plugin object, without importing Vite to say it. */
export interface DevServerPlugin {
  readonly name: string;
  readonly apply: "serve";
  configureServer(server: DevServer): void;
}
