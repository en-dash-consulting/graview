import { existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import { keptDecisions, type HeldLearned, type LearnedDecision } from "@graview/core/learn";

/**
 * WHAT PEOPLE ANSWERED TO THE APP'S OWN SUGGESTIONS ABOUT ITSELF, KEPT IN A
 * FILE BESIDE THE STORE (Roadmap f-learned-suggestions): `learned.json`
 * where `graview serve` keeps `friction.json`, read again whenever another
 * process wrote it, so a decline `graview learn --decline` keeps is read by
 * the next `graview learn` and by `graview mcp`. One decision per
 * suggestion, the latest standing.
 *
 * Not in the op log: the log holds changes to the records, and a
 * declaration suggestion is about the app — a decline changes nothing to
 * undo, and an accepted one is the document's next version, kept wherever
 * the host keeps those.
 */
export function fileLearned(path: string): HeldLearned {
  let held: readonly LearnedDecision[] = [];
  let stamp = -1;
  const fresh = (): readonly LearnedDecision[] => {
    if (!existsSync(path)) {
      held = [];
      stamp = -1;
      return held;
    }
    const at = statSync(path).mtimeMs;
    if (at !== stamp) {
      try {
        const decisions = (JSON.parse(readFileSync(path, "utf8")) as { decisions?: LearnedDecision[] }).decisions ?? [];
        held = keptDecisions(decisions.filter((one) => one && typeof one.key === "string" && (one.answer === "accepted" || one.answer === "declined")));
      } catch {
        // A file somebody broke by hand is read as empty, and written whole again on the next answer.
        held = [];
      }
      stamp = at;
    }
    return held;
  };
  return {
    add(decision) {
      const next = keptDecisions([...fresh(), decision]);
      mkdirSync(dirname(path), { recursive: true });
      writeFileSync(`${path}.tmp`, `${JSON.stringify({ decisions: next }, null, 2)}\n`);
      renameSync(`${path}.tmp`, path);
      held = next;
      stamp = statSync(path).mtimeMs;
    },
    list: () => fresh(),
  };
}
