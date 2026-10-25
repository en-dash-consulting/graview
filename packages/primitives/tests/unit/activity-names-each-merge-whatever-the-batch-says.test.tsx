// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store, type Principal } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityRail, registerDefaultViews } from "../../src/index.js";

/**
 * ACTIVITY NAMES EACH MERGE, WHATEVER THE BATCH SAYS (Roadmap
 * f-activity-names-merges). An agent's batch carried its own intent,
 * "Cursor: merge-actor, edit-threat", and Activity said only that, so a
 * count that dropped (software 79 → 78) was never explained. The row says
 * the batch's intent and then, by each op's own sentence, every op that
 * takes a record out of the counts: a merge, a removal, an archive.
 */
const actor = defineNode("actor", { fields: z.object({ label: z.string(), note: z.string().optional() }), plural: "Actors" });
const schema = createSchema([actor]);
const nora: Principal = { kind: "human", id: "nora", roles: [] };

function store() {
  return new Store({
    schema,
    mutations: [],
    snapshot: {
      nodes: [
        { id: "a1", kind: "actor", label: "APT1" },
        { id: "a2", kind: "actor", label: "APT-1" },
        { id: "a3", kind: "actor", label: "Comment Crew" },
        { id: "a4", kind: "actor", label: "Sandworm" },
        { id: "a5", kind: "actor", label: "Fancy Bear" },
      ] as never,
      edges: [],
    },
  });
}

async function rows(given: Store<typeof schema>): Promise<readonly string[]> {
  const host = document.createElement("div");
  document.body.appendChild(host);
  const root = createRoot(host);
  await act(async () => {
    root.render(
      <GraviewProvider store={given} views={registerDefaultViews(schema, createViews(schema))} initialView={EMPTY_VIEW} principal={nora}>
        <ActivityRail calls={[]} />
      </GraviewProvider>,
    );
  });
  await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
  const said = [...document.querySelectorAll('[data-testid="diff-log"] > li')].map((row) => row.textContent ?? "");
  await act(async () => root.unmount());
  host.remove();
  return said;
}

describe("Activity's row for a batch that carries its own intent", () => {
  it("says each merge, removal and archive by the op's own sentence, after the batch's intent", async () => {
    const given = store();
    given.applyAll(
      [
        { name: "merge-actor", args: { id: "a2", into: "a1" } },
        { name: "edit-actor", args: { id: "a1", note: "Also called Comment Crew" } },
        { name: "remove-actor", args: { id: "a3" } },
        { name: "archive-actor", args: { id: "a4" } },
      ],
      { author: nora, intent: "Cursor: merge-actor, edit-threat" },
    );
    const [row] = await rows(given);
    expect(row).toContain("Cursor: merge-actor, edit-threat — Merge APT-1 into APT1; Remove Comment Crew; Archive Sandworm");
    // The edit takes nothing out of the counts, so the batch's own words say it.
    expect(row).not.toContain("Also called");
  });

  it("says the batch's intent alone when nothing leaves the counts", async () => {
    const given = store();
    given.applyAll([{ name: "edit-actor", args: { id: "a5", note: "Russia" } }], { author: nora, intent: "Cursor: edit-actor" });
    const [row] = await rows(given);
    expect(row).toContain("Cursor: edit-actor");
    expect(row).not.toContain(" — ");
  });

  it("says a lone merge once, as its own sentence", async () => {
    const given = store();
    given.apply({ name: "merge-actor", args: { id: "a2", into: "a1" } }, { author: nora });
    const [row] = await rows(given);
    expect(row).toContain("Merge APT-1 into APT1");
    expect(row).not.toContain(" — ");
  });
});
