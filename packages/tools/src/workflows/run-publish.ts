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
    /*
     * To the head: published as the head stands when it is kept. Asked, it
     * is so under "run" too: a person's yes to the run's changes and the
     * publish with them publishes them, and never takes back what somebody
     * published while the question waited.
     */
    const fixed = step.publish === "run" && context.approve !== "ask";
    const outcome = context.change({ calls: [{ name: PUBLISH, args: fixed ? { through } : {} }], basis, confidence: 1 });
    const range = seqsSaid(first, last);
    const said = (ops: readonly { readonly publishedThrough?: number }[]) => ops.find((op) => op.publishedThrough !== undefined)?.publishedThrough ?? through;
    if (outcome.as === "previewed") {
      context.published({ changes, from: first, to: last, through: said(outcome.ops), as: "previewed" });
      const before = context.index > 0 ? ", and with them what the steps before it would change" : "";
      context.note(`It would publish ${changesSaid(changes)} (${range})${before}; nothing was published.`);
    } else if (outcome.as === "applied") {
      context.published({ changes, from: first, to: last, through: said(outcome.ops), as: "published" });
      context.note(`Published ${changesSaid(changes)} (${range}): readers are served them now.`);
    } else if (outcome.as === "suggested") {
      context.published({ changes, from: first, to: last, as: "suggested" });
      context.note(`Asked a person to publish ${changesSaid(changes)} (${range}); a yes publishes the drafts as they stand then, including what is asked with it.`);
    }
  },
};
