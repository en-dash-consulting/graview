import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { entryArg, loadApp } from "@graview/core/cli";
import { instantiateTemplate } from "@graview/core/check";
import { sayFindings, templateSeedPrimitives } from "@graview/core/document";
import { Store, type AnySchema, type GraviewApp, type MutationCall, type Operation, type Principal } from "@graview/core";
import { backendFrom, openRemote, openStore, type RemoteStore } from "@graview/ship";
import { createMcpAdapter } from "./agent/adapters.js";
import { createToolRuntime } from "./agent/tools.js";
import { serveMcpStdio } from "./mcp-stdio.js";
import { applyPlan, planFrom, type PlannedCall } from "./plan.js";

/**
 * THE AGENT HOST. An external agent — an editor's assistant, a worker on a
 * schedule — evolves a live graph the way a person does: through the same
 * store, under its own seat, judged by the same policy. It edited the seed
 * before this because the seed was the only thing it could reach; the live
 * truth was a browser's localStorage and the tool runtime lived inside the
 * page. These two commands put the runtime where the data is.
 *
 * Nothing here decides anything. `createToolRuntime` is the tool surface,
 * `store.apply` is the write path, `openStore` and `openRemote` are the
 * stores — this parses flags and moves bytes.
 */

export const MCP_USAGE = `  graview mcp <entry> [--data <dir> | --sqlite <file> | --remote-url <url>]
                      [--seed <file>] [--as <seat>] [--roles a,b] [--header "k: v"]
                      [--read-only] [--list]
      Speaks MCP over stdio for the app's store, so an agent with only a
      shell attaches to the same tools the in-app seat has: the reads, the
      previews, undo, and every act the seat's principal may run. Against a
      folder (default ./data), a SQLite file, or a running graview serve.
      --list prints the seat's tools as tools/list JSON and exits — the
      catalog a host registers without hand-writing a schema.

  graview apply <entry> (--call <name> --args '<json>' | --plan <file> | --undo <batch>)
                        [--preview] [--intent "..."] [--as <seat>] [--roles a,b]
                        [--data <dir> | --sqlite <file> | --remote-url <url>] [--header "k: v"]
      One act, a plan of many as one batch, or a take-back — through
      store.apply under the seat, so the policy refuses here what it refuses
      in the browser, with its own sentence and exit code 1. A plan is a JSON
      array of { mutation, args, as? }; a later call names an earlier one's
      node as { "$plan": "<as>" }. --preview says what would happen and
      writes nothing.

  graview apply [<entry>] --template <file|url> [--answers '<json>'] [--examples]
                [--preview] [--as <id>] [--roles a,b] [--data <dir> | ...]
      Sets a store up from a template (Graview Cloud's graview-template
      shape): its questions answered from --answers or their defaults, its
      setup acts run as ONE batch authored by the template (a system seat,
      "template:<id>", unless --as/--roles say otherwise), so one --undo takes
      it back. --examples brings its example content too, as a batch of its
      own. Without <entry>, the template's own document is the app.
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

function flags(argv: readonly string[], name: string): string[] {
  const out: string[] = [];
  argv.forEach((arg, at) => {
    if (arg === name && argv[at + 1] !== undefined) out.push(argv[at + 1]!);
  });
  return out;
}

/** Who the command acts as: an agent, named, with the roles it was given. */
export function seatFrom(argv: readonly string[], fallback: string): Principal {
  const roles = (flag(argv, "--roles") ?? "").split(",").map((role) => role.trim()).filter(Boolean);
  return { kind: "agent", id: flag(argv, "--as") ?? fallback, ...(roles.length > 0 ? { roles } : {}) };
}

function headersFrom(argv: readonly string[]): Record<string, string> {
  const headers: Record<string, string> = {};
  for (const given of flags(argv, "--header")) {
    const colon = given.indexOf(":");
    if (colon === -1) throw new Error(`--header wants "name: value", got ${JSON.stringify(given)}`);
    headers[given.slice(0, colon).trim().toLowerCase()] = given.slice(colon + 1).trim();
  }
  return headers;
}

/**
 * The store, wherever it is. The two shapes agree on what a command needs:
 * the store to act on, a way to wait for the verdict, and a word for where.
 */
export interface Host<S extends AnySchema> {
  readonly store: Store<S>;
  readonly where: string;
  /** Resolves once every change so far is decided — persisted here, or answered by the server. */
  settled(): Promise<void>;
  /** Brings a remote graph up to date before a read; nothing to do locally. */
  refresh(): Promise<void>;
  /** The server's refusals since the last look, in the policy's words. */
  refusals(): string[];
  close(): Promise<void>;
}

export async function openHost<S extends AnySchema>(
  app: GraviewApp<S>,
  argv: readonly string[],
  principal: Principal,
  /** What its changes come through, recorded on every op the server makes (FR-06). */
  via: string = "mcp",
): Promise<Host<S>> {
  const url = flag(argv, "--remote-url");
  if (url) {
    const remote: RemoteStore<S> = await openRemote({ app, url, principal, headers: headersFrom(argv), pollMs: 0, via });
    let heard: string[] = [];
    remote.onRefusal((reason) => heard.push(reason));
    return {
      store: remote.store,
      where: url,
      settled: () => remote.settled(),
      refresh: async () => {
        await remote.pull();
      },
      refusals: () => {
        const out = heard;
        heard = [];
        return out;
      },
      close: async () => {
        await remote.settled();
        remote.close();
      },
    };
  }
  const backend = await backendFrom(argv);
  const opened = await openStore({ app, adapter: backend.adapter, scope: app.name, ...(backend.seed ? { seed: backend.seed } : {}) });
  return {
    store: opened.store,
    where: backend.where,
    settled: () => opened.flush(),
    refresh: async () => {},
    refusals: () => [],
    close: async () => {
      await opened.flush();
      opened.close();
    },
  };
}

/** The entry module, or the exit code for not having one. */
async function entryOf(argv: readonly string[], command: string): Promise<GraviewApp | number> {
  const entry = entryArg(argv, 0);
  if (!entry) {
    process.stderr.write(`graview ${command}: an entry module is required\n\n${MCP_USAGE}`);
    return 2;
  }
  return loadApp(entry);
}

const say = (text: string) => process.stderr.write(text);

/** How to work here, told to the model on connecting — derived, not authored per app. */
export function instructionsFor(app: Pick<GraviewApp, "name">, principal: Principal, where: string): string {
  return (
    `${app.name} is a Graview app; its graph is the interface and this seat (${principal.id ?? "an agent"}` +
    `${principal.roles?.length ? `, roles ${principal.roles.join(", ")}` : ""}) acts on the store at ${where}. ` +
    `Find a thing by name with search_graph before reaching for get_graph; read with get_node and get_violations; ask get_affordances what is legal on a selection; ` +
    `change the graph only through the named mutation tools, which are every write there is. preview_mutation first when unsure; ` +
    `undo_batch takes a batch back. An act that creates a kind takes an optional id for the node it makes; remove-<kind> takes one out. ` +
    `Every change is judged under this seat's principal, logged with your name, and shown to everyone else within a second.`
  );
}

export async function mcp(argv: readonly string[]): Promise<number> {
  const app = await entryOf(argv, "mcp");
  if (typeof app === "number") return app;
  const principal = seatFrom(argv, "graview-mcp");
  const readOnly = argv.includes("--read-only");

  if (argv.includes("--list")) {
    /*
     * THE CATALOG, from the declaration alone: which tools this seat gets
     * depends on the policy and the principal, never on the data, so
     * nothing is opened and nothing is written to a folder that may not
     * exist yet.
     */
    const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), ...(app.intelligence ? { intelligence: app.intelligence } : {}) });
    const adapter = createMcpAdapter(createToolRuntime(store, { author: principal, readOnly, app, places: () => app.views?.places?.() ?? [] }));
    process.stdout.write(`${JSON.stringify({ tools: adapter.listTools() }, null, 2)}\n`);
    return 0;
  }

  const host = await openHost(app, argv, principal, "mcp");
  const runtime = createToolRuntime(host.store, { author: principal, readOnly, app, places: () => app.views?.places?.() ?? [] });
  const inner = createMcpAdapter(runtime);
  say(`graview mcp: ${app.name} as ${principal.id} on ${host.where} — ${inner.listTools().length} tools\n`);

  /*
   * THE VERDICT BEFORE THE ANSWER. The runtime answers as soon as the local
   * store has moved; against a remote the server has not spoken yet, and
   * against a folder the write has not landed. A reply that said "done" and
   * was then refused would be the one lie an agent cannot recover from, so
   * each call waits for settlement and reports a refusal as the error it is.
   */
  const adapter = {
    listTools: () => inner.listTools(),
    async callTool(name: string, args: Record<string, unknown> = {}) {
      const mutating = runtime.definitions.find((tool) => tool.name === name)?.mutating ?? false;
      if (!mutating) await host.refresh();
      const result = await inner.callTool(name, args);
      await host.settled();
      const refused = host.refusals();
      if (refused.length > 0) return { content: [{ type: "text" as const, text: refused.join("\n") }], isError: true };
      return result;
    },
  };

  await serveMcpStdio({
    adapter,
    name: app.name,
    version: String(app.version ?? 1),
    instructions: instructionsFor(app, principal, host.where),
    input: process.stdin,
    output: process.stdout,
    onRequest: (method, ok) => say(`graview mcp: ${method} ${ok ? "ok" : "failed"}\n`),
  });
  await host.close();
  return 0;
}

/** What the log now says about a change, small enough to read and complete enough to act on. */
function report(ops: readonly Operation[], extra: Record<string, unknown> = {}): string {
  const touched = (op: Operation) => op.primitives.map((primitive) => {
    switch (primitive.op) {
      case "add-node": return `+ ${primitive.node.kind} ${primitive.node.id}`;
      case "remove-node": return `- ${primitive.node.kind} ${primitive.node.id}`;
      case "patch-node": return `~ ${primitive.id}: ${Object.keys(primitive.after).join(", ")}`;
      case "add-edge": return `+ ${primitive.edge.from} ${primitive.edge.kind} ${primitive.edge.to}`;
      case "remove-edge": return `- ${primitive.edge.from} ${primitive.edge.kind} ${primitive.edge.to}`;
    }
  });
  return `${JSON.stringify({ ok: true, batch: ops[0]?.batch ?? null, ops: ops.map((op) => ({ id: op.id, intent: op.intent, changes: touched(op) })), ...extra }, null, 2)}\n`;
}

function readPlan(file: string): PlannedCall[] {
  const parsed = JSON.parse(readFileSync(resolve(process.cwd(), file), "utf8")) as unknown;
  const calls = Array.isArray(parsed) ? parsed : (parsed as { calls?: unknown }).calls;
  if (!Array.isArray(calls)) throw new Error(`${file} is not a plan: expected an array of { mutation, args }, or { calls: [...] }.`);
  return calls.map((call, at) => {
    const given = call as { mutation?: string; name?: string; args?: Record<string, unknown>; as?: string; why?: string };
    const mutation = given.mutation ?? given.name;
    if (typeof mutation !== "string") throw new Error(`${file}: call ${at} names no mutation.`);
    return { mutation, args: given.args ?? {}, ...(given.as ? { as: given.as } : {}), ...(given.why ? { why: given.why } : {}) };
  });
}

/** JSON from a file or a URL. */
async function readJson(where: string): Promise<unknown> {
  if (/^https?:\/\//.test(where)) {
    const response = await fetch(where);
    if (!response.ok) throw new Error(`${where} answered ${response.status}`);
    return (await response.json()) as unknown;
  }
  return JSON.parse(readFileSync(resolve(process.cwd(), where), "utf8")) as unknown;
}

/**
 * A TEMPLATE, SET UP IN A LIVE STORE (FR-08) — the same instantiation
 * Graview Cloud runs, here against a folder, a SQLite file or a served
 * store. Every finding is said before anything is written; the setup acts
 * then go through `planFrom` and `applyPlan` exactly as `--plan` does, so
 * they are judged under the seat first and land as ONE batch, authored by
 * the template, with the template's own sentence as its intent — one entry
 * in the activity, one `--undo` to take it back. The example content is a
 * batch of its own, so the examples can go without the setup.
 */
async function applyTemplate(argv: readonly string[], where: string): Promise<number> {
  let answers: Record<string, unknown> = {};
  const given = flag(argv, "--answers");
  if (given !== undefined) {
    try {
      const parsed = JSON.parse(given) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) throw new Error("expected an object of answers by question id");
      answers = parsed as Record<string, unknown>;
    } catch (error) {
      say(`graview apply: --answers is not a JSON object of answers by question id: ${error instanceof Error ? error.message : String(error)}\n`);
      return 2;
    }
  }
  const made = instantiateTemplate(await readJson(where), answers);
  if (!made.ok) {
    say(`graview apply: ${where} cannot be set up:\n${sayFindings(made.findings)}\n`);
    return 1;
  }
  const { template } = made;
  const entry = entryArg(argv, 0);
  const app = entry ? await loadApp(entry) : (made.compiled.app as GraviewApp);
  /* The template is who set this up, as Cloud records it — unless the command says who. */
  const principal: Principal =
    flag(argv, "--as") !== undefined || flag(argv, "--roles") !== undefined ? seatFrom(argv, `template:${template.id}`) : { kind: "system", id: `template:${template.id}` };
  const preview = argv.includes("--preview");
  const stamp = Date.now().toString(36);
  const host = await openHost(app, argv, principal, "cli");
  try {
    await host.refresh();
    const store = host.store;
    const target = preview
      ? new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: store.graph.snapshot() })
      : store;
    const plan = planFrom(target, made.setup.map((call) => ({ mutation: call.name, args: call.args, why: call.intent })), { principal, app });
    if (plan.refused.length > 0) {
      say(`graview apply: ${plan.refused.length} of ${plan.entries.length} setup acts cannot run:\n${plan.refused.map((entry) => `  ${entry.call.mutation}: ${entry.refusal!.message}\n`).join("")}`);
      return 1;
    }
    const before = target.log.all().length;
    const applied = applyPlan(target, plan, { author: principal, batch: `template:${template.id}:${stamp}` });
    if (applied.stoppedAt) {
      say(`graview apply: setup stopped at act ${applied.stoppedAt.at}: ${applied.stoppedAt.why}${applied.undone ? " — what had run was taken back." : ""}\n`);
      return 1;
    }
    let examples: string | undefined;
    if (argv.includes("--examples") && made.seed) {
      examples = `examples:${template.id}:${stamp}`;
      try {
        target.applyPrimitives(templateSeedPrimitives(made.seed, made.document), { author: principal, batch: examples, intent: `Example content from ${template.title}` });
      } catch (error) {
        say(`graview apply: the example content could not be added: ${error instanceof Error ? error.message : String(error)}. The setup landed as ${applied.batch}.\n`);
        if (!preview) await host.settled();
        return 1;
      }
    }
    const extra = { made: applied.made, ...(examples ? { examples } : {}) };
    if (preview) {
      process.stdout.write(report(target.log.all().slice(before), { preview: true, ...extra, violations: target.violations().length }));
      return 0;
    }
    return finish(host, before, extra);
  } finally {
    await host.close();
  }
}

export async function apply(argv: readonly string[]): Promise<number> {
  const templateWhere = flag(argv, "--template");
  if (templateWhere !== undefined) {
    if (["--call", "--plan", "--undo"].some((other) => argv.includes(other))) {
      say(`graview apply: --template sets a store up on its own; say --call, --plan or --undo in a separate command\n\n${MCP_USAGE}`);
      return 2;
    }
    return applyTemplate(argv, templateWhere);
  }
  const app = await entryOf(argv, "apply");
  if (typeof app === "number") return app;
  const principal = seatFrom(argv, "graview-apply");
  const callName = flag(argv, "--call");
  const planFile = flag(argv, "--plan");
  const undoBatch = flag(argv, "--undo");
  if ([callName, planFile, undoBatch].filter(Boolean).length !== 1) {
    say(`graview apply: say exactly one of --call, --plan or --undo\n\n${MCP_USAGE}`);
    return 2;
  }
  const intent = flag(argv, "--intent");
  const preview = argv.includes("--preview");
  const host = await openHost(app, argv, principal, "cli");
  try {
    await host.refresh();
    const store = host.store;

    if (undoBatch) {
      const check = store.canUndo(undoBatch);
      if (!check.ok) {
        say(`graview apply: ${check.message}\n`);
        return 1;
      }
      if (preview) {
        const would = store.previewUndo(undoBatch);
        process.stdout.write(`${JSON.stringify({ ok: would.ok, preview: true, ...(would.ok ? { intent: would.intent, introduces: would.introduces } : {}) }, null, 2)}\n`);
        return 0;
      }
      const since = store.log.all().length;
      store.undo(undoBatch, { author: principal, ...(intent ? { intent } : {}) });
      return finish(host, since);
    }

    if (callName) {
      const args = JSON.parse(flag(argv, "--args") ?? "{}") as Record<string, unknown>;
      const call: MutationCall = { name: callName, args };
      const verdict = store.permits(call, principal);
      if (!verdict.ok) {
        say(`graview apply: ${verdict.refusal.message}\n`);
        return 1;
      }
      if (preview) {
        const would = store.preview(call);
        process.stdout.write(
          `${JSON.stringify({ ok: true, preview: true, intent: would.intent, primitives: would.primitives, introduces: would.introduces, resolves: would.resolves }, null, 2)}\n`,
        );
        return 0;
      }
      const since = store.log.all().length;
      const result = store.apply(call, { author: principal, ...(intent ? { intent } : {}) });
      return finish(host, since, { introduces: result.introduces, resolves: result.resolves });
    }

    const calls = readPlan(planFile!);
    /*
     * A PLAN IS JUDGED BEFORE IT RUNS, on the seat's own refusals — and a
     * preview runs it on a copy, because a plan's later calls need the ids
     * its earlier ones make and no single preview can say those.
     */
    const target = preview
      ? new Store({ schema: app.schema, mutations: app.mutations ?? [], invariants: app.invariants ?? [], ...(app.policy ? { policy: app.policy } : {}), snapshot: store.graph.snapshot() })
      : store;
    const plan = planFrom(target, calls, { principal, app });
    if (plan.refused.length > 0) {
      say(`graview apply: ${plan.refused.length} of ${plan.entries.length} calls cannot run:\n${plan.refused.map((entry) => `  ${entry.call.mutation}: ${entry.refusal!.message}\n`).join("")}`);
      return 1;
    }
    const before = target.log.all().length;
    const applied = applyPlan(target, plan, { author: principal });
    if (applied.stoppedAt) {
      say(`graview apply: stopped at call ${applied.stoppedAt.at}: ${applied.stoppedAt.why}${applied.undone ? " — what had run was taken back." : ""}\n`);
      return 1;
    }
    const ops = target.log.all().slice(before);
    if (preview) {
      process.stdout.write(report(ops, { preview: true, made: applied.made, violations: target.violations().length }));
      return 0;
    }
    return finish(host, before, { made: applied.made });
  } finally {
    await host.close();
  }
}

/**
 * Said once the verdict is in: the server's refusal, or what landed. What
 * landed is read from the log AFTER settling, minus the provisional ops a
 * remote store minted on the way — so the ids and batch printed are the
 * ones every other client has, and the ones an `--undo` must name.
 */
async function finish<S extends AnySchema>(host: Host<S>, since: number, extra: Record<string, unknown> = {}): Promise<number> {
  await host.settled();
  const refused = host.refusals();
  if (refused.length > 0) {
    say(`graview apply: ${refused.join("\n")}\n`);
    return 1;
  }
  const landed = host.store.log.all().slice(since);
  const theirs = landed.filter((op) => !op.id.startsWith("local-"));
  process.stdout.write(report(theirs.length > 0 ? theirs : landed, extra));
  return 0;
}
