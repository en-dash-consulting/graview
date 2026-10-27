import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { Agent, get } from "node:http";
import { connect, type Socket } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

/**
 * A PREVIEW STOPS WHEN IT IS TOLD TO, whoever still has it open.
 *
 * A product ran `graview preview app.json --seed seed.json --data data`
 * behind a Vite dev server that proxied `/graview` to it, live socket and
 * all, with a browser open. `kill <pid>` and `kill -INT` left it running:
 * closing the server waited on the proxied socket, which never went. Only
 * `kill -9` stopped it, and the data folder's lock went on naming the dead
 * process. A stop now closes every live socket and keep-alive connection
 * after a short grace, exits, and lets the data folder go.
 *
 * The command is run as a stranger runs it, from the built bin, so the
 * signal reaches the real process.
 */
const CLI = fileURLToPath(new URL("../../dist/cli.js", import.meta.url));
const ORG = fileURLToPath(new URL("../../../core/tests/document/fixtures/org.gdd.json", import.meta.url));
const ORG_SEED = fileURLToPath(new URL("../../../core/tests/document/fixtures/org.seed.json", import.meta.url));
// Outside the checkout's harness ports (5190–5289): a worktree's own hundred.
const BASE = Number(process.env.GRAVIEW_PORT_BASE ?? 5700);

/*
 * The preview page is built by `pnpm build`'s last step, which a test job
 * that only typechecks never runs: build it here when it isn't there, so the
 * stop is proven on CI too rather than skipped.
 */
const PAGE = fileURLToPath(new URL("../../dist/preview/index.html", import.meta.url));
const BUILD_PAGE = fileURLToPath(new URL("../../../../scripts/build-preview-page.mjs", import.meta.url));
beforeAll(() => {
  if (!existsSync(PAGE)) execFileSync(process.execPath, [BUILD_PAGE], { stdio: "ignore" });
}, 120_000);

let child: ChildProcess | undefined;
let folder: string | undefined;
const sockets: Socket[] = [];
afterEach(() => {
  for (const socket of sockets.splice(0)) socket.destroy();
  if (child && child.exitCode === null && child.signalCode === null) child.kill("SIGKILL");
  child = undefined;
  if (folder) rmSync(folder, { recursive: true, force: true });
  folder = undefined;
});

/** The run's key the preview is handed: a loopback preview answers nothing but health without it. */
const KEY = "a-key-for-the-preview-that-stops-0123456789";

/** Starts the preview on `port` and resolves once it says where it listens. */
function startPreview(port: number, data: string): Promise<{ url: string; output: () => string }> {
  // This run's key, named here as a harness names it, so the requests below carry it.
  const started = spawn(process.execPath, [CLI, "preview", ORG, "--seed", ORG_SEED, "--data", data, "--port", String(port)], { stdio: ["ignore", "pipe", "pipe"], env: { ...process.env, GRAVIEW_SERVE_KEY: KEY } });
  child = started;
  let said = "";
  started.stdout!.on("data", (chunk) => (said += String(chunk)));
  started.stderr!.on("data", (chunk) => (said += String(chunk)));
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`the preview did not start:\n${said}`)), 20_000);
    started.stdout!.on("data", () => {
      const url = /on (http:\/\/\S+)/.exec(said)?.[1];
      if (url) {
        clearTimeout(timer);
        resolve({ url, output: () => said });
      }
    });
    started.on("exit", () => reject(new Error(`the preview exited before it listened:\n${said}`)));
  });
}

/** A live socket on the preview's wire, upgraded and left open, as a proxied page leaves it. */
function openLiveSocket(port: number): Promise<Socket> {
  return new Promise((resolve, reject) => {
    // Half open, as a proxy holds it: told the store is closing, it keeps its own side until it is cut.
    const socket = connect({ port, host: "127.0.0.1", allowHalfOpen: true });
    sockets.push(socket);
    socket.on("error", () => {});
    socket.once("connect", () =>
      socket.write(
        `GET /graview/live HTTP/1.1\r\nHost: 127.0.0.1\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nX-Graview-Key: ${KEY}\r\n` +
          "Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\n\r\n",
      ),
    );
    let heard = "";
    const listen = (chunk: Buffer) => {
      heard += chunk.toString("latin1");
      if (!heard.includes("\r\n\r\n")) return;
      socket.off("data", listen);
      if (heard.startsWith("HTTP/1.1 101")) resolve(socket);
      else reject(new Error(`the live wire was not opened:\n${heard}`));
    };
    socket.on("data", listen);
  });
}

/** A keep-alive HTTP connection: one answered request, and the connection kept by its agent. */
async function holdKeepAlive(url: string): Promise<Agent> {
  const agent = new Agent({ keepAlive: true, keepAliveMsecs: 60_000 });
  await new Promise<void>((resolve, reject) => {
    get(`${url}/graview/document`, { agent, headers: { "x-graview-key": KEY } }, (response) => {
      response.resume();
      response.on("end", () => resolve());
    }).on("error", reject);
  });
  return agent;
}

const exited = (process: ChildProcess, within: number): Promise<number | string> =>
  new Promise((resolve) => {
    const timer = setTimeout(() => resolve("still running"), within);
    process.once("exit", (code, signal) => {
      clearTimeout(timer);
      resolve(code ?? `killed by ${signal}`);
    });
  });

describe.each([
  ["SIGTERM", 71],
  ["SIGINT", 72],
] as const)("a preview with a live socket and a keep-alive connection open, sent %s", (signal, offset) => {
  it("closes them, exits within three seconds and lets its data folder go", async () => {
    expect(existsSync(CLI), "the graview bin is built (pnpm build)").toBe(true);
    folder = mkdtempSync(join(tmpdir(), "graview-preview-stop-"));
    const port = BASE + offset;
    const { url, output } = await startPreview(port, folder);
    const lock = join(folder, "graview.lock");
    expect(JSON.parse(readFileSync(lock, "utf8")).pid).toBe(child!.pid);

    const live = await openLiveSocket(port);
    const agent = await holdKeepAlive(url);
    try {
      const running = child!;
      running.kill(signal);
      const code = await exited(running, 3_000);
      expect(code, output()).toBe(0);
      expect(existsSync(lock), "the data folder's lock is gone").toBe(false);
      expect(live.destroyed || live.readableEnded).toBe(true);
    } finally {
      agent.destroy();
    }
  }, 30_000);
});

describe("a data folder whose lock names a process that is gone", () => {
  it("is taken over, and the preview says it took it over", async () => {
    expect(existsSync(CLI), "the graview bin is built (pnpm build)").toBe(true);
    folder = mkdtempSync(join(tmpdir(), "graview-preview-stale-"));
    // A pid nothing answers to: the preview that wrote it was killed with -9.
    writeFileSync(join(folder, "graview.lock"), JSON.stringify({ command: "preview", pid: 2 ** 22 + 12345, since: "2026-10-20T00:00:00.000Z" }));
    const { output } = await startPreview(BASE + 73, folder);
    const running = child!;
    expect(JSON.parse(readFileSync(join(folder, "graview.lock"), "utf8")).pid).toBe(running.pid);
    expect(output()).toMatch(/took over .*pid 4206649.* no longer running/);
    running.kill("SIGTERM");
    expect(await exited(running, 3_000), output()).toBe(0);
  }, 30_000);
});
