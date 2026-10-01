// @vitest-environment jsdom
/* React's act() wants to know it is in a test environment. */
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { FindBox, registerDefaultViews } from "../../src/index.js";

/**
 * FIND SAYS WHICH IS WHICH. The discography has a song and an album both
 * called "Gone Digital", and the journeys found the strip listing two rows
 * that read "Gone Digital" — the album first, nothing in either row saying
 * which was the song. Each row is read alone, by the pointer that lands on
 * it and the screen reader that speaks it, so a row whose name another
 * kind's row shares says its noun; and inside the songs, the song leads.
 */
const song = defineNode("song", { fields: z.object({ label: z.string() }), plural: "Songs", label: (node) => node.label });
const album = defineNode("album", { fields: z.object({ label: z.string() }), plural: "Albums", label: (node) => node.label });
const schema = createSchema([song, album]);

async function strip(focusId?: string) {
  const store = new Store({
    schema,
    mutations: [],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "album:gone-digital", kind: "album", label: "Gone Digital" },
        { id: "song:gone-digital", kind: "song", label: "Gone Digital" },
        { id: "song:paper-money", kind: "song", label: "Paper Money" },
      ] as never,
      edges: [],
    },
  });
  const views = registerDefaultViews(schema, createViews(schema));
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  await act(() => {
    root.render(
      <GraviewProvider store={store} views={views} initialView={{ ...EMPTY_VIEW, q: "gone digital", ...(focusId ? { focusId } : {}) }}>
        <FindBox />
      </GraviewProvider>,
    );
  });
  const rows = [...host.querySelectorAll('[data-testid="find-hit"][data-about="node"]')].map((row) => row.textContent ?? "");
  root.unmount();
  host.remove();
  return rows;
}

describe("Find says which is which", () => {
  it("says the noun on each row whose name a row of another kind shares", async () => {
    const rows = await strip();
    expect(rows).toHaveLength(2);
    expect(rows).toContain("Gone Digital · song");
    expect(rows).toContain("Gone Digital · album");
  });

  it("puts the song first when the person is in the songs", async () => {
    expect((await strip(aggregateId("song")))[0]).toBe("Gone Digital · song");
    expect((await strip(aggregateId("album")))[0]).toBe("Gone Digital · album");
  });
});
