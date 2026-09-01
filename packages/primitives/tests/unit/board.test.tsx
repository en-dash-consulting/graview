import { createSchema, defineInvariant, defineNode, Store } from "@graview/core";
import { aggregateId, EMPTY_VIEW } from "@graview/layout";
import { createViews, GraviewProvider, JackedIn } from "@graview/react";
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

  const draw = (store: Store<typeof schema>) =>
    renderToStaticMarkup(
      <GraviewProvider
        store={store}
        views={views()}
        initialView={{ ...EMPTY_VIEW, focusId: aggregateId("seat") }}
        initialJackedIn={aggregateId("seat")}
      >
        <JackedIn />
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
