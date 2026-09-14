import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentSeat, registerDefaultViews, Shell } from "../../src/index.js";

/**
 * The shell is the one file every app used to write and get slightly wrong.
 * What is pinned here is what an app gets without writing it: the parts, in
 * order, the landmarks assistive technology expects, and the test ids the
 * harnesses drive.
 */
const note = defineNode("note", {
  fields: z.object({ label: z.string() }),
  plural: "Notes",
});
const schema = createSchema([note]);
const { defineMutation } = bindSchema(schema);
const store = () => new Store({ schema, mutations: [], invariants: [] });

const render = (props: Partial<Parameters<typeof Shell<typeof schema>>[0]> = {}) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, overview: true }}
      brand={{ name: "Field Notes" } as never}
    >
      <Shell<typeof schema> scheme="light" onScheme={() => {}} {...props} />
    </GraviewProvider>,
  );

describe("the shell", () => {
  it("has the landmarks a page needs: one heading, one main, the bar as banner", () => {
    const html = render();
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toContain("Field Notes</h1>");
    expect(html.match(/<main/g)?.length).toBe(1);
    expect(html).toContain("<header");
  });

  it("carries the parts the harnesses drive, under the ids they use", () => {
    const html = render({ seat: () => <button type="button" data-testid="agent-x">seat</button> });
    for (const id of ["pages-link", "standing", "activity-button", "overview", "profile-button"]) {
      expect(html, id).toContain(`data-testid="${id}"`);
    }
    expect(html).toContain('href="/pages"');
  });

  /**
   * WHAT IS THE READER'S OWN, AND WHAT KEEPS THE APP, LIVE BEHIND ONE DOOR.
   *
   * The bar carried a scheme toggle AND the profile carried a pair of
   * scheme buttons — two controls for one setting. It also carried "Show
   * the installation" and "Studio" beside the places, where every reader
   * met two controls only a keeper can use, in the same row as the app's
   * own pictures.
   */
  it("keeps the scheme, the installation and the studio behind the profile rather than on the bar", () => {
    const html = render({ studio: <button type="button" data-testid="studio-place">Studio</button> });
    // One scheme control, and it is the pair inside the pane.
    expect(html).not.toContain('data-testid="scheme"');
    expect(html).toContain('data-testid="profile-scheme-light"');
    // The keeper's ways in are in the pane, which is mounted and hidden.
    expect(html).toContain('data-testid="profile-keeping"');
    expect(html).toContain('data-testid="studio-place"');
    // And the gear says the settings are there before it is opened.
    expect(html).toContain('data-testid="profile-gear"');
  });

  it("says what the app says when nothing is wrong, and hides the pages link when asked", () => {
    const html = render({ standing: "The garden keeps its agreements", pagesHref: null, chat: false });
    expect(html).toContain("The garden keeps its agreements");
    expect(html).not.toContain('data-testid="pages-link"');
  });

  it("puts the app's own navigation between the browser controls and the trail", () => {
    const html = render({ nav: <nav data-testid="places">places</nav> });
    const backtrack = html.indexOf('data-testid="backtrack"');
    const places = html.indexOf('data-testid="places"');
    expect(backtrack).toBeGreaterThan(-1);
    expect(places).toBeGreaterThan(backtrack);
  });
});

describe("Focus, from altitude", () => {
  /*
   * A SEAT THAT MAY NOT SIT DOWN SAYS SO, in the open. The reason was a
   * `title` on a disabled button — unreachable from a keyboard — and the
   * label under it said something else entirely.
   */
  it("strikes a seat the policy refuses and says why beside it", () => {
    const add = defineMutation("add-note", {
      title: "Add a note",
      description: "Bring a note in.",
      creates: ["note"],
      input: z.object({ label: z.string().min(1) }),
      apply(ctx, args) {
        ctx.addNode({ id: `note-${args.label}`, kind: "note", label: args.label } as never);
      },
    });
    const guarded = new Store({
      schema,
      mutations: [add],
      invariants: [],
      policy: {
        roles: ["keeper", "reader"],
        grants: [{ roles: ["keeper"], mutations: "*", describe: "The keeper writes." }],
      },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={guarded}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, overview: true }}
        principal={{ kind: "human", id: "somebody", roles: ["reader"] }}
      >
        {/* The seat itself: in the app it lives inside the Activity
            popover, which a static render never opens. */}
        <AgentSeat<typeof schema>
          who="starter"
          testId="agent-starter"
          count={1}
          gate="add-note"
          label={() => "Add some starter data"}
          busyLabel="Adding…"
          idle="There is something here already"
          onCall={() => {}}
          run={async () => {}}
        />
      </GraviewProvider>,
    );
    expect(html).toContain("<s>Add some starter data</s>");
    expect(html).toContain('data-testid="agent-starter-why"');
    expect(html).toContain("Not yours to do from this seat");
    // Not "there is something here already", which is a different answer.
    expect(html).not.toContain(">There is something here already<");
  });

  it("descends into the selected district, or the first one declared, never nowhere", async () => {
    const { descentTarget } = await import("../../src/index.js");
    const { aggregateId, kindCardId } = await import("@graview/layout");
    const altitude = { ...EMPTY_VIEW, overview: true };
    expect(descentTarget(altitude, ["note", "tag"])).toBe(aggregateId("note"));
    expect(descentTarget({ ...altitude, selection: [kindCardId("tag")] }, ["note", "tag"])).toBe(aggregateId("tag"));
    expect(descentTarget({ ...altitude, focusId: "note:a" }, ["note"])).toBe("note:a");
    expect(descentTarget(altitude, [])).toBeNull();
  });
});
