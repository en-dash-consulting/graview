#!/usr/bin/env node
/**
 * THE TODOIST CONNECTION, AGAINST TODOIST ITSELF.
 *
 * `@graview/core/sync` is covered against a scripted Todoist; this runs a
 * declared connection (`connections.<name>` with `system: "todoist"`) against
 * a real account and writes what happened to docs/todoist.json as named
 * claims: a first run that sends nothing, a task made there with each part, a
 * record made here becoming a task, our own write not echoed, an edit each
 * way, a conflict held, a task completed there and here, one a whole read no
 * longer lists kept as completed, a repeat both ways and one that cannot be
 * said held unsent, a subtask linked, a removal each way, a refused token
 * said, and the token kept nowhere.
 *
 * WHAT TO SET UP, ONCE: a Todoist account of its own for testing, its
 * personal API token (Settings → Integrations → Developer), and
 * ~/.graview-todoist-test.env (or the file GRAVIEW_TODOIST_ENV names), chmod
 * 600, holding
 *   TODOIST_TOKEN=<the token>
 *
 * The harness makes its own project each run — "Graview harness <run id>",
 * with one section — and deletes it at the end; nothing else in the account
 * is touched. Its whole reads count toward the account's limit of 100 in a
 * quarter of an hour.
 *
 * It needs credentials, so it is NOT in `pnpm verify` or CI, and no value in
 * the file is ever printed. `--stub` runs every claim against the scripted
 * Todoist instead (no credentials, nothing reached) and writes
 * docs/todoist-stub.json, so the claims are proven wired before an account
 * is. Needs `pnpm build`.
 *
 *   node scripts/verify-todoist.mjs            against Todoist
 *   node scripts/verify-todoist.mjs --stub     against the scripted Todoist
 */
import { randomBytes, randomUUID } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { Store } from "../packages/core/dist/index.js";
import { compileDocument } from "../packages/core/dist/check.js";
import { TODOIST_API, connection, scriptedTodoist } from "../packages/core/dist/sync/index.js";

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const stubbed = process.argv.includes("--stub");
const run = `gv-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
const report = { at: new Date().toISOString(), run, mode: stubbed ? "stub" : "live", checks: {} };
const claim = (name, ok, said = {}) => {
  report.checks[name] = { ...said, ok: Boolean(ok) };
  process.stdout.write(`${ok ? "ok  " : "FAIL"}  ${name}\n`);
};
const sleep = (ms) => new Promise((done) => setTimeout(done, ms));

/** The token, from the file outside the checkout; a sentence names the key that is missing, never a value. */
function tokenFromFile() {
  const file = process.env.GRAVIEW_TODOIST_ENV ?? join(homedir(), ".graview-todoist-test.env");
  if (!existsSync(file)) throw new Error("No Todoist test credentials: put TODOIST_TOKEN in ~/.graview-todoist-test.env, or the file GRAVIEW_TODOIST_ENV names.");
  const token = /^\s*TODOIST_TOKEN\s*=\s*["']?([^"'\s]+)/m.exec(readFileSync(file, "utf8"))?.[1];
  if (!token) throw new Error("The Todoist test credentials have no TODOIST_TOKEN.");
  return token;
}

const stub = stubbed ? scriptedTodoist({ timeZone: "Europe/Madrid" }) : undefined;
const secret = stub ? stub.token : tokenFromFile();
const fetched = stub ? stub.fetch : (url, init) => fetch(url, init);

/** Todoist's sync endpoint, as another person working in the account. Refusals throw, with Todoist's own words and never the token. */
async function sync(form) {
  for (;;) {
    const response = await fetched(`${TODOIST_API}/sync`, { method: "POST", headers: { authorization: `Bearer ${secret}`, "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams(form).toString() });
    const answer = await response.json();
    if (response.status === 429) {
      await sleep(Number(response.headers?.get("retry-after") ?? 1) * 1000);
      continue;
    }
    if (!response.ok) throw new Error(`Todoist answered ${response.status}: ${answer.error ?? ""}`);
    return answer;
  }
}
/** One command; the id it made, when it made something. */
async function command(type, args) {
  const uuid = randomUUID();
  const temp = randomUUID();
  const answer = await sync({ commands: JSON.stringify([{ type, uuid, ...(type.endsWith("_add") ? { temp_id: temp } : {}), args }]) });
  if (answer.sync_status?.[uuid] !== "ok") throw new Error(`Todoist refused ${type}: ${JSON.stringify(answer.sync_status?.[uuid])}`);
  return answer.temp_id_mapping?.[temp];
}

let projectId;
try {
  projectId = stub ? stub.project(`Graview harness ${run}`) : await command("project_add", { name: `Graview harness ${run}` });
  const sectionId = stub ? stub.section(projectId, "Shed") : await command("section_add", { name: "Shed", project_id: projectId });
  /** Every task of the run's project as Todoist's reads have said it, completed and deleted ones too, merged since the start. */
  const seen = new Map();
  let since = "*";
  const look = async () => {
    const answer = await sync({ sync_token: since, resource_types: '["items"]' });
    since = answer.sync_token;
    for (const item of answer.items ?? []) if (item.project_id === projectId || seen.has(item.id)) seen.set(item.id, item);
    return [...seen.values()];
  };
  const named = async (content) => (await look()).find((item) => item.content === `${content} ${run}` && !item.is_deleted);

  const compiled = compileDocument({
    format: "graview-document",
    formatVersion: 1,
    name: `Todoist harness ${run}`,
    kinds: {
      task: {
        fields: {
          name: { type: "string", required: true },
          notes: { type: "text" },
          due: { type: "date", repeats: true },
          deadline: { type: "date" },
          priority: { type: "integer" },
          labels: { type: "list", of: "string" },
          section: { type: "string" },
          done: { type: "boolean" },
        },
        edges: { parent: { to: ["task"], cardinality: "one" } },
      },
    },
    acts: { "add-task": { creates: "task" } },
    connections: {
      harness: {
        system: "todoist",
        project: projectId,
        kind: "task",
        // A deadline is a paid plan's: the run says it only where the account takes one (GRAVIEW_TODOIST_DEADLINES=1).
        fields: { content: "name", description: "notes", due: "due", priority: "priority", labels: "labels", section: "section", parent: "parent", completed: "done", ...(stubbed || process.env.GRAVIEW_TODOIST_DEADLINES ? { deadline: "deadline" } : {}) },
        direction: "both",
      },
    },
  });
  if (!compiled.ok) throw new Error(`the harness's own declaration does not check: ${compiled.findings.map((finding) => finding.message).join("; ")}`);
  const app = compiled.app;
  const store = new Store({ schema: app.schema, mutations: app.mutations ?? [], snapshot: { nodes: [], edges: [] } });
  const said = [];
  let given = secret;
  const open = (state) => connection({ name: "harness", declaration: app.connections.harness, app, store, projectId, token: () => given, secretName: "TODOIST_TOKEN", fetch: fetched, say: (line) => said.push(line), ...(state ? { state } : {}) });
  let engine = open().engine;
  const act = (name, args) => store.apply({ name, args }, { author: { kind: "human", id: "harness" }, intent: "by hand" });
  const record = (name) => store.graph.allNodes().find((node) => node.kind === "task" && node.name === `${name} ${run}`);
  /** Passes until `check` holds or the tries run out: a read may lag a write by a moment. */
  const until = async (check) => {
    let last;
    for (let at = 0; at < (stubbed ? 1 : 6); at++) {
      if (at > 0) await sleep(2000);
      last = await engine.run();
      if (check(last)) break;
    }
    return last;
  };

  const first = await engine.run();
  claim("theFirstRunReadsTheProjectAndSendsNothing", !first.offline && first.applied.length === 0 && first.pushed.length === 0, { problem: first.problem ?? null });

  const paint = await command("item_add", { content: `Paint ${run}`, description: "Two coats", project_id: projectId, section_id: sectionId, priority: 4, labels: ["graview-harness"], due: { date: "2031-03-03" } });
  const took = await until(() => record("Paint"));
  const painted = record("Paint") ?? {};
  claim("aTaskMadeInTodoistArrivesWithItsParts", painted.notes === "Two coats" && painted.section === "Shed" && painted.priority === 1 && painted.due === "2031-03-03" && painted.labels?.join() === "graview-harness" && painted.done === false, { refused: took.refused });
  claim("takingItSendsNothingBack", took.pushed.length === 0 && (await engine.run()).pushed.length === 0);

  act("add-task", { id: "task:gate", name: `Gate ${run}`, notes: "Oil it", due: "2031-03-04", priority: 2, section: "Shed" });
  const sent = await engine.run();
  const gate = await named("Gate");
  claim("aRecordMadeHereBecomesATask", sent.refused.length === 0 && gate?.description === "Oil it" && gate?.due?.date === "2031-03-04" && gate?.priority === 3 && gate?.section_id === sectionId, { refused: sent.refused });
  const echo = await until((one) => one.echoes.includes("task:gate"));
  claim("ourOwnWriteIsNotTakenBackAsNews", echo.echoes.includes("task:gate") && echo.applied.length === 0 && echo.pushed.length === 0, { applied: echo.applied, pushed: echo.pushed });

  act("edit-task", { id: "task:gate", notes: "Oil both hinges" });
  await engine.run();
  claim("anEditHereIsAnEditThere", (await named("Gate"))?.description === "Oil both hinges");
  await command("item_update", { id: paint, description: "Three coats" });
  await until(() => record("Paint").notes === "Three coats");
  claim("anEditThereIsAnEditHere", record("Paint").notes === "Three coats");

  await until((one) => one.echoes.length + one.applied.length === 0);
  await command("item_update", { id: gate.id, description: "Theirs" });
  act("edit-task", { id: "task:gate", notes: "Ours" });
  const conflicted = await until((one) => one.conflicts.length > 0);
  claim("aFieldBothChangedIsHeld", conflicted.conflicts.some((one) => one.field === "notes" && one.ours === "Ours" && one.theirs === "Theirs") && record("Gate").notes === "Ours" && (await named("Gate"))?.description === "Theirs");
  for (const conflict of conflicted.conflicts) engine.resolve(conflict, "theirs");

  await command("item_close", { id: paint });
  const closed = await until(() => record("Paint")?.done === true);
  claim("aTaskCompletedThereSetsTheFieldAndRemovesNothing", record("Paint")?.done === true && closed.gone.length === 0);
  await command("item_uncomplete", { id: paint });
  await until(() => record("Paint")?.done === false);
  claim("aTaskReopenedThereClearsIt", record("Paint")?.done === false);

  act("edit-task", { id: "task:gate", done: true });
  const completed = await engine.run();
  await look();
  claim("aRecordCompletedHereIsCompletedThere", completed.refused.length === 0 && seen.get(gate.id)?.checked === true, { refused: completed.refused });
  await until((one) => one.pushed.length === 0);

  // Completed there between passes, with the cursor lost: a whole read of active tasks does not list it.
  await command("item_close", { id: paint });
  const { cursor: _cursor, ...kept } = engine.snapshot;
  engine = open(kept).engine;
  const whole = await until(() => record("Paint")?.done === true);
  claim("aCompletedTaskAWholeReadDoesNotListIsKeptAsCompleted", record("Paint")?.done === true && whole.gone.length === 0 && record("Gate"), { said: [...said] });

  act("add-task", { id: "task:bins", name: `Bins ${run}`, due: "2031-03-05" });
  act("edit-task", { id: "task:bins", dueRepeat: { every: "week", interval: 2 } });
  const repeated = await engine.run();
  const bins = await named("Bins");
  claim("aRepeatHereIsARepeatThere", repeated.refused.length === 0 && bins?.due?.is_recurring === true && bins?.due?.date === "2031-03-05" && bins?.due?.string === "every 2 weeks", { refused: repeated.refused, due: bins?.due ?? null });
  const steady = await until((one) => one.pushed.length === 0);
  claim("aRepeatSentIsNotSentAgain", steady.pushed.length === 0 && record("Bins").due === "2031-03-05" && record("Bins").dueRepeat?.interval === 2, { due: record("Bins").due });
  act("edit-task", { id: "task:bins", done: true });
  await engine.run();
  await until(() => record("Bins").done === false);
  claim("completingOneThatRepeatsMovesItToItsNextDate", record("Bins").done === false && record("Bins").due === "2031-03-19", { due: record("Bins").due });

  const filter = await command("item_add", { content: `Filter ${run}`, project_id: projectId, due: { date: "2031-03-06", string: "every! 3 months", lang: "en", is_recurring: true } });
  await until(() => record("Filter"));
  const was = (await named("Filter"))?.due;
  act("edit-task", { id: record("Filter").id, due: "2031-04-06" });
  const held = await engine.run();
  await look();
  claim("aRepeatThatCannotBeSaidIsHeldUnsent", held.refused.some((one) => /held unsent/.test(one.error)) && seen.get(filter)?.due?.date === was?.date && seen.get(filter)?.due?.string === was?.string, { refused: held.refused, due: seen.get(filter)?.due ?? null });
  act("edit-task", { id: record("Filter").id, due: was.date });

  const child = await command("item_add", { content: `Brush ${run}`, project_id: projectId, parent_id: bins.id });
  await until(() => record("Brush") && store.graph.out(record("Brush").id, "parent").length > 0);
  claim("aSubtaskIsLinkedToItsParent", store.graph.out(record("Brush")?.id ?? "", "parent").map((one) => one.id).join() === "task:bins");

  await command("item_delete", { id: child });
  await until(() => !record("Brush"));
  claim("aTaskDeletedThereIsRemovedHere", !record("Brush"));
  act("remove-task", { id: record("Filter").id });
  const removed = await engine.run();
  await look();
  claim("aRecordRemovedHereIsDeletedThere", removed.refused.length === 0 && seen.get(filter)?.is_deleted === true);

  given = "0".repeat(40);
  const refused = await engine.run();
  given = secret;
  claim("aRefusedTokenIsSaidByItsName", refused.offline && /TODOIST_TOKEN/.test(refused.problem ?? ""), { problem: refused.problem ?? null });
  claim("theTokenIsKeptNowhere", !JSON.stringify([app.connections, store.log.all(), store.graph.allNodes(), engine.snapshot, said]).includes(secret));
  report.passed = Object.values(report.checks).every((check) => check.ok);
} catch (error) {
  report.error = (error instanceof Error ? error.message : String(error)).replaceAll(secret, "<token>");
  report.passed = false;
} finally {
  if (projectId && !stubbed) {
    try {
      await command("project_delete", { id: projectId });
    } catch (error) {
      report.cleanup = (error instanceof Error ? error.message : String(error)).replaceAll(secret, "<token>");
    }
  }
}

const out = stubbed ? "docs/todoist-stub.json" : "docs/todoist.json";
writeFileSync(resolve(repoRoot, out), `${JSON.stringify(report, null, 2)}\n`);
process.stdout.write(`\n${report.passed ? "passed" : `failed${report.error ? `: ${report.error}` : ""}`} (run ${run}, ${report.mode}); wrote ${out}\n`);
process.exit(report.passed ? 0 : 1);
