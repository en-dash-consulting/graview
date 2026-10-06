import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Store, type AnySchema, type Principal } from "@graview/core";
import { loadApp } from "@graview/core/cli";
import type { WorkerViewManifest } from "./host/manifest.js";
import { runWorkerViewHeadless } from "./headless/index.js";
import { nodeIsolate } from "./headless/node.js";

/**
 * `graview view check` — run a worker view once, headless, and say what it
 * drew (FR-95).
 *
 * The view's source, its manifest, the app it is for and, given one, a seed
 * to run it over, seated as one member: it runs in a worker thread's fresh
 * context with no network (`@graview/guest/headless/node`) and the command
 * prints what it drew in the words `graview describe` says a place in, or
 * why it will not do. Exit 0 when it drew, 1 when it will not do.
 *
 * Reached through the `graview` command line, which dispatches here; this
 * package ships no bin of its own.
 */

export const VIEW_USAGE = `  graview view check <view.js> --app <app> --manifest <manifest.json>
                     [--seed <file>] [--as <id>] [--roles a,b] [--width <px>] [--json]
      run a worker view once, headless, with no network, seated as one
      member (the system, unless --as or --roles say who), and say what it
      drew, or why it will not do
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

const readJson = (file: string): unknown => JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8"));

export async function view(argv: readonly string[]): Promise<number> {
  const [command, file] = argv;
  if (command !== "check" || !file || file.startsWith("--")) {
    process.stdout.write(`graview view — a worker view, run where it can reach nothing\n\n${VIEW_USAGE}`);
    return command === undefined || command === "help" || command === "--help" ? 0 : 1;
  }
  const appAt = flag(argv, "--app");
  const manifestAt = flag(argv, "--manifest");
  if (!appAt || !manifestAt) {
    process.stderr.write(`graview view check needs --app and --manifest.\n\n${VIEW_USAGE}`);
    return 1;
  }
  const app = await loadApp(appAt);
  const seedAt = flag(argv, "--seed");
  const store = new Store<AnySchema>({
    schema: app.schema as AnySchema,
    mutations: (app.mutations ?? []) as never,
    ...(app.policy ? { policy: app.policy } : {}),
    ...(seedAt ? { snapshot: readJson(seedAt) as never } : {}),
  });
  const roles = (flag(argv, "--roles") ?? "").split(",").map((role) => role.trim()).filter(Boolean);
  const as = flag(argv, "--as");
  const principal: Principal = as || roles.length > 0 ? { kind: "human", id: as ?? "graview-view-check", ...(roles.length > 0 ? { roles } : {}) } : { kind: "system", id: "graview-view-check" };
  const width = flag(argv, "--width");
  const result = await runWorkerViewHeadless({
    store,
    principal,
    manifest: readJson(manifestAt) as WorkerViewManifest,
    source: readFileSync(resolve(process.cwd(), file), "utf8"),
    run: nodeIsolate(),
    places: (app.views?.places?.() ?? []).map((place) => ({ as: place.as, title: place.title, kind: place.kind })),
    ...(width ? { width: Number(width) } : {}),
  });
  if (argv.includes("--json")) {
    process.stdout.write(`${JSON.stringify(result.ok ? result.description : { reason: result.reason, detail: result.detail }, null, 2)}\n`);
    return result.ok ? 0 : 1;
  }
  if (!result.ok) {
    process.stdout.write(`${file} will not do (${result.reason}): ${result.detail}\n`);
    return 1;
  }
  process.stdout.write(`${result.description.text}\n`);
  return 0;
}
