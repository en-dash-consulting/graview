// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, type ViewProps } from "@graview/react";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ActivityRail, registerDefaultViews, SeatField, Shell } from "../../src/index.js";

/**
 * FR-25: a screen-reader user moving by headings finds the workbench. The
 * bar's h1 names the app; each region a person goes to — the seat that
 * you ask in, the activity, the places — opens with a heading of
 * its own, named as its landmark is.
 */
const note = defineNode("note", { fields: z.object({ label: z.string() }), plural: "Notes" });
const schema = createSchema([note]);
const store = () => new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: [{ id: "n1", kind: "note", label: "First" }] as never, edges: [] } });
const Board = (props: ViewProps<typeof schema>) => <div>{props.nodes?.length ?? 0} notes</div>;
const views = () => registerDefaultViews(schema, createViews(schema)).register("note", { cardinality: "many", fidelity: "full" }, Board, { title: "The board" });

const headings = (html: string) => [...html.matchAll(/<h([1-6])[^>]*>(.*?)<\/h\1>/g)].map((m) => `h${m[1]} ${m[2]!.replace(/<[^>]+>/g, "")}`);

describe("the workbench has headings", () => {
  it("names the app in an h1 and gives the places and the seat a heading each", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW} brand={{ name: "Field Notes" } as never}>
        <Shell<typeof schema> scheme="light" onScheme={() => {}} />
      </GraviewProvider>,
    );
    const said = headings(html);
    expect(said).toContain("h1 Field Notes");
    expect(said).toContain("h2 Places");
    expect(said).toContain("h2 Ask Field Notes");
  });

  it("gives the seat its heading wherever it is mounted, in the app's name and never the word seat", () => {
    const html = renderToStaticMarkup(
      <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW} brand={{ name: "Field Notes" } as never}>
        <SeatField<typeof schema> />
      </GraviewProvider>,
    );
    expect(headings(html)).toEqual(["h2 Ask Field Notes"]);
  });

  it("gives the activity a heading when it is open", async () => {
    const host = document.createElement("div");
    document.body.appendChild(host);
    const root = createRoot(host);
    await act(async () =>
      root.render(
        <GraviewProvider store={store()} views={views()} initialView={EMPTY_VIEW}>
          <ActivityRail calls={[]} remembers />
        </GraviewProvider>,
      ),
    );
    await act(async () => host.querySelector<HTMLButtonElement>('[data-testid="activity-button"]')!.click());
    const heading = host.querySelector('section[aria-label="Activity"] h2');
    expect(heading?.textContent).toBe("Activity");
    await act(async () => root.unmount());
    host.remove();
  });
});
