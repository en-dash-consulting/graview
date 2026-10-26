import { mkdir, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { createServer, request as httpRequest, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { DOOR_KEY_PARAM, doorCookie, doorKey, doorKeyFile, doorLogin, openDoors, studioDoor, studioDoorHandler } from "../../src/dev.js";

/*
 * A DEV DOOR ANSWERS ONLY THE PAGE THE PERSON OPENED. A browser says where a
 * request came from; a program that is no browser says nothing — another
 * account on this machine, a container sharing its loopback, a neighbor
 * when the server listens on the network — and to the origin check alone it
 * looked like the page. Every door now asks for a key as well: kept in a
 * file only this machine's user reads, said in the terminal as the address
 * to open, traded there for a cookie only this server's pages send, and
 * never in anything the server serves.
 */
const KEY = "a-dev-door-test-key-0123456789abcdef";
const saved = { key: process.env["GRAVIEW_DOOR_KEY"], file: process.env["GRAVIEW_DOOR_KEY_FILE"] };
beforeAll(() => {
  process.env["GRAVIEW_DOOR_KEY"] = KEY;
});
afterAll(() => {
  if (saved.key === undefined) delete process.env["GRAVIEW_DOOR_KEY"];
  else process.env["GRAVIEW_DOOR_KEY"] = saved.key;
});

/** One raw request, with exactly the headers given — no Origin unless it is said, as a program that is no browser sends it. */
function raw(port: number, method: string, path: string, headers: Record<string, string>, body?: string): Promise<{ status: number; headers: Record<string, string | string[] | undefined>; body: string }> {
  return new Promise((done, fail) => {
    const asked = httpRequest({ host: "127.0.0.1", port, method, path, headers, setHost: false }, (response) => {
      let text = "";
      response.on("data", (chunk: Buffer) => (text += chunk.toString()));
      response.on("end", () => done({ status: response.statusCode ?? 0, headers: response.headers, body: text }));
    });
    asked.on("error", fail);
    asked.end(body);
  });
}

describe("the studio door, knocked on by a program that is not the page", () => {
  let root: string;
  let server: Server;
  let port: number;
  beforeAll(async () => {
    root = await mkdtemp(join(tmpdir(), "graview-door-"));
    await mkdir(join(root, "src/domain"), { recursive: true });
    await writeFile(join(root, "src/domain/schema.ts"), 'export const schema = defineMutation("tend", { apply: () => [] });\n');
    const door = studioDoorHandler({ root, typecheck: false });
    server = createServer((req, res) => {
      doorLogin(req, res, () => {
        if ((req.url ?? "").startsWith("/__graview/studio")) {
          req.url = req.url!.slice("/__graview/studio".length) || "/";
          void door(req, res);
          return;
        }
        // Anything else is the app's page, as Vite would serve it to whoever asks.
        res.setHeader("content-type", "text/html");
        res.end("<!doctype html><title>the app</title><div id=root></div>");
      });
    });
    await new Promise<void>((ready) => server.listen(0, "127.0.0.1", ready));
    port = (server.address() as AddressInfo).port;
  });
  afterAll(async () => {
    await new Promise<void>((done) => server.close(() => done()));
    await rm(root, { recursive: true, force: true });
  });

  const change = JSON.stringify({ changes: [{ what: "replace-act", act: "tend", text: '{ apply: () => { (globalThis as any).PEER = 1; return []; } }' }] });

  it("refuses one that sends no Origin and no key, on a loopback or a network Host, and writes nothing", async () => {
    for (const host of [`127.0.0.1:${port}`, `localhost:${port}`, `192.168.1.20:${port}`]) {
      const answer = await raw(port, "POST", "/__graview/studio", { host, "content-type": "application/json" }, change);
      expect(answer.status).toBe(403);
      expect((await raw(port, "GET", "/__graview/studio/source", { host })).status).toBe(403);
    }
    // Nor does the key help one that names a host on the network: that is not this machine as its own pages name it.
    expect((await raw(port, "POST", "/__graview/studio", { host: `192.168.1.20:${port}`, cookie: doorCookie(), "content-type": "application/json" }, change)).status).toBe(403);
    expect(await readFile(join(root, "src/domain/schema.ts"), "utf8")).not.toContain("PEER");
  });

  it("lets in the page opened from the printed address: the key traded for a cookie, the address tidied", async () => {
    const login = await raw(port, "GET", `/places/home?${DOOR_KEY_PARAM}=${KEY}&today=2026-09-01`, { host: `localhost:${port}` });
    expect(login.status).toBe(303);
    expect(login.headers["location"]).toBe("/places/home?today=2026-09-01");
    const cookie = String(login.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
    const held = cookie.split(";")[0]!;
    const answer = await raw(port, "POST", "/__graview/studio", { host: `localhost:${port}`, origin: `http://localhost:${port}`, cookie: held, "content-type": "application/json" }, change);
    expect(answer.status).toBe(200);
    expect(JSON.parse(answer.body).written).toEqual(["src/domain/schema.ts"]);
  });

  it("lets in nobody for a wrong key, and sends a key-shaped address only back to a path on this server", async () => {
    const wrong = await raw(port, "GET", `/?${DOOR_KEY_PARAM}=not-the-key`, { host: `localhost:${port}` });
    expect(wrong.status).toBe(303);
    expect(wrong.headers["set-cookie"]).toBeUndefined();
    const away = await raw(port, "GET", `//elsewhere.example/?${DOOR_KEY_PARAM}=${KEY}`, { host: `localhost:${port}` });
    expect(away.headers["location"]).toBe("/");
  });

  it("never says the key in anything it serves: not the page, not a door's answer, not the trade", async () => {
    const answers = [
      await raw(port, "GET", "/", { host: `localhost:${port}` }),
      await raw(port, "GET", "/index.html", { host: `localhost:${port}` }),
      await raw(port, "GET", "/__graview/studio", { host: `localhost:${port}` }),
      await raw(port, "GET", "/__graview/studio", { host: `localhost:${port}`, cookie: doorCookie() }),
      await raw(port, "GET", `/?${DOOR_KEY_PARAM}=${KEY}`, { host: `localhost:${port}` }),
    ];
    for (const answer of answers) {
      expect(answer.body).not.toContain(KEY);
      expect(String(answer.headers["location"] ?? "")).not.toContain(KEY);
    }
  });
});

describe("the door's key", () => {
  let home: string;
  afterEach(async () => {
    process.env["GRAVIEW_DOOR_KEY"] = KEY;
    delete process.env["GRAVIEW_DOOR_KEY_FILE"];
    if (saved.file !== undefined) process.env["GRAVIEW_DOOR_KEY_FILE"] = saved.file;
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("graview.door.key")];
    if (home) await rm(home, { recursive: true, force: true });
  });

  it("is made once, kept where only this machine's user reads it, and taken again by the next server", async () => {
    home = await mkdtemp(join(tmpdir(), "graview-door-home-"));
    delete process.env["GRAVIEW_DOOR_KEY"];
    process.env["GRAVIEW_DOOR_KEY_FILE"] = join(home, ".graview", "door-key");
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("graview.door.key")];
    const key = doorKey();
    expect(key).toMatch(/^[\w-]{43}$/);
    expect(doorKeyFile()).toBe(join(home, ".graview", "door-key"));
    expect((await readFile(doorKeyFile(), "utf8")).trim()).toBe(key);
    if (process.platform !== "win32") expect((await stat(doorKeyFile())).mode & 0o777).toBe(0o600);
    // A dev server started again, in a process of its own, reads the same key.
    delete (globalThis as Record<symbol, unknown>)[Symbol.for("graview.door.key")];
    expect(doorKey()).toBe(key);
  });

  it("is said in the terminal the server runs in, once, as the address to open", () => {
    const info = vi.fn();
    const use = vi.fn();
    const listeners: (() => void)[] = [];
    const server = { middlewares: { use }, config: { logger: { info } }, httpServer: { address: () => null, once: (_event: "listening", listener: () => void) => void listeners.push(listener) } };
    studioDoor().configureServer(server as never);
    openDoors(server as never);
    expect(use.mock.calls.filter(([first]) => first === doorLogin)).toHaveLength(1);
    server.httpServer.address = () => ({ port: 5173, address: "127.0.0.1", family: "IPv4" }) as never;
    for (const listener of listeners) listener();
    expect(info).toHaveBeenCalledTimes(1);
    expect(info.mock.calls[0]![0]).toContain(`http://localhost:5173/?${DOOR_KEY_PARAM}=${KEY}`);
  });
});
