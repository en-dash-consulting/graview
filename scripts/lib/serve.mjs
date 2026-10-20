/**
 * The app a harness drives, whether or not somebody already has it open.
 *
 * Every harness span its own `vite` and waited for the port number to
 * appear on stdout. That works exactly once: with a dev server already
 * holding the app's port — which is how anyone actually working on the app
 * leaves it — the second vite picks the next port instead, the readiness
 * match never fires, and the harness dies with "vite did not start" sixty seconds later. A harness
 * you cannot run while the app is open is a harness nobody runs.
 *
 * So: ask the port first. If this checkout's server for the app is already
 * answering there, drive that and leave it alone afterwards. If somebody
 * else's is, say whose and stop. Otherwise start one and own it.
 */
import { execFileSync, spawn } from "node:child_process";
import { existsSync, readlinkSync, realpathSync } from "node:fs";
import { connect } from "node:net";
import { isAbsolute, resolve } from "node:path";

/** Whether anything accepts a connection on `port` at `address`. */
const accepts = (port, address) =>
  new Promise((done) => {
    const socket = connect({ port, host: address });
    const end = (yes) => {
      socket.destroy();
      done(yes);
    };
    socket.setTimeout(1_000, () => end(false));
    socket.once("connect", () => end(true));
    socket.once("error", () => end(false));
  });

/**
 * WHETHER THE PORT IS HELD, on either loopback. A server bound to
 * 127.0.0.1 alone leaves `::` free to another listen — Node's
 * `server.listen(port)` succeeds beside another project's vite, and the
 * browser, asking for `localhost`, reaches whichever address it tries
 * first. So a port is free only when neither 127.0.0.1 nor ::1 answers.
 */
export async function held(port) {
  const [four, six] = await Promise.all([accepts(port, "127.0.0.1"), accepts(port, "::1")]);
  return four || six;
}

/** A command's output, or null when the machine has no such command. */
const run = (file, args) => {
  try {
    return execFileSync(file, args, { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 5_000 });
  } catch (error) {
    // lsof exits 1 when it finds nothing, and still prints what it did find.
    return typeof error?.stdout === "string" ? error.stdout : null;
  }
};

const real = (path) => {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
};

/** A process's working directory: /proc where there is one, lsof elsewhere. */
const cwdOf = (pid) => {
  if (existsSync(`/proc/${pid}/cwd`)) {
    try {
      return readlinkSync(`/proc/${pid}/cwd`);
    } catch {
      // Another user's process: say nothing rather than guess.
    }
  }
  const line = run("lsof", ["-a", "-p", String(pid), "-d", "cwd", "-Fn"])
    ?.split("\n")
    .find((one) => one.startsWith("n"));
  return line ? line.slice(1) : null;
};

/**
 * WHO LISTENS ON EACH PORT from `from` to `to`, by process: its id, its
 * command line and the directory it runs in — one `lsof` for the lot.
 * `null` when the machine cannot say (no lsof), which every caller reads as
 * "not known to be ours".
 *
 * @returns {Map<number, { pid: number, command: string, cwd: string | null }> | null}
 */
export function listeners(from, to = from) {
  const said = run("lsof", ["-nP", `-iTCP:${from}-${to}`, "-sTCP:LISTEN", "-Fpn"]);
  if (said === null) return null;
  const found = new Map();
  let pid = 0;
  for (const line of said.split("\n")) {
    if (line.startsWith("p")) pid = Number(line.slice(1));
    const port = line.startsWith("n") ? Number(/:(\d+)$/.exec(line)?.[1]) : 0;
    if (pid && port >= from && port <= to && !found.has(port)) {
      found.set(port, { pid, command: run("ps", ["-o", "command=", "-p", String(pid)])?.trim() ?? "", cwd: cwdOf(pid) });
    }
  }
  return found;
}

/** The process listening on `port`, or null when nothing does or the machine cannot say. */
export const holderOf = (port) => listeners(port)?.get(port) ?? null;

/** Where an app named to `serving` lives: a directory under `apps/`, or an absolute path beside the checkout. */
export const appDir = (app, repoRoot) => (isAbsolute(app) ? app : resolve(repoRoot, "apps", app));

/**
 * WHETHER A LISTENER IS THIS CHECKOUT'S SERVER FOR THIS APP: its process
 * runs in the app's own directory, as `vite` does when `pnpm dev` or
 * `serving` starts it. Anything else — another project's vite, a `graview
 * preview` of somebody's document, the same app in another checkout, a
 * process the machine will not describe — is not.
 */
export const isOurs = (holder, dir) => Boolean(holder?.cwd) && real(holder.cwd) === real(dir);

/** A listener in words: `pid 74697 (node …/vite --port <port>) in /its/directory`. */
export const described = (holder) => {
  if (!holder) return "a process this machine will not name";
  const command = holder.command.length > 100 ? `${holder.command.slice(0, 99)}…` : holder.command || "a process";
  return `pid ${holder.pid} (${command})${holder.cwd ? ` in ${holder.cwd}` : ""}`;
};

const REMEDY = "run with GRAVIEW_PORT_BASE=5600 (any free hundred), or stop that server";

/**
 * A PORT A HARNESS IS ABOUT TO LISTEN ON, OR START A SERVER ON, MUST BE
 * FREE: `vacant(port, …)` throws, naming the holder, when one is not. A
 * harness's own host page listening beside another project's server is the
 * same mistake as borrowing that server.
 */
export async function vacant(...ports) {
  for (const port of ports) {
    if (await held(port)) throw new Error(`port ${port} is already held by ${described(holderOf(port))}; ${REMEDY}`);
  }
}

/**
 * WHAT ALREADY HOLDS THE PORTS NAMED (`namedPorts()` of lib/ports.mjs),
 * each said by whose it is: `ours` only for an app's port held by this
 * checkout's server for that app. A harness's own port held by anything,
 * or an app's held by anyone else, is not — and a harness there would drive
 * or listen beside somebody else's server.
 *
 * @param {{ name: string, port: number, app: string | null }[]} named
 */
export async function holders(named) {
  if (named.length === 0) return [];
  const ports = named.map((one) => one.port);
  const who = listeners(Math.min(...ports), Math.max(...ports));
  const found = await Promise.all(
    named.map(async (one) => {
      if (!(await held(one.port))) return null;
      const holder = who?.get(one.port) ?? null;
      return { ...one, holder, ours: one.app !== null && isOurs(holder, one.app) };
    }),
  );
  return found.filter(Boolean).sort((a, b) => a.port - b.port);
}

/*
 * THE SERVERS THIS PROCESS STARTED go with it. Each vite is detached (its
 * own process group, so `stop` takes its children too), which also means a
 * harness stopped from outside — `verify-all` past its limit — would leave
 * them holding their ports. A SIGTERM stops them first.
 */
const owned = new Set();
let listening = false;
const stopOnTerm = () => {
  if (listening) return;
  listening = true;
  process.once("SIGTERM", () => {
    for (const stop of [...owned]) stop();
    process.exit(143);
  });
};

/**
 * @param {string} app  directory under `apps/`, or an absolute path to an app beside the checkout
 * @param {number} port the port to serve it on: `portFor(app)` (lib/ports.mjs), moved onto GRAVIEW_PORT_BASE
 * @param {string} repoRoot
 * @returns {Promise<{ url: string, borrowed: boolean, stop: () => void }>}
 */
export async function serving(app, port, repoRoot) {
  const url = `http://localhost:${port}`;
  const dir = appDir(app, repoRoot);
  if (await held(port)) {
    /*
     * BORROW ONLY THIS CHECKOUT'S SERVER. This asked the server for the
     * app's page by absolute path (`/@fs/…/apps/todo/index.html`), and
     * another project's servers answered that too: a vite whose `fs.allow`
     * reaches a sibling framework checkout serves the file, and a `graview
     * preview` answers every path with its own page — so twenty-nine
     * harnesses drove somebody else's app. The process listening says
     * whose server it is: one running in this app's directory is ours.
     */
    const holder = holderOf(port);
    if (!isOurs(holder, dir)) {
      throw new Error(`port ${port} is held by ${described(holder)}, not this checkout's ${isAbsolute(app) ? app : `apps/${app}`}; ${REMEDY}`);
    }
    return { url, borrowed: true, stop: () => {} };
  }

  // The port asked for, said to vite: a harness on a moved port base must not land on the config's.
  const child = spawn("npx", ["vite", "--port", String(port), "--strictPort"], {
    cwd: dir,
    // No model key: what a harness sees must not depend on a model's answer (the seat says how to turn one on instead).
    env: { ...process.env, ANTHROPIC_API_KEY: "" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  const stop = () => {
    owned.delete(stop);
    try {
      process.kill(-child.pid, "SIGTERM");
    } catch {
      child.kill("SIGTERM");
    }
  };
  owned.add(stop);
  stopOnTerm();
  await new Promise((ready, fail) => {
    const timer = setTimeout(() => {
      stop();
      fail(new Error(`vite for ${app} did not start on ${port}`));
    }, 60_000);
    const settle = () => {
      clearTimeout(timer);
      ready(undefined);
    };
    child.stdout.on("data", (chunk) => {
      if (String(chunk).includes(String(port))) settle();
    });
    child.on("exit", (code) => {
      clearTimeout(timer);
      fail(new Error(`vite for ${app} exited with ${code}`));
    });
  });
  return { url, borrowed: false, stop };
}
