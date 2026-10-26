import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type { AnySchema, GraviewApp, Principal, Store } from "@graview/core";
import { entryArg, isDocument, loadApp } from "@graview/core/cli";
import { compileDocument } from "@graview/core/check";
import { documentOf, sayFindings, toDocument } from "@graview/core/document";
import type { FrictionEvent } from "@graview/core/friction";
import { acceptAppSuggestion, declineAppSuggestion, learningFrom, type AppSuggestion, type Learned, type LearnedRecord } from "@graview/core/learn";
import { fileLearned } from "@graview/ship";
import { openHost } from "./cli.js";

/*
 * `graview learn` (Roadmap f-learned-suggestions): the app's own actor's
 * suggestions about the app itself, read from a store and the files beside
 * it, and a person's answer to one. The judge is core's (`learningFrom`);
 * this reads files, prints, and writes the answer — never a change nobody
 * asked for.
 */

export const LEARN_USAGE = `  graview learn <entry> [--data <dir> | --sqlite <file> | --remote-url <url>]
                        [--friction <file>] [--opens <file>] [--min-people <n>] [--json]
                        [--accept <key> | --decline <key>] [--as <id>]
      What the app's own actor suggests changing in the app itself, learned
      from use: another word for a kind or a field people searched with and
      found nothing, a choice for a text field whose values repeat, a date
      field for dates written into words, one act for two that several
      people take one after the other, a clearer description for an act
      agents call wrongly, and — from --opens, a JSON of each place's slug
      and how many people opened it — a place nobody opens. Each only when
      --min-people (3) distinct people show it. Reads the store's log, and
      friction.json and learned.json beside it (--friction for another
      file); prints each with its edits, in words or --json. Nothing changes
      until a person answers: --decline <key> keeps the answer in
      learned.json, and it is never suggested again; --accept <key> applies
      its edits to a document entry (.json) through the editor as one change
      with its lineage, checks it and writes the file. A TypeScript app's
      edits are made in its source, by hand or through the studio.
`;

const flag = (argv: readonly string[], name: string): string | undefined => {
  const at = argv.indexOf(name);
  return at === -1 ? undefined : argv[at + 1];
};
const say = (text: string) => process.stderr.write(text);

/** Friction events from the file `graview serve` keeps them in, or none. */
export function readFriction(path: string): readonly FrictionEvent[] {
  try {
    return (JSON.parse(readFileSync(resolve(path), "utf8")) as { events?: FrictionEvent[] }).events ?? [];
  } catch {
    return [];
  }
}

/**
 * What the app's own actor learned from this store and what was answered
 * before. Told to a seat (`seat`, as `graview mcp` tells its agent), it is
 * learned from what that seat is served — its records and its log, as its
 * sight serves them — since what was learned names the values people wrote
 * in a field, and a field or a kind its sight hides is not its to be told.
 */
export function learningOf<S extends AnySchema>(
  app: GraviewApp<S>,
  store: Store<S>,
  friction: readonly FrictionEvent[],
  declined: readonly { readonly key: string }[],
  extra: { readonly opens?: Readonly<Record<string, number>>; readonly minPeople?: number; readonly seat?: Principal } = {},
): Learned {
  const { seat, ...rest } = extra;
  const seen = seat ? store.seenBy(seat) : store;
  return learningFrom({
    document: documentOf(app) ?? toDocument(app).document,
    friction,
    log: seen.log.all(),
    records: seen.graph.allNodes() as unknown as readonly LearnedRecord[],
    declined,
    ...rest,
  });
}

/** One suggestion in words: what it would change, why, its edits and its key. */
function sayLearned(suggestion: AppSuggestion, at: number): string {
  return [`${at}. ${suggestion.said}`, `   why: ${suggestion.why}`, ...suggestion.edits.map((edit) => `   edit: ${JSON.stringify(edit)}`), `   key: ${suggestion.key}`].join("\n");
}

/** `graview learn`: what the app's own actor suggests changing in the app, and a person's answer to one. */
export async function learn(argv: readonly string[]): Promise<number> {
  const entry = entryArg(argv, 0);
  if (!entry) {
    process.stderr.write(`graview learn: an entry module is required\n\n${LEARN_USAGE}`);
    return 2;
  }
  const app = await loadApp(entry);
  const accepting = flag(argv, "--accept");
  const declining = flag(argv, "--decline");
  const minPeople = flag(argv, "--min-people");
  const opensFile = flag(argv, "--opens");
  const as = flag(argv, "--as");
  const by = as ? { kind: "human" as const, id: as } : undefined;
  const host = await openHost(app, argv, { kind: "agent", id: "graview-learn" }, "cli");
  try {
    await host.refresh();
    const frictionFile = flag(argv, "--friction") ?? host.files?.friction;
    const answers = host.files ? fileLearned(host.files.learned) : undefined;
    const opens = opensFile ? (JSON.parse(readFileSync(resolve(opensFile), "utf8")) as Record<string, number>) : undefined;
    const learned = learningOf(app, host.store, frictionFile ? readFriction(frictionFile) : [], answers?.list() ?? [], {
      ...(opens ? { opens } : {}),
      ...(minPeople !== undefined ? { minPeople: Number(minPeople) } : {}),
    });
    const asked = accepting ?? declining;
    if (asked !== undefined) {
      const suggestion = learned.suggestions.find((one) => one.key === asked);
      if (!suggestion) {
        say(`graview learn: nothing is suggested as "${asked}" now: it was answered already, or its evidence is gone. Run graview learn to see what is.\n`);
        return 1;
      }
      if (!answers) {
        say("graview learn: an answer is kept in learned.json beside the store; against a remote, answer where the server keeps it.\n");
        return 2;
      }
      if (declining !== undefined) {
        answers.add(declineAppSuggestion(suggestion, by ? { by } : {}));
        say(`graview learn: declined, and not suggested again: ${suggestion.said}\n`);
        return 0;
      }
      if (!isDocument(entry)) {
        say(`graview learn: ${entry} is TypeScript, so its edits are made in its source, by hand or through the studio:\n${suggestion.edits.map((edit) => `  ${JSON.stringify(edit)}`).join("\n")}\n`);
        return 1;
      }
      const accepted = acceptAppSuggestion(documentOf(app) ?? toDocument(app).document, suggestion, by ? { by } : {});
      if (!accepted.ok) {
        say(`graview learn: its edits no longer apply:\n${sayFindings(accepted.findings)}\n`);
        return 1;
      }
      const checked = compileDocument(accepted.document);
      if (!checked.ok) {
        say(`graview learn: the app it would make does not check:\n${sayFindings(checked.findings)}\n`);
        return 1;
      }
      writeFileSync(resolve(entry), `${JSON.stringify(accepted.document, null, 2)}\n`);
      answers.add(accepted.decision);
      say(`graview learn: accepted. ${accepted.said.join(" ")}\n`);
      process.stdout.write(`${JSON.stringify({ ok: true, key: suggestion.key, lineage: accepted.lineage, said: accepted.said }, null, 2)}\n`);
      return 0;
    }
    if (argv.includes("--json")) {
      process.stdout.write(`${JSON.stringify({ app: app.name, where: host.where, suggestions: learned.suggestions, skipped: learned.skipped }, null, 2)}\n`);
      return 0;
    }
    const count = learned.suggestions.length;
    const lines = [
      `graview learn: ${app.name} on ${host.where}: ${count === 0 ? "nothing to suggest" : `${count} suggestion${count === 1 ? "" : "s"}`}. Nothing changes until a person answers.`,
      ...learned.suggestions.map((one, at) => sayLearned(one, at + 1)),
      ...(learned.skipped.length > 0 ? ["Seen, and not suggested:", ...learned.skipped.map((one) => `  - ${one.why}`)] : []),
      ...(count > 0 ? [`Answer one: graview learn ${entry} --accept <key>, or --decline <key>`] : []),
    ];
    process.stdout.write(`${lines.join("\n")}\n`);
    return 0;
  } finally {
    await host.close();
  }
}
