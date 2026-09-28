import { createSchema, defineInvariant, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, ResolvedView } from "@graview/react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  BoardBindingError,
  buildBoard,
  createBoardLens,
  registerDefaultViews,
} from "../../src/index.js";

/**
 * Deliberately not a football pitch. If a lens only works beside the app it
 * was written for it is a component, not a lens — so this fixture is a
 * seating plan, which is the same shape and nothing like the same domain.
 */
const seat = defineNode("seat", {
  fields: z.object({ label: z.string(), code: z.string(), x: z.number(), y: z.number() }),
  edges: { "taken-by": { to: ["guest"] } },
  plural: "Seats",
});
const guest = defineNode("guest", { fields: z.object({ label: z.string() }), plural: "Guests" });
const schema = createSchema([seat, guest]);

const nodes = [
  { id: "s1", kind: "seat", label: "Head of table", code: "1", x: 0.5, y: 0.1 },
  { id: "s2", kind: "seat", label: "Window side", code: "2", x: 0.2, y: 0.5 },
  { id: "s3", kind: "seat", label: "Door side", code: "3", x: 0.8, y: 0.5 },
  { id: "g-ada", kind: "guest", label: "Ada" },
  { id: "g-bram", kind: "guest", label: "Bram" },
  { id: "g-cleo", kind: "guest", label: "Cleo" },
] as never[];

const edges = [
  { kind: "taken-by", from: "s1", to: "g-ada" },
  { kind: "taken-by", from: "s3", to: "g-bram" },
];

const options = { slots: "seat", x: "x", y: "y", fill: "taken-by", slotCode: "code" } as const;

describe("the board lens, read from the occupant's end", () => {
  it("fills the same slots when the edge runs occupant → slot", () => {
    // The garden's shape: a planting grows-in a plot. Same board, other end.
    const reversed = edges.map((edge) => ({ kind: "grows-in", from: edge.to, to: edge.from }));
    const board = buildBoard(nodes, reversed, { ...options, fill: "grows-in", fillFrom: "occupant" }, schema);
    expect(board.slots.find((slot) => slot.id === "s1")?.occupants.map((o) => o.label)).toEqual(["Ada"]);
    expect(board.empty).toEqual(["s2"]);
    expect(board.spare.map((g) => g.label)).toEqual(["Cleo"]);
  });
});

describe("an empty graph is a picture, not a crash", () => {
  it("builds a board with no slots and nobody benched", () => {
    const board = buildBoard([], [], options, schema);
    expect(board.slots).toEqual([]);
    expect(board.spare).toEqual([]);
    expect(board.empty).toEqual([]);
  });
});

describe("a slot that holds several", () => {
  it("shows every occupant and lists none of them as not in", () => {
    // Two plantings in one plot. The board showed one and benched the other,
    // which was a picture stating something untrue.
    const shared = [...edges, { kind: "taken-by", from: "s1", to: "g-cleo" }];
    const board = buildBoard(nodes, shared, options, schema);
    expect(board.slots.find((slot) => slot.id === "s1")?.occupants.map((o) => o.label)).toEqual(["Ada", "Cleo"]);
    expect(board.spare).toEqual([]);
    expect(board.empty).toEqual(["s2"]);
  });

  it("makes each name its own target when the disc stands for the slot", () => {
    const shared = [...edges, { kind: "taken-by", from: "s1", to: "g-cleo" }];
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges: shared } });
    const lens = createBoardLens<typeof schema>(options);
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}>
        <lens.View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect(html).toContain('data-graview-pick="s1"');
    expect(html).toContain('data-graview-pick="g-ada"');
    expect(html).toContain('data-graview-pick="g-cleo"');
    // A slot with one occupant is still that occupant's disc.
    expect(html).toContain('data-graview-pick="g-bram"');
  });

  /*
   * A WORD DOES NOT FIT IN A DISC. Load map's codes were "Outbound" and
   * "Prop-fin", drawn in 34-pixel circles; the two full names under a
   * shared seat landed on the row beneath. A board of words draws tokens,
   * with the names inside the mark.
   */
  const wordNodes = [
    { id: "s1", kind: "seat", label: "Proposal finalization", code: "Prop-fin", x: 0.2, y: 0.2 },
    { id: "s2", kind: "seat", label: "Outbound hunt", code: "Outbound", x: 0.6, y: 0.2 },
    { id: "s3", kind: "seat", label: "Pricing", code: "Price", x: 0.4, y: 0.7 },
    { id: "g-nick", kind: "guest", label: "Nick Daniel" },
    { id: "g-john", kind: "guest", label: "John Halberstadt" },
  ] as never[];
  const wordEdges = [
    { kind: "taken-by", from: "s1", to: "g-nick" },
    { kind: "taken-by", from: "s1", to: "g-john" },
    { kind: "taken-by", from: "s3", to: "g-john" },
  ];
  const drawWords = (extra: Partial<Parameters<typeof createBoardLens>[0]> = {}) => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes: wordNodes, edges: wordEdges } });
    const lens = createBoardLens<typeof schema>({ ...options, emptyLabel: "open", ...extra });
    return renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}>
        <lens.View nodes={wordNodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
      </GraviewProvider>,
    );
  };

  it("draws discs when every code is three characters, and tokens when any code is a word", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges } });
    const lens = createBoardLens<typeof schema>(options);
    const discs = renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}>
        <lens.View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    expect(discs.match(/data-graview-mark="disc"/g)).toHaveLength(3);
    expect(discs).not.toContain('data-graview-mark="token"');
    const tokens = drawWords();
    expect(tokens.match(/data-graview-mark="token"/g)).toHaveLength(3);
    expect(tokens).not.toContain('data-graview-mark="disc"');
    // The whole code, never cut in the markup — the ellipsis is the box's.
    expect(tokens).toContain(">Prop-fin<");
    expect(tokens).toContain(">Outbound<");
  });

  it("puts the occupants inside a token, whole, each their own target when the mark is the slot's", () => {
    const html = drawWords();
    expect(html).toContain(">Nick Daniel<");
    expect(html).toContain(">John Halberstadt<");
    expect(html).toContain('data-graview-pick="g-nick"');
    expect(html).toContain('data-graview-pick="g-john"');
    expect(html).toContain("Nick Daniel, John Halberstadt at Proposal finalization");
    // A hole is a dashed token saying what an empty one is called here.
    expect(html).toContain(">open<");
  });

  it("shelves the slots by zone in the domain's order, each zone headed by its whole name, when the arrangement is categories", () => {
    const html = drawWords({
      arrange: "shelf",
      zones: [
        { label: "Nick still owns", from: 0, to: 0.5 },
        { label: "Elsewhere / handoff runway", from: 0.5, to: 1 },
      ],
    });
    expect(html).toContain('data-graview-arrange="shelf"');
    const at = (text: string) => html.indexOf(text);
    expect(at('data-graview-zone="Nick still owns"')).toBeGreaterThan(-1);
    expect(at('data-graview-zone="Elsewhere / handoff runway"')).toBeGreaterThan(at('data-graview-zone="Nick still owns"'));
    expect(html).toContain(">Elsewhere / handoff runway<");
    // Top row left to right, then the next zone — and nothing placed by pixel.
    expect(at('data-graview-slot="s1"')).toBeLessThan(at('data-graview-slot="s2"'));
    expect(at('data-graview-slot="s2"')).toBeLessThan(at('data-graview-slot="s3"'));
    expect(html).not.toContain("position:absolute;left:");
  });

  it("keeps a slot no zone claims, in a band of its own", () => {
    const html = drawWords({ arrange: "shelf", zones: [{ label: "Top", from: 0, to: 0.5 }] });
    expect(html).toContain('data-graview-zone="Top"');
    expect(html).toContain('data-graview-slot="s3"');
    expect(html.match(/<section/g)).toHaveLength(2);
  });

  it("selects the slot itself when pickTarget is slot, even for a sole occupant", () => {
    const store = new Store({ schema, mutations: [], invariants: [], snapshot: { nodes, edges } });
    const lens = createBoardLens<typeof schema>({ ...options, pickTarget: "slot" });
    const html = renderToStaticMarkup(
      <GraviewProvider store={store} views={createViews(schema)} initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}>
        <lens.View nodes={nodes as never} fidelity="full" cardinality="many" mode="scene" selected={false} />
      </GraviewProvider>,
    );
    // Sole-filled seats pick the seat, not Bram / Ada.
    expect(html).toContain('data-graview-pick="s1"');
    expect(html).toContain('data-graview-pick="s3"');
    expect(html).not.toContain('data-graview-pick="g-bram"');
    expect(html).not.toContain('data-graview-pick="g-ada"');
    // Empty seat still picks the slot.
    expect(html).toContain('data-graview-pick="s2"');
  });
});

describe("the board lens", () => {
  it("declares the roles an app must bind", () => {
    expect(createBoardLens(options).requiredRoles).toEqual(["slots", "x", "y", "fill"]);
  });

  it("places each slot where the DOMAIN says, not where a layout decided", () => {
    const board = buildBoard(nodes, edges, options, schema);
    const head = board.slots.find((slot) => slot.id === "s1")!;
    expect([head.x, head.y]).toEqual([0.5, 0.1]);
  });

  it("names the empty slot — the reason the lens exists", () => {
    expect(buildBoard(nodes, edges, options, schema).empty).toEqual(["s2"]);
  });

  it("lists whoever is not placed, so the bench is not a mystery", () => {
    expect(buildBoard(nodes, edges, options, schema).spare.map((s) => s.id)).toEqual(["g-cleo"]);
  });

  it("reads top to bottom, so assistive technology gets a sane order", () => {
    // Not the order the graph happened to be in: an arrangement read aloud
    // in storage order is unusable.
    expect(buildBoard(nodes, edges, options, schema).slots.map((slot) => slot.id)).toEqual([
      "s1",
      "s2",
      "s3",
    ]);
  });

  it("clamps a coordinate outside the board rather than drawing off it", () => {
    const stray = [...nodes, { id: "s4", kind: "seat", label: "Stray", code: "4", x: 4, y: -2 }] as never[];
    const slot = buildBoard(stray, edges, options, schema).slots.find((s) => s.id === "s4")!;
    expect([slot.x, slot.y]).toEqual([1, 0]);
  });

  it("says which binding is wrong rather than drawing an empty board", () => {
    expect(() => buildBoard(nodes, edges, { ...options, slots: "nope" }, schema)).toThrow(
      BoardBindingError,
    );
  });
});

/**
 * The marks, and what they are ABOUT.
 *
 * A slot drawn in the warning tone told a reader that something here is
 * wrong and nothing about what — so a seat flagged because of its own rule
 * looked exactly like a seat whose guest is the problem, and the picture was
 * quietly asserting the wrong thing about a person. These render the view
 * rather than the model because it is the drawing that was lying.
 */
describe("what the board says a mark is about", () => {
  const withViolations = (nodeIds: readonly string[], message: string) =>
    new Store({
      schema,
      snapshot: { nodes, edges },
      invariants: [
        defineInvariant<typeof schema, "seat">("seating", {
          scope: { kind: "seat", match: (node) => node.id === "s1" },
          label: "Seating",
          description: "A fixture that always fails, so the drawing can be read.",
          repairs: [],
          evaluate: ({ subject }) => [
            {
              invariant: "seating",
              subjectId: subject.id,
              label: "Seating",
              message,
              nodeIds: [...nodeIds],
              repairs: [],
            },
          ],
        }),
      ],
    });

  const lens = createBoardLens<typeof schema>(options);
  const BoardPicture = (props: never) => <lens.View {...props} label="The table" />;
  const views = () =>
    registerDefaultViews(schema, createViews(schema))
      .register("seat", { cardinality: "many", fidelity: "full" }, BoardPicture)
      .register("seat", { cardinality: "many", fidelity: "summary" }, BoardPicture);

  /*
   * Fullscreen mode is rendered directly now: jack-in zooms the scene
   * instead of opening a page, so the two-mode contract is exercised on the
   * view itself rather than through a modal that no longer exists.
   */
  const draw = (store: Store<typeof schema>) =>
    renderToStaticMarkup(
      <GraviewProvider
        store={store}
        views={views()}
        initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}
      >
        <ResolvedView
          node={{
            id: aggregateId("seat"),
            kind: "seat",
            plane: 0,
            x: 0,
            y: 0,
            width: 1200,
            height: 700,
            pinned: false,
            aggregate: {
              kind: "seat",
              memberIds: store.graph.nodesOfKind("seat").map((node) => node.id),
              label: "Seats",
            },
          }}
          mode="fullscreen"
          selected={false}
          fidelity="full"
        />
      </GraviewProvider>,
    );

  it("marks the SLOT when the rule is about the slot, not the guest in it", () => {
    const html = draw(withViolations(["s1"], "Nobody can hear at the head of the table"));
    expect(html).toContain('data-graview-flagged="slot"');
    expect(html).not.toContain('data-graview-flagged="occupant"');
  });

  it("marks the GUEST when the rule is about the guest, not the seat", () => {
    const html = draw(withViolations(["g-ada"], "Ada cannot sit with Bram"));
    expect(html).toContain('data-graview-flagged="occupant"');
    expect(html).not.toContain('data-graview-flagged="slot"');
  });

  it("drops the card furniture on a page without being asked to", () => {
    // The two-mode contract used to be a prop every view author had to
    // remember to thread into every primitive, and three apps in, the
    // app-written views were still drawing a bordered card in the middle of
    // a full screen. The lens no longer passes a variant; the page does.
    expect(draw(withViolations([], "quiet"))).toContain('data-graview-variant="page"');
  });

  it("says WHY on the board, so a colour is not the whole explanation", () => {
    // The question this answers is "why is that one a different colour", and
    // a picture that cannot answer it should not have drawn it.
    expect(draw(withViolations(["s1"], "Nobody can hear at the head of the table"))).toContain(
      "Nobody can hear at the head of the table",
    );
  });
});
