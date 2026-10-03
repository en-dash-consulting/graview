import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadApp } from "@graview/core/cli";
import type { GraviewApp, PersistenceAdapter } from "@graview/core";
import { createFileAdapter } from "./file-adapter.js";
import { openStore } from "./open-store.js";
import { serveStore } from "./serve.js";
import type { GraphSnapshot } from "./snapshot.js";
import { sayStep } from "./steps.js";
import { applySteps, seedSteps } from "./sync-seed.js";
import type { StoredMeta } from "./meta.js";

/**
 * `graview serve` — the store behind HTTP, and the data in a folder you can
 * open.
 *
 * The file adapter is the default because the point of this command is the
 * answer to "where is my data": a directory holding `snapshot.json`, a
 * `log.jsonl` with one operation per line that a person can `grep`, and a
 * `meta.json` carrying the stored version. `--sqlite` swaps the adapter and
 * changes nothing else, which is the actual claim about adapters.
 */
export const SERVE_USAGE = `  graview serve <entry> [--data <dir>] [--port <n>] [--seed <file>] [--sqlite <file>]
                       [--host <address>] [--trust-seat-headers]
      Serves the app's store over HTTP. The op log is the wire: a client
      sends calls, the store judges them under the caller's own seat, and
      the ops come back. Data lives in <dir> (default ./data) as readable
      JSON, or in a SQLite file with --sqlite. It listens on 127.0.0.1 and
      believes the seat a request names in its headers, because only this
      machine can reach it; on any other --host it will not start unless
      --trust-seat-headers says the network in front of it can be trusted.

  graview sync-seed <entry> --seed <file> [--data <dir> | --sqlite <file>]
                            [--apply] [--prune] [--json]
      Diffs the bootstrap seed against the live store and says, as content
      steps, what would bring the store in step with it: records put,
      fields patched, ties made. Prints and exits by default; --apply lands
      the steps as one logged, undoable operation; --prune also drops what
      the seed no longer has. The seed itself is only ever read at first
      install — this is how default content moves afterwards, in place of
      deleting the store.
`;

/** The same store, whichever command asked: parsed from the flags every store command shares. */
export const STORE_FLAGS = `--data <dir> (default ./data) | --sqlite <file>, and --seed <file> for a first install`;

export function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at === -1) return undefined;
  return argv[at + 1];
}

export interface StoreBackend {
  readonly adapter: PersistenceAdapter<string> & {
    loadMeta?(scope: string): StoredMeta | null;
    saveMeta?(scope: string, meta: StoredMeta): void;
  };
  /** Where the data is, in words a person can open. */
  readonly where: string;
  readonly seed?: GraphSnapshot;
}

/**
 * THE BACKEND FLAGS, PARSED ONCE. `serve`, `sync-seed`, `mcp` and `apply`
 * all take the same store: a folder of readable JSON, or a SQLite file, and
 * a seed for a first install. One parser, so the four commands cannot come
 * to mean different things by the same words.
 */
export async function backendFrom(argv: readonly string[], cwd = process.cwd()): Promise<StoreBackend> {
  const sqlite = flag(argv, "--sqlite");
  const data = resolve(cwd, flag(argv, "--data") ?? "data");
  const seedFile = flag(argv, "--seed");
  const seed = seedFile ? readSeed(resolve(cwd, seedFile)) : undefined;
  if (sqlite) {
    const file = resolve(cwd, sqlite);
    return { adapter: await sqliteAdapter(file), where: file, ...(seed ? { seed } : {}) };
  }
  return { adapter: createFileAdapter(data), where: data, ...(seed ? { seed } : {}) };
}

function readSeed(file: string): GraphSnapshot {
  const parsed = JSON.parse(readFileSync(file, "utf8")) as Partial<GraphSnapshot>;
  if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
    throw new Error(`${file} is not a graph snapshot: it needs "nodes" and "edges" arrays.`);
  }
  return parsed as GraphSnapshot;
}

/** The entry module, or the reason it is not one — said before anything is opened. */
async function entryOf(argv: readonly string[], command: string, usage: string): Promise<GraviewApp | number> {
  const entry = argv[0];
  if (!entry || entry.startsWith("--")) {
    process.stderr.write(`graview ${command}: an entry module is required\n\n${usage}`);
    return 2;
  }
  return loadApp(entry);
}

const LOOPBACK = new Set(["127.0.0.1", "::1", "localhost"]);

/**
 * WHETHER `graview serve` BELIEVES A SEAT HEADER (FR-06). Seat headers are
 * how the framework's own clients say who they are, and anyone who can
 * reach the server can send them. On loopback that is only this machine,
 * so they are believed and the command says so; anywhere else it refuses
 * to start unless told the network in front of it is trusted.
 */
export function seatTrust(host: string, trustFlag: boolean): { readonly trust: boolean; readonly says: string } | { readonly refuse: string } {
  if (LOOPBACK.has(host)) return { trust: true, says: `believes seat headers: listening on ${host}, which only this machine reaches` };
  if (trustFlag) return { trust: true, says: `believes seat headers on ${host}, because --trust-seat-headers says the network in front of it is trusted` };
  return {
    refuse:
      `graview serve: refusing to listen on ${host} while believing seat headers — anyone who can reach it could claim any seat.\n` +
      `  Serve on 127.0.0.1 (the default), put a host that authenticates in front with its own seatOf, or say --trust-seat-headers.\n`,
  };
}

export async function serve(argv: readonly string[]): Promise<number> {
  const app = await entryOf(argv, "serve", SERVE_USAGE);
  if (typeof app === "number") return app;
  const port = Number(flag(argv, "--port") ?? 5196);
  const host = flag(argv, "--host") ?? "127.0.0.1";
  const trust = seatTrust(host, argv.includes("--trust-seat-headers"));
  if ("refuse" in trust) {
    process.stderr.write(trust.refuse);
    return 1;
  }
  const backend = await backendFrom(argv);
  const served = await serveStore({
    app: app as never,
    adapter: backend.adapter,
    ...(backend.seed ? { seed: backend.seed } : {}),
    port,
    host,
    trustSeatHeaders: trust.trust,
    where: backend.where,
  });

  process.stdout.write(
    `graview serve: ${app.name} on ${served.url}\n` +
      `  data: ${backend.where}  (${backend.adapter.name})\n` +
      `  ${trust.says}\n` +
      `  ${served.store.graph.allNodes().length} nodes, ${served.opened.store.log.all().length} operations` +
      `${served.opened.migrated.length > 0 ? `, migrated: ${served.opened.migrated.map((op) => op.intent).join("; ")}` : ""}\n`,
  );
  const stop = () => {
    void served.close().then(() => process.exit(0));
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
  return 0;
}

/**
 * `graview sync-seed` — default content moves without a wipe.
 *
 * Read-only unless `--apply` is said, because the steps are the product: a
 * person or an agent reads what WOULD change and decides. Applying lands
 * them through `applySteps`, which is `receive` on the open store — the
 * adapter hears it like any change, the log carries it with its inverse,
 * and undo is the ordinary undo.
 */
export async function syncSeed(argv: readonly string[]): Promise<number> {
  const app = await entryOf(argv, "sync-seed", SERVE_USAGE);
  if (typeof app === "number") return app;
  if (flag(argv, "--remote-url")) {
    process.stderr.write(
      `graview sync-seed: runs where the data is — against --data or --sqlite on the host, not a remote URL.\n`,
    );
    return 2;
  }
  const backend = await backendFrom(argv);
  if (!backend.seed) {
    process.stderr.write(`graview sync-seed: --seed <file> is required\n\n${SERVE_USAGE}`);
    return 2;
  }
  const opened = await openStore({ app: app as never, adapter: backend.adapter, scope: app.name, seed: backend.seed });
  try {
    const live = opened.store.graph.snapshot() as GraphSnapshot;
    const steps = seedSteps(backend.seed, live, { prune: argv.includes("--prune") });
    const json = argv.includes("--json");
    if (steps.length === 0) {
      process.stdout.write(json ? `{"steps":[],"applied":null}\n` : `graview sync-seed: ${backend.where} already has everything the seed has.\n`);
      return 0;
    }
    if (!argv.includes("--apply")) {
      process.stdout.write(
        json
          ? `${JSON.stringify({ steps, applied: null }, null, 2)}\n`
          : `graview sync-seed: ${steps.length} step${steps.length === 1 ? "" : "s"} would bring ${backend.where} in step with the seed:\n` +
              steps.map((step) => `  ${sayStep(step)}\n`).join("") +
              `Nothing was written. Add --apply to land them as one undoable operation.\n`,
      );
      return 0;
    }
    const landed = applySteps(opened.store, steps);
    await opened.flush();
    if (!landed) {
      process.stdout.write(json ? `{"steps":[],"applied":null}\n` : `graview sync-seed: the steps came to nothing against ${backend.where}.\n`);
      return 0;
    }
    process.stdout.write(
      json
        ? `${JSON.stringify({ steps, applied: { id: landed.id, batch: landed.batch, primitives: landed.primitives.length } }, null, 2)}\n`
        : `graview sync-seed: landed ${landed.primitives.length} change${landed.primitives.length === 1 ? "" : "s"} on ${backend.where} as batch ${landed.batch}.\n` +
            steps.map((step) => `  ${sayStep(step)}\n`).join("") +
            `Undo with: graview apply <entry> --undo ${JSON.stringify(landed.batch)} [--data|--sqlite as above]\n`,
    );
    return 0;
  } finally {
    opened.close();
  }
}

/**
 * The sqlite adapter, imported only when asked for.
 *
 * `better-sqlite3` is a native module. A static import would make every
 * `graview serve` — and every bundler that ever saw this file — need it
 * built, for a flag most people never pass.
 */
async function sqliteAdapter(file: string) {
  const { createSqliteAdapter } = await import("@graview/core");
  const { default: Database } = (await import("better-sqlite3" as string)) as {
    default: new (path: string) => never;
  };
  // `createTables` because this is the "point it at a file" case: an app
  // with its own Drizzle schema passes its own database and leaves it alone.
  return createSqliteAdapter({ database: new Database(file), createTables: true });
}

