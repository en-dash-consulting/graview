import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { entryArg, isDocument, loadApp } from "@graview/core/cli";
import type { AnySchema, GraviewApp, Store } from "@graview/core";
import { lastRunWords } from "@graview/core/scene";
import { declaredWorkflows, nextRunAt, workflowsOf } from "@graview/core/workflows";
import { openHost } from "./cli.js";
import type { WorkflowTools } from "./agent/workflow-tools.js";
import type { WorkflowLog, WorkflowRun } from "./workflows/types.js";

/*
 * `graview workflow` — WHAT THE APP DOES ON ITS OWN, FROM A SHELL (Roadmap
 * f-jobs-declared). Without a name it lists the app's workflows: each in a
 * sentence, active or paused, when it next runs on its clock and how its
 * last run went. With one it runs it once, by hand, as the app's own actor
 * — against a folder or a SQLite file, where the store is kept — and
 * prints the run. The runs are kept in a file beside the store, so the next
 * run reads on from the last and the first after a change is a dry run.
 * Nothing here decides anything: `runWorkflow` runs it, `workflowsOf` and
 * `nextRunAt` say it.
 */

export const WORKFLOW_USAGE = `  graview workflow <entry> [<name>] [--dry] [--now <iso>]
                           [--data <dir> | --sqlite <file>] [--json]
      Without a name, lists the app's workflows: each in a sentence, active
      or paused, when it next runs and how its last run went (--json for
      the same as JSON). With one, runs it once by hand as the app's own
      actor ("workflow:<name>", named by its title) against a folder
      (default ./data) or a SQLite file, and prints the run as JSON: what
      it made, changed, set aside and suggested, and what it held back and
      why. --dry keeps nothing and says what it would do; the first run
      after a workflow is added or changed is dry whatever is asked, and
      the next is real; a paused one only dry-runs. --now runs it as if at
      that moment. The runs are kept beside the store
      (workflow-runs.json). A served store runs its workflows on the server.
`;

function flag(argv: readonly string[], name: string): string | undefined {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
}

const say = (text: string) => process.stderr.write(text);

/** The flags that take a value: the word after one is not the workflow's name. */
const TAKES_A_VALUE = new Set(["--data", "--sqlite", "--now", "--document", "--seed", "--as", "--roles"]);

/**
 * THE RUNS, IN A FILE: every workflow's newest 200, oldest first, as JSON.
 * Read when opened and written whole after each run, for a command line;
 * a server keeps its own.
 */
export function fileWorkflowLog(path: string, limit = 200): WorkflowLog {
  let kept: Record<string, WorkflowRun[]> = {};
  try {
    const read = JSON.parse(readFileSync(path, "utf8")) as { runs?: Record<string, WorkflowRun[]> };
    kept = read.runs ?? {};
  } catch {
    kept = {};
  }
  return {
    last: (name) => kept[name]?.at(-1),
    add(run) {
      const runs = (kept[run.workflow] ??= []);
      runs.push(run);
      if (runs.length > limit) runs.splice(0, runs.length - limit);
      writeFileSync(path, `${JSON.stringify({ runs: kept }, null, 2)}\n`);
    },
    runs: (name, most) => [...(kept[name] ?? [])].reverse().slice(0, most ?? Infinity),
  };
}

/** Where a store's runs are kept: beside it, as its friction log is. */
const runsFileOf = (friction: string): string => friction.replace(/friction\.json$/, "workflow-runs.json");

/**
 * What `graview mcp --workflows` hands its seat: the runs kept beside the
 * store, and — for a document entry — a pause or a resume written into the
 * document, checked before it is kept. A TypeScript entry is changed in
 * its source, so it is offered no pause.
 */
export async function workflowToolsFor(app: GraviewApp, store: Store<AnySchema>, entry: string, friction: string): Promise<WorkflowTools> {
  const { seatWorkflows } = await import("./workflows/seat.js");
  const log = fileWorkflowLog(runsFileOf(friction));
  if (!isDocument(entry)) return seatWorkflows({ app, store, log });
  const { editDocument, sayFindings } = await import("@graview/core/document");
  const { compileDocument } = await import("@graview/core/check");
  return seatWorkflows({
    app,
    store,
    log,
    edit: async (edit) => {
      const path = resolve(entry);
      const edited = editDocument(JSON.parse(readFileSync(path, "utf8")), [edit]);
      if (!edited.ok) return { ok: false, error: sayFindings(edited.findings) };
      const checked = compileDocument(edited.document);
      if (!checked.ok) return { ok: false, error: `The app it would make does not check: ${sayFindings(checked.findings)}` };
      writeFileSync(path, `${JSON.stringify(edited.document, null, 2)}\n`);
      // The seat's app is the one it was opened with: what a run reads of the pause, it reads from here on.
      const all = declaredWorkflows(app) ?? {};
      const declared = all[edit.name];
      if (declared) (app as { workflows?: Record<string, unknown> }).workflows = { ...all, [edit.name]: { ...declared, status: edit.op === "pause-workflow" ? "paused" : "active" } };
      return { ok: true, said: edited.said.join(" ") || `${edit.op === "pause-workflow" ? "Paused" : "Resumed"} “${declared?.title ?? edit.name}”.` };
    },
  });
}

/** The app's workflows, listed: a line each, or JSON. */
function list(app: GraviewApp, log: WorkflowLog | undefined, now: Date, json: boolean): number {
  const zone = app.brand?.timeZone;
  const listed = workflowsOf(app).map((workflow) => {
    const next = nextRunAt(workflow, now, zone);
    const last = log?.last(workflow.name);
    return { name: workflow.name, title: workflow.title, words: workflow.words, status: workflow.status, ...(workflow.builtIn ? { builtIn: true } : {}), next: next?.toISOString() ?? null, last: lastRunWords(last, now) };
  });
  if (json) {
    process.stdout.write(`${JSON.stringify({ workflows: listed }, null, 2)}\n`);
    return 0;
  }
  if (listed.length === 0) {
    process.stdout.write(`${app.name} declares no workflows.\n`);
    return 0;
  }
  for (const one of listed) {
    const when = one.status === "paused" ? "paused" : one.next ? `next ${one.next}` : "runs on a change or by hand";
    process.stdout.write(`${one.name}${one.builtIn ? " (built in)" : ""} — ${one.words}\n    ${when} · ${one.last}\n`);
  }
  return 0;
}

/** `graview workflow`: list the app's workflows, or run one once. */
export async function workflow(argv: readonly string[]): Promise<number> {
  const entry = entryArg(argv, 0);
  if (!entry) {
    say(`graview workflow: an entry module or a declaration document is required\n\n${WORKFLOW_USAGE}`);
    return 2;
  }
  if (flag(argv, "--remote-url") !== undefined) {
    say("graview workflow: run it where the store is kept — a served store runs its workflows on the server.\n");
    return 2;
  }
  const app = await loadApp(entry);
  // The name is the word after the entry (or the first, when the entry was given as --document); a flag's value is not a word.
  const positionals = argv.filter((arg, at) => !arg.startsWith("--") && !(at > 0 && TAKES_A_VALUE.has(argv[at - 1]!)));
  const name = flag(argv, "--document") !== undefined ? positionals[0] : positionals[1];
  const asked = flag(argv, "--now");
  const now = asked !== undefined ? new Date(asked) : new Date();
  if (Number.isNaN(now.getTime())) {
    say(`graview workflow: --now takes a moment like 2026-11-01T18:00:00Z, not "${asked}".\n`);
    return 2;
  }
  const workflows = declaredWorkflows(app) ?? {};
  const declared = Object.keys(workflows);
  if (name === "dreaming" && !declared.includes(name)) {
    say("graview workflow: dreaming is the app's built-in nightly workflow; run it with graview dream.\n");
    return 2;
  }
  if (name !== undefined && !declared.includes(name)) {
    say(`graview workflow: ${app.name} has no workflow "${name}"; ${declared.length > 0 ? `it has ${declared.map((one) => `"${one}"`).join(", ")}` : "it declares none"}.\n`);
    return 2;
  }
  if (name === undefined && !argv.includes("--data") && !argv.includes("--sqlite")) {
    // A listing opens no store unless one is named: the last runs are said where they are kept.
    return list(app, undefined, now, argv.includes("--json"));
  }
  const { workflowAuthor, resolveWorkflow, workflowWorldOfApp } = await import("@graview/core/workflows");
  const author = name !== undefined ? workflowAuthor(resolveWorkflow(name, workflows[name]!, workflowWorldOfApp(app))) : { kind: "system" as const, id: "workflow", automated: true as const };
  const host = await openHost(app, argv, author, "cli");
  try {
    const log = host.files ? fileWorkflowLog(runsFileOf(host.files.friction)) : undefined;
    if (name === undefined) return list(app, log, now, argv.includes("--json"));
    const { runWorkflow } = await import("./workflows/run.js");
    const run = await runWorkflow({
      app,
      store: host.store,
      workflow: name,
      now,
      trigger: { kind: "byHand", who: "cli" },
      log: log ?? (await import("./workflows/log.js")).memoryWorkflowLog(),
      ...(argv.includes("--dry") ? { dryRun: true } : {}),
      principal: author,
      via: "cli",
    });
    await host.settled();
    say(`graview workflow: ${app.name} on ${host.where} — “${run.workflow}” ${run.outcome}${run.dry ? " (a dry run: nothing was kept)" : ""}. ${lastRunWords(run, run.finished)}.\n`);
    process.stdout.write(`${JSON.stringify(run, null, 2)}\n`);
    return run.outcome === "failed" ? 1 : 0;
  } finally {
    await host.close();
  }
}
