import { bindSchema, createSchema, defineNode, nodeRef, Store } from "@graview/core";
import { EMPTY_VIEW, edgeSelectionId, kindCardId } from "@graview/layout";
import { GraviewProvider, createViews } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { Inspector, registerDefaultViews } from "../../src/index.js";

/**
 * A selected LINE gets an inspector about the relation: the declaration's
 * own sentence, both ends as pressable names, and the actions the schema
 * provider derived for exactly this edge.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
  edges: {
    "rides-in": { to: ["duty"], description: "who is along for it" },
  },
});
const duty = defineNode("duty", { fields: z.object({ label: z.string() }), plural: "Runs" });
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const removeRider = bound.defineMutation("remove-rider", {
  title: "Take them off it",
  description: "Remove a rider from a run.",
  severs: ["rides-in"],
  input: z.object({ dutyId: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
  apply(ctx, args) {
    ctx.removeEdge({ kind: "rides-in", from: args.personId, to: args.dutyId });
  },
});

const store = () =>
  new Store({
    schema,
    mutations: [removeRider],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "morning", kind: "duty", label: "Morning run" },
      ] as never,
      edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
    },
  });

const render = (selection: readonly string[]) =>
  renderToStaticMarkup(
    <GraviewProvider
      store={store()}
      views={registerDefaultViews(schema, createViews(schema))}
      initialView={{ ...EMPTY_VIEW, focusId: "morning" }}
      initialSelection={selection}
    >
      <Inspector />
    </GraviewProvider>,
  );

describe("the inspector for a selected line", () => {
  it("names the relation in its declaration's words, and links both ends", () => {
    const html = render([edgeSelectionId("rides-in", "ana", "morning")]);
    // Its words, never its name spaced out (W-133).
    expect(html).toContain("Who is along for it");
    expect(html).not.toContain(">Rides in<");
    expect(html).toContain("relation");
    // No inverse was declared, so there is no other reading to add.
    expect(html).not.toContain('data-testid="edge-said"');
    // Nor on the act's reason: the line is what it means, not its name.
    expect(html).not.toContain('this line is &quot;rides-in&quot;');
    expect(html).toContain('data-testid="edge-from"');
    expect(html).toContain("Ana");
    expect(html).toContain("Morning run");
    // Not a node: the travel hint would be a lie on a line.
    expect(html).not.toContain("double-click opens");
  });

  it("offers the derived severing action, prefilled", () => {
    const html = render([edgeSelectionId("rides-in", "ana", "morning")]);
    expect(html).toContain("Take them off it");
  });

  /*
   * The same graph, with nothing declared that touches the edge. It used to
   * be an EMPTY store — a selection of a line the graph did not have, which
   * only rendered anything at all while a stop was allowed to name what was
   * not there (see `a-stop-that-still-exists`). The question this asks is
   * about the MUTATIONS, so only those change.
   */
  it("says plainly when no mutation claims the edge kind", () => {
    const plain = new Store({
      schema,
      mutations: [],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "morning", kind: "duty", label: "Morning run" },
        ] as never,
        edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
      },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={plain}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={EMPTY_VIEW}
        initialSelection={[edgeSelectionId("rides-in", "ana", "morning")]}
      >
        <Inspector />
      </GraviewProvider>,
    );
    expect(html).toContain("nothing this app declares");
  });

  /*
   * A WITHHELD ACT SAYS WHY, WHERE THE STRIKE IS.
   *
   * The reason lived in a `title` on a DISABLED button, which cannot be
   * focused — so a keyboard had no way to ask for it and a pointer had to
   * hover a dead control. The pages face has always said the sentence in the
   * open; the two surfaces disagreed about whether a refusal is explained.
   */
  it("strikes a withheld act and says the policy's reason in the open", () => {
    const guarded = new Store({
      schema,
      mutations: [removeRider],
      invariants: [],
      policy: {
        roles: ["driver", "rider"],
        grants: [
          { roles: ["driver"], mutations: "*", describe: "The driver decides who is aboard." },
        ],
      },
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "morning", kind: "duty", label: "Morning run" },
        ] as never,
        edges: [{ kind: "rides-in", from: "ana", to: "morning" }],
      },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={guarded}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, focusId: "morning" }}
        initialSelection={["morning"]}
        principal={{ kind: "human", id: "somebody", roles: ["rider"] }}
      >
        <Inspector />
      </GraviewProvider>,
    );
    // Struck through, not hidden: the act is named and crossed out.
    expect(html).toContain("<s>Change the duty</s>");
    // And the reason is in the open, not in a title on a control that
    // cannot be focused.
    expect(html).toContain('data-testid="withheld-why"');
    expect(html).toContain("driver can");
    expect(html).toContain("The driver decides who is aboard.");
    expect(html).not.toContain('title="Not permitted');
    // The roles that could, on the element a harness can read.
    expect(html).toContain('data-withheld="driver"');
  });

  /*
   * A DISTRICT IS A KIND, AND THE SENTENCE SHOULD SAY WHICH.
   *
   * The strip reads its kinds from the selection's NODES, and a kind card
   * has none — so a district with every act withheld said "Nothing you may
   * do with this mix of kinds" about one district plainly titled "People".
   */
  it("names the kind when the selection is a district", () => {
    const guarded = new Store({
      schema,
      mutations: [removeRider],
      invariants: [],
      policy: { roles: ["driver", "rider"], grants: [{ roles: ["driver"], mutations: "*" }] },
      snapshot: { nodes: [{ id: "ana", kind: "person", label: "Ana" }] as never, edges: [] },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={guarded}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, overview: true }}
        initialSelection={[kindCardId("person")]}
        principal={{ kind: "human", id: "somebody", roles: ["rider"] }}
      >
        <Inspector />
      </GraviewProvider>,
    );
    expect(html).toContain("a person");
    expect(html).not.toContain("this mix of kinds");
  });

  /*
   * THE HINT SAYS WHAT THE GESTURE WOULD DO NOW. A district's subtitle read
   * "· double-click opens" while the district was already open — and the
   * same double-click closes it.
   */
  it("says the gesture closes a district that is already open", () => {
    const html = (expanded: readonly string[]) =>
      renderToStaticMarkup(
        <GraviewProvider
          store={store()}
          views={registerDefaultViews(schema, createViews(schema))}
          initialView={{ ...EMPTY_VIEW, overview: true, expanded }}
          initialSelection={[kindCardId("person")]}
        >
          <Inspector />
        </GraviewProvider>,
      );
    expect(html([])).toContain("double-click opens");
    expect(html([kindCardId("person")])).toContain("double-click closes");
    expect(html([kindCardId("person")])).not.toContain("double-click opens");
  });

  /*
   * The ids a scaffolded app actually mints. `ctx.freshId(label, kind)`
   * writes "person:ana", which carries the very separator the edge selection
   * id is built out of — and every selected line in every new project opened
   * a pane titled with the raw address, saying nothing could be done with
   * this mix of kinds.
   */
  it("inspects a line whose ends have minted ids", () => {
    const minted = new Store({
      schema,
      mutations: [removeRider],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "person:ana", kind: "person", label: "Ana" },
          { id: "duty:morning-run", kind: "duty", label: "Morning run" },
        ] as never,
        edges: [{ kind: "rides-in", from: "person:ana", to: "duty:morning-run" }],
      },
    });
    const html = renderToStaticMarkup(
      <GraviewProvider
        store={minted}
        views={registerDefaultViews(schema, createViews(schema))}
        initialView={{ ...EMPTY_VIEW, focusId: "duty:morning-run" }}
        initialSelection={[edgeSelectionId("rides-in", "person:ana", "duty:morning-run")]}
      >
        <Inspector />
      </GraviewProvider>,
    );
    expect(html).toContain("Who is along for it");
    expect(html).toContain("Take them off it");
    expect(html).not.toContain("nothing this app declares");
    expect(html).not.toContain("mix of kinds");
  });
});
