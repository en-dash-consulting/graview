import { execFile, spawn } from "node:child_process";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import type { IncomingMessage, ServerResponse } from "node:http";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  DECISION_BRIDGE_PATH,
  LOCAL_BRIDGE_PATH,
  type DecisionBridgeAnswer,
  type DecisionBridgeAsk,
  type DecisionBridgeStatus,
  type LocalBridgeAnswer,
  type LocalBridgeAsk,
  type LocalBridgeStatus,
} from "@graview/core";
import { fromThisApp, readBody, sendJson, type DevServerPlugin } from "./door.js";

export { sameOrigin } from "./door.js";
export type { DevServerPlugin } from "./door.js";

/**
 * THE FOURTH DOOR: a process on this machine, and the dev server as the
 * only thing that can open it.
 *
 * `openStore` is the lifecycle every deployment repeats — an adapter, a
 * version, migrations. There was nothing equivalent for the other thing a
 * locally-run product has and a deployed one does not: A MACHINE WITH TOOLS
 * ON IT. Somebody running an app from `pnpm dev` very often has a coding
 * agent installed, logged in and paid for; the browser cannot spawn it and
 * the dev server can. Every product with a `local` reach was going to write
 * this file, and the first one that did paid for it in hung processes.
 *
 * What it learned, each item the price of one:
 *
 * - `claude -p` READS STDIN when stdin is not a terminal. Spawned with an
 *   open pipe it waits forever. Stdin is closed here, always.
 * - A session spawned from inside another session inherits the parent's
 *   `CLAUDE*` environment and misbehaves. Every such variable is stripped,
 *   because "the dev server was started from a Claude Code terminal" is the
 *   normal case for the person this is for.
 * - Given Bash, a model will spend ten turns trying to decode an image it
 *   cannot see. Read and only Read, a turn cap of one per photograph plus a
 *   few to answer in, and a dollar budget, keep a bad answer cheap and short.
 *
 * It is a DEV-SERVER plugin and nothing else. A built deployment has no
 * server here: the probe gets a 404 and the door reads as closed, which is
 * exactly right. And it answers same-origin callers only — a dev server
 * allows every origin by default, and a page on another site must not be
 * able to spend this machine's session.
 */

export interface Spawned {
  readonly code: number | null;
  readonly stdout: string;
  readonly stderr: string;
}

/** Runs a command to completion. Injected, so a test never starts a real session. */
export type Runner = (
  command: string,
  args: readonly string[],
  options: { readonly cwd: string; readonly env: NodeJS.ProcessEnv; readonly timeoutMs: number },
) => Promise<Spawned>;

export interface LocalIntelligenceOptions {
  /** The executable. `claude` on PATH unless said otherwise. */
  readonly command?: string;
  /** The path the door answers on. Must match the provider's `bridge`. */
  readonly path?: string;
  /** A model alias for `--model`; the CLI's own default when absent. */
  readonly model?: string;
  /** How long one answer may take. Ten minutes: a dozen photographs is a slow read. */
  readonly timeoutMs?: number;
  /** The most one answer may cost, in dollars. */
  readonly budgetUsd?: number;
  /** The most one request may carry, in bytes. Photographs are large. */
  readonly limitBytes?: number;
  /** How the command is run. Injected by tests; `runProcess` otherwise. */
  readonly run?: Runner;
  /** The argv for a prompt and the photograph filenames beside it. */
  readonly argv?: (
    prompt: string,
    files: readonly string[],
    options: LocalIntelligenceOptions,
  ) => readonly string[];
  /** What the command printed, read back as text. Throws with a sentence. */
  readonly parse?: (stdout: string) => string;
}

const DEFAULTS = {
  command: "claude",
  timeoutMs: 10 * 60 * 1000,
  budgetUsd: 5,
  limitBytes: 40_000_000,
} as const;

/** Runs a command with stdin closed, returning what it wrote. */
export const runProcess: Runner = (command, args, { cwd, env, timeoutMs }) =>
  new Promise((resolve, reject) => {
    const child = spawn(command, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"] });
    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk: Buffer) => (stdout += chunk.toString()));
    child.stderr.on("data", (chunk: Buffer) => (stderr += chunk.toString()));
    const timer = setTimeout(() => {
      child.kill("SIGTERM");
      reject(
        new Error(
          `The local session did not answer within ${Math.round(timeoutMs / 60000)} minutes and was stopped.`,
        ),
      );
    }, timeoutMs);
    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ code, stdout, stderr });
    });
  });

/** The environment a spawned session gets: this one, minus the parent session's own. */
export function environmentFor(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = {};
  for (const [key, value] of Object.entries(env)) {
    if (key.startsWith("CLAUDE")) continue;
    out[key] = value;
  }
  return out;
}

/** A data URL to bytes and an extension a Read tool will treat as an image. */
export function decodePhoto(dataUrl: string): { readonly bytes: Buffer; readonly extension: string } {
  const match = /^data:image\/(jpeg|jpg|png|webp|gif);base64,(.+)$/s.exec(dataUrl);
  if (match === null) {
    throw new Error("A photograph must be a base64 data URL of a JPEG, PNG, WebP or GIF.");
  }
  const extension = match[1] === "jpeg" ? "jpg" : match[1]!;
  return { bytes: Buffer.from(match[2]!, "base64"), extension };
}

/** The argv a Claude Code session is run with. Replaceable for another CLI. */
export function argumentsFor(
  prompt: string,
  files: readonly string[],
  options: LocalIntelligenceOptions,
): readonly string[] {
  const lead =
    files.length === 0
      ? ""
      : `The photographs are in this directory, at these paths: ${files.join(", ")}. ` +
        `Read every one of them with the Read tool before you answer.\n\n`;
  return [
    "-p",
    `${lead}${prompt}`,
    "--output-format",
    "json",
    "--no-session-persistence",
    // Read, and only Read. Bash would let a stuck model spend an hour
    // decoding pixels by hand; Write would let it change the machine.
    "--tools",
    "Read",
    "--allowedTools",
    "Read",
    // One turn per photograph, and a few to answer in.
    "--max-turns",
    String(files.length + 3),
    "--max-budget-usd",
    String(options.budgetUsd ?? DEFAULTS.budgetUsd),
    ...(options.model === undefined ? [] : ["--model", options.model]),
  ];
}

/** What `claude --output-format json` prints. */
interface CliResult {
  readonly result?: string;
  readonly is_error?: boolean;
  readonly subtype?: string;
}

/** Reads the CLI's JSON envelope, or says plainly what was wrong with it. */
export function parseEnvelope(stdout: string): string {
  let parsed: CliResult;
  try {
    parsed = JSON.parse(stdout) as CliResult;
  } catch {
    throw new Error(
      `The local session answered with something other than its JSON envelope: ${stdout.slice(0, 200)}`,
    );
  }
  if (parsed.is_error === true) {
    throw new Error(`The local session reported an error: ${parsed.result ?? parsed.subtype ?? "unnamed"}`);
  }
  if (typeof parsed.result !== "string" || parsed.result.trim().length === 0) {
    throw new Error(
      parsed.subtype === "error_max_turns"
        ? "The local session ran out of turns before answering — fewer photographs, or larger ones, usually fixes it."
        : "The local session answered with nothing at all.",
    );
  }
  return parsed.result;
}

/**
 * Photographs and a prompt in, text out.
 *
 * The temporary directory is the session's working directory, so a Read tool
 * needs no extra permission to see the files, and it is removed whatever
 * happens.
 */
export async function askLocally(
  ask: LocalBridgeAsk,
  options: LocalIntelligenceOptions = {},
): Promise<string> {
  const run = options.run ?? runProcess;
  const dir = await mkdtemp(join(tmpdir(), "graview-local-"));
  try {
    const files: string[] = [];
    for (const [index, photo] of (ask.photos ?? []).entries()) {
      const { bytes, extension } = decodePhoto(photo);
      const name = `photo-${index + 1}.${extension}`;
      await writeFile(join(dir, name), bytes);
      files.push(name);
    }
    const argv = (options.argv ?? argumentsFor)(ask.prompt, files, options);
    const result = await run(options.command ?? DEFAULTS.command, argv, {
      cwd: dir,
      env: environmentFor(process.env),
      timeoutMs: options.timeoutMs ?? DEFAULTS.timeoutMs,
    });
    if (result.code !== 0 && result.stdout.trim().length === 0) {
      throw new Error(
        `The local session stopped (exit ${String(result.code)}): ${
          result.stderr.trim() || "and said nothing"
        }`,
      );
    }
    return (options.parse ?? parseEnvelope)(result.stdout);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

/** Is the command on this machine? Cached: a version check per keystroke would be silly. */
export function probeLocal(options: LocalIntelligenceOptions = {}): () => Promise<LocalBridgeStatus> {
  let cached: { at: number; status: LocalBridgeStatus } | null = null;
  return async () => {
    if (cached !== null && Date.now() - cached.at < 60_000) return cached.status;
    const status = await new Promise<LocalBridgeStatus>((resolve) => {
      execFile(
        options.command ?? DEFAULTS.command,
        ["--version"],
        { env: environmentFor(process.env), timeout: 10_000 },
        (error, stdout) => {
          if (error) {
            resolve({
              available: false,
              reason: `Nothing to run on this machine (${error.message.split("\n")[0]})`,
            });
          } else resolve({ available: true, version: stdout.trim() });
        },
      );
    });
    cached = { at: Date.now(), status };
    return status;
  };
}

/** What the local and decision doors answer with, and nothing else. */
const send = (
  res: ServerResponse,
  status: number,
  body: LocalBridgeStatus | LocalBridgeAnswer | DecisionBridgeStatus | DecisionBridgeAnswer,
): void => sendJson(res, status, body);

/**
 * The request handler, without Vite around it — so a test can drive the door
 * with two fake messages rather than a server, and a host that is not Vite
 * can mount it wherever it mounts things.
 */
export function localIntelligenceHandler(options: LocalIntelligenceOptions = {}) {
  const probe = probeLocal(options);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!fromThisApp(req)) {
      send(res, 403, { error: "The local door answers this app only." });
      return;
    }
    if (req.method === "GET") {
      send(res, 200, await probe());
      return;
    }
    if (req.method !== "POST") {
      send(res, 405, { error: "GET to ask whether the door is open; POST to ask it something." });
      return;
    }
    try {
      const ask = JSON.parse(
        await readBody(req, options.limitBytes ?? DEFAULTS.limitBytes, "photographs"),
      ) as Partial<LocalBridgeAsk>;
      if (typeof ask.prompt !== "string") {
        send(res, 400, { error: "A request is { prompt, photos }." });
        return;
      }
      const photos = Array.isArray(ask.photos) ? ask.photos : [];
      send(res, 200, { text: await askLocally({ prompt: ask.prompt, photos }, options) });
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : String(error) });
    }
  };
}

/**
 * The Vite plugin. One path: GET says whether the door is open, POST walks
 * through it.
 *
 * `apply: "serve"` is the whole deployment story — a build never carries it,
 * so the probe 404s on a static host and the door reads as closed.
 */
export function localIntelligence(options: LocalIntelligenceOptions = {}): DevServerPlugin {
  const handler = localIntelligenceHandler(options);
  return {
    name: "graview:local-intelligence",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(options.path ?? LOCAL_BRIDGE_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}

/* ---------------------------------------------------- the decision door */

/**
 * THE DOOR TO A DECISION PROVIDER, with the key on this side of it.
 *
 * A browser page must not hold a service key, and the environment the dev
 * server runs in already does: `TYPESAFE_API_KEY`, set once by the person
 * who runs `pnpm dev`. So the page posts a state and a map of questions to
 * this path and the server forwards them with the key in the header — one
 * call, the provider's own shape, and the answer back untouched. GET says
 * whether the door is open, which is whether a key is set.
 *
 * Same-origin only, for the same reason as the local door: a page on some
 * other site must not spend this key. And the key is NEVER in a response,
 * a thrown error or a log line — a refused key is reported as refused.
 */
export interface DecisionBridgeOptions {
  /** The path the door answers on. Must match the provider's `bridge`. */
  readonly path?: string;
  /** Where the provider is. Its real endpoint unless a test says otherwise. */
  readonly endpoint?: string;
  readonly model?: string;
  /** Where the key is read from. The process environment unless a test says otherwise. */
  readonly env?: Readonly<Record<string, string | undefined>>;
  /** Injectable for tests. */
  readonly fetch?: (
    input: string,
    init: { method: string; headers: Record<string, string>; body: string },
  ) => Promise<{ status: number; text(): Promise<string> }>;
  /** The most one request may carry, in bytes. A fan-out over a big graph is large. */
  readonly limitBytes?: number;
}

const DECISION_DEFAULTS = {
  endpoint: "https://api.typesafe.ai/v1/systemone",
  model: "jev-latest",
  limitBytes: 4_000_000,
};

/** The key the door holds, from the documented name or the older one. */
export function decisionKey(env: Readonly<Record<string, string | undefined>> | undefined): string | undefined {
  const key = env?.["TYPESAFE_API_KEY"] || env?.["JEV_API_KEY"];
  return key && key.length > 0 ? key : undefined;
}

export function decisionBridgeHandler(options: DecisionBridgeOptions = {}) {
  const env = options.env ?? process.env;
  const endpoint = options.endpoint ?? DECISION_DEFAULTS.endpoint;
  const model = options.model ?? DECISION_DEFAULTS.model;
  const call = options.fetch ?? (globalThis.fetch as unknown as NonNullable<DecisionBridgeOptions["fetch"]>);
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    if (!fromThisApp(req)) {
      send(res, 403, { error: "The decision door answers this app only." });
      return;
    }
    const key = decisionKey(env);
    if (req.method === "GET") {
      send(
        res,
        200,
        key
          ? { available: true, model }
          : { available: false, reason: "No TYPESAFE_API_KEY in the environment this server was started from." },
      );
      return;
    }
    if (req.method !== "POST") {
      send(res, 405, { error: "GET to ask whether the door is open; POST a state and questions." });
      return;
    }
    if (!key) {
      send(res, 503, { error: "No TYPESAFE_API_KEY in the environment this server was started from.", status: 503 });
      return;
    }
    try {
      const ask = JSON.parse(await readBody(req, options.limitBytes ?? DECISION_DEFAULTS.limitBytes)) as Partial<DecisionBridgeAsk>;
      if (typeof ask.questions !== "object" || ask.questions === null) {
        send(res, 400, { error: "A request is { state, questions }.", status: 400 });
        return;
      }
      const upstream = await call(endpoint, {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
        body: JSON.stringify({ model, state: ask.state ?? null, questions: ask.questions }),
      });
      const text = await upstream.text();
      /*
       * The provider's status is the page's status, so the page-side
       * provider tells failures apart the same way it would have with the
       * key in hand — 401 a seat problem, 422 ours, 429/529 busy. The body
       * is passed through as it came: it never held the key.
       */
      res.statusCode = upstream.status;
      res.setHeader("content-type", "application/json");
      res.end(text);
    } catch (error) {
      send(res, 500, { error: error instanceof Error ? error.message : String(error), status: 500 });
    }
  };
}

/** The Vite plugin. One path; GET is the probe, POST is the ask. */
export function decisionBridge(options: DecisionBridgeOptions = {}): DevServerPlugin {
  const handler = decisionBridgeHandler(options);
  return {
    name: "graview:decision-bridge",
    apply: "serve",
    configureServer(server) {
      server.middlewares.use(options.path ?? DECISION_BRIDGE_PATH, (req, res) => {
        void handler(req, res);
      });
    },
  };
}

export { studioDoor, studioDoorHandler } from "./studio-door.js";
export type { StudioDoorOptions } from "./studio-door.js";
export { editDeclaration } from "./source-edit.js";
export type { SourceEdit, SourceText } from "./source-edit.js";
