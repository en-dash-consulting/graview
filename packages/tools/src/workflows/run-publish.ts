import { onPublish, PUBLISH, type AnySchema, type Store } from "@graview/core";
import { draftsOf } from "@graview/core/publishing";
import type { PublishStep } from "@graview/core/workflows";
import type { StepRunner } from "./types.js";

/*
 * PUBLISH THE APP'S DRAFTS (Roadmap f-workflow-step-publishes): the
 * built-in `publish` act, through the run's one door, so the step's
 * approval decides as for any other step — "apply" publishes, "ask" puts
 * it to a person, and a dry run previews it and publishes nothing. It
 * publishes every draft to the head as the step reaches it (`"head"`), or
 * through the last op this run read or made (`"run"`), so a change
 * somebody else made while the run waited stays a draft. With nothing new
 * to publish it publishes nothing and says so; a live app is skipped, in
 * words. What it published — how many changes, the seqs they span — is
 * kept on the run (`published`) and said in its notes.
 */

const changesSaid = (count: number): string => (count === 1 ? "1 change" : `${count} changes`);
const seqsSaid = (from: number, to: number): string => (from === to ? `seq ${from}` : `seqs ${from} to ${to}`);

export const runPublishStep: StepRunner<PublishStep> = {
  key: "publish",
  async run(step, context) {
    const store = context.store as Store<AnySchema>;
    if (!onPublish(store.publishing)) {
      context.skipped("the app is live: every edit reaches its readers as it is made, so there is nothing to publish.");
      return;
    }
    const head = store.log.length;
    // "run": through what the run read as it began, and the last op it made since.
    const ours = step.publish === "run" ? store.log.all().filter((op) => op.lineage?.run === context.run && op.publishedThrough === undefined) : [];
    const through = step.publish === "run" ? Math.max(context.reached, ...ours.map((op) => op.seq + 1)) : head;
    const drafts = draftsOf(store.log, through);
    if (drafts.changes === 0 || drafts.first === undefined || drafts.last === undefined) {
      context.note(`Nothing new to publish: readers are served every change ${step.publish === "run" ? "this run read and made" : "there is"}.`);
      return;
    }
    const { changes, first, last } = drafts;
    const basis = `Publish ${changesSaid(changes)}, in “${context.workflow.title}”`.slice(0, 500);
    // To the head: published as the head stands when it is kept, so a person's yes to it publishes the drafts as they then are.
    const outcome = context.change({ calls: [{ name: PUBLISH, args: step.publish === "run" ? { through } : {} }], basis, confidence: 1 });
    const range = seqsSaid(first, last);
    if (outcome.as === "previewed") {
      context.published({ changes, from: first, to: last, through, as: "previewed" });
      const before = context.index > 0 ? ", and with them what the steps before it would change" : "";
      context.note(`It would publish ${changesSaid(changes)} (${range})${before}; nothing was published.`);
    } else if (outcome.as === "applied") {
      const kept = outcome.ops.find((op) => op.publishedThrough !== undefined)?.publishedThrough ?? through;
      context.published({ changes, from: first, to: last, through: kept, as: "published" });
      context.note(`Published ${changesSaid(changes)} (${range}): readers are served them now.`);
    } else if (outcome.as === "suggested") {
      context.published({ changes, from: first, to: last, through, as: "suggested" });
      context.note(`Asked a person to publish ${changesSaid(changes)} (${range}).`);
    }
  },
};
