#!/usr/bin/env node
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import type { GraviewApp } from "@graview/core";
import { createFileAdapter } from "./file-adapter.js";
import { serveStore } from "./serve.js";

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
      Serves the app's store over HTTP. The op log is the wire: a client
      sends calls, the store judges them under the caller's own seat, and
      the ops come back. Data lives in <dir> (default ./data) as readable
      JSON, or in a SQLite file with --sqlite.
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  if (at === -1) return undefined;
  return argv[at + 1];
}

export async function serve(argv: readonly string[]): Promise<number> {
  const entry = argv[0];
  if (!entry || entry.startsWith("--")) {
    process.stderr.write(`graview serve: an entry module is required\n\n${SERVE_USAGE}`);
    return 2;
  }
  const module = (await import(pathToFileURL(resolve(process.cwd(), entry)).href)) as Record<string, unknown>;
  const app = (module["default"] ?? module["app"]) as GraviewApp | undefined;
  if (!app || typeof app !== "object" || !("schema" in app)) {
    throw new Error(`${entry} does not export a GraviewApp. Export it as default, or as \`app\`.`);
  }

  const data = resolve(process.cwd(), flag(argv, "--data") ?? "data");
  const sqlite = flag(argv, "--sqlite");
  const port = Number(flag(argv, "--port") ?? 5196);
  const seedFile = flag(argv, "--seed");
  const seed = seedFile
    ? ((await import(pathToFileURL(resolve(process.cwd(), seedFile)).href, { with: { type: "json" } })) as {
        default: unknown;
      }).default
    : undefined;

  const adapter = sqlite ? await sqliteAdapter(resolve(process.cwd(), sqlite)) : createFileAdapter(data);
  const served = await serveStore({
    app: app as never,
    adapter,
    ...(seed ? { seed: seed as never } : {}),
    port,
    where: sqlite ? resolve(process.cwd(), sqlite) : data,
  });

  process.stdout.write(
    `graview serve: ${app.name} on ${served.url}\n` +
      `  data: ${sqlite ? resolve(process.cwd(), sqlite) : data}  (${adapter.name})\n` +
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

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const [, , command, ...rest] = process.argv;
  if (command !== "serve") {
    process.stderr.write(`graview-serve: unknown command "${command ?? ""}"\n\n${SERVE_USAGE}`);
    process.exit(2);
  }
  process.exitCode = await serve(rest);
}
