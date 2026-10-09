import { bindSchema, createSchema, defineNode, Store } from "@graview/core";
import { EMPTY_VIEW } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { AgentSeat, registerDefaultViews, Shell } from "../../src/index.js";
import { ProfilePane } from "../../src/bar-panes.js";

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

/** What is behind the person, as it draws once fetched. */
const pane = (part: "top" | "rest") =>
  renderToStaticMarkup(
    <GraviewProvider store={store()} views={registerDefaultViews(schema, createViews(schema))} initialView={{ ...EMPTY_VIEW, overview: true }}>
      <ProfilePane part={part} name="Somebody" me={undefined} scheme="light" onScheme={() => {}} hostActions={[]} close={() => {}} />
    </GraviewProvider>,
  );

describe("the shell", () => {
  it("has the landmarks a page needs: one heading, one main, the bar as banner", () => {
    const html = render();
    expect(html.match(/<h1/g)?.length).toBe(1);
    expect(html).toMatch(/<h1[^>]*>(?:(?!<\/h1>).)*Field Notes(?:(?!<\/h1>).)*<\/h1>/);
    expect(html.match(/<main/g)?.length).toBe(1);
    expect(html).toContain("<header");
  });

  it("carries the parts the harnesses drive, under the ids they use", () => {
    const html = render({ seat: () => <button type="button" data-testid="agent-x">seat</button> });
    // The one app bar, as an embed's scene face wears it (FR-131, FR-137); Find and Activity are put in it once it has drawn.
    for (const id of ["app-bar", "app-home", "app-face-scene", "app-face-pages", "standing", "overview", "profile-button"]) {
      expect(html, id).toContain(`data-testid="${id}"`);
    }
    // The way home is the app's front page on the pages, as an embed's is.
    expect(html).toMatch(/href="\/pages"[^>]*data-testid="app-home"/);
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
    // One scheme control, and it is the pair inside the pane — fetched when the person is first reached for (FR-131).
    expect(html).not.toContain('data-testid="scheme"');
    expect(pane("rest")).toContain('data-testid="profile-scheme-light"');
    // The keeper's ways in are in the pane, which is mounted and hidden.
    expect(html).toContain('data-testid="profile-keeping"');
    expect(html).toContain('data-testid="studio-place"');
    // And the person is one tool on the bar, named for who it is and what is behind it.
    expect(html).toMatch(/data-testid="profile-button"[^>]*aria-label="[^"]+ — you, your seat and your settings"/);
  });

  it("names the seat's roles in words, never their ids", () => {
    // W-149: "sales-manager" in the pane beside "Dana Whitfield".
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={store()}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, overview: true }}
        principal={{ kind: "human", id: "dana", roles: ["sales-manager"] }}
      >
        <ProfilePane part="top" name="Dana" me={undefined} hostActions={[]} close={() => {}} />
      </GraviewProvider>,
    );
    expect(html).toContain(">Sales manager<");
    expect(html).not.toContain(">sales-manager<");
  });

  it("says what the app says when nothing is wrong, and draws no switch when there are no pages", () => {
    const html = render({ standing: "The garden keeps its agreements", pagesHref: null, chat: false });
    expect(html).toContain("The garden keeps its agreements");
    expect(html).not.toContain('data-testid="app-faces"');
    // The way home is then the scene's own: a press, not a link.
    expect(html).toMatch(/<button[^>]*data-testid="app-home"/);
  });

  /*
   * THE OLD BAR'S FURNITURE IS GONE: the wordmark (the bar's name is the way
   * home), the browser's back and forward drawn again (the browser has its
   * own), "Lists" (the switch's Pages), and the places as tabs (the bar's
   * place control). What the picture is doing is on the picture.
   */
  it("draws none of the old bar's furniture", () => {
    const html = render();
    for (const id of ["wordmark", "backtrack", "pages-link", "places"]) expect(html, id).not.toContain(`data-testid="${id}"`);
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
    // In the store's words (W-147): the act by its title and who may, never "refuses add-note".
    expect(html).not.toContain("refuses add-note");
    expect(html).toContain("a keeper can");
    // Not "there is something here already", which is a different answer.
    expect(html).not.toContain(">There is something here already<");
  });

  it("descends into the selected district, or the first one declared, never nowhere", async () => {
    const { descentTarget } = await import("../../src/index.js");
    const { aggregateId, kindCardId } = await import("@graview/layout");
    const altitude = { ...EMPTY_VIEW, overview: true };
    expect(descentTarget(altitude, ["note", "tag"])).toBe(aggregateId("note"));
    expect(descentTarget({ ...altitude, selection: [kindCardId("tag")] }, ["note", "tag"])).toBe(aggregateId("tag"));
    /* With nothing focused or selected, the first kind that has a drive-in wins over the first kind. */
    expect(descentTarget(altitude, ["note", "tag"], ["tag"])).toBe(aggregateId("tag"));
    expect(descentTarget({ ...altitude, selection: [kindCardId("note")] }, ["note", "tag"], ["tag"])).toBe(aggregateId("note"));
    expect(descentTarget({ ...altitude, focusId: "note:a" }, ["note"])).toBe("note:a");
    expect(descentTarget(altitude, [])).toBeNull();
  });
});
