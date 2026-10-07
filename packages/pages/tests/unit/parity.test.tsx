import {
  bindSchema,
  createSchema,
  defineNode,
  labelOf,
  nodeRef,
  readableFields,
  Store,
  violationsTouching,
  type Violation,
} from "@graview/core";
import { deriveAffordances } from "@graview/tools";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { DerivedForm, PagesApp, kindOfSlug, pluralSlug, recordFacts, recordPath, spatialHref } from "../../src/index.js";

/**
 * THE PARITY CONTRACT. A record page and the spatial detail of the same node
 * must derive identical facts from one store — same fields, same edges, same
 * violations, same legal actions. The page composes the derivations the
 * scene already uses; these tests hold the composition to the originals.
 */

const person = defineNode("person", {
  fields: z.object({ label: z.string() }),
  plural: "People",
});
const duty = defineNode("duty", {
  description: "A run someone owns.",
  fields: z.object({ label: z.string(), minutes: z.number() }),
  plural: "Duties",
  // Both readings, because a relation has two ends — and `graview check`
  // warns `edge-without-inverse` at a declaration that has only one.
  edges: { "owned-by": { to: ["person"], description: "who owns it", inverse: "what they own" } },
});
const schema = createSchema([person, duty]);
const bound = bindSchema(schema);

const relabel = bound.defineMutation("relabel", {
  title: "Rename it",
  description: "Change the label.",
  subject: { kinds: ["duty"], arg: "id" },
  input: z.object({ id: z.string(), label: z.string().min(1) }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const tooLong = bound.defineInvariant("too-long", {
  scope: { kind: "duty" },
  evaluate: ({ subject }): Violation[] =>
    subject.minutes > 60
      ? [
          {
            invariant: "too-long",
            subjectId: subject.id,
            label: "Too long",
            message: `${subject.label} runs over an hour`,
            nodeIds: [subject.id],
            repairs: [],
          },
        ]
      : [],
});

const makeStore = () =>
  new Store({
    schema,
    mutations: [relabel],
    invariants: [tooLong],
    snapshot: {
      nodes: [
        { id: "ana", kind: "person", label: "Ana" },
        { id: "school-run", kind: "duty", label: "School run", minutes: 75 },
      ] as never,
      edges: [{ kind: "owned-by", from: "school-run", to: "ana" }],
    },
  });

describe("one derivation, two faces", () => {
  it("states the same fields the spatial detail derives", () => {
    const store = makeStore();
    const facts = recordFacts(store, "school-run")!;
    expect(facts.fields).toEqual(
      readableFields(
        store.graph.getNode("school-run") as never,
        store.schema.tryDefinition("duty"),
      ),
    );
    expect(facts.label).toBe(
      labelOf(store.schema.tryDefinition("duty"), store.graph.getNode("school-run") as never),
    );
  });

  it("states the same violations and the same legal actions", () => {
    const store = makeStore();
    const facts = recordFacts(store, "school-run")!;
    expect(facts.violations).toEqual(violationsTouching(store.violations(), ["school-run"]));
    const spatial = deriveAffordances(store, ["school-run"]);
    expect(facts.actions.affordances.map((a) => a.id)).toEqual(
      spatial.affordances.map((a) => a.id),
    );
  });

  it("links every edge, both directions", () => {
    const store = makeStore();
    const fromDuty = recordFacts(store, "school-run")!;
    expect(fromDuty.links).toEqual([
      {
        edgeKind: "owned-by",
        direction: "out",
        description: "who owns it",
        targets: [{ id: "ana", kind: "person", label: "Ana" }],
      },
    ]);
    // The undeclared end sees the same relationship, inbound.
    const fromPerson = recordFacts(store, "ana")!;
    expect(fromPerson.links[0]?.direction).toBe("in");
    expect(fromPerson.links[0]?.targets[0]?.id).toBe("school-run");
    expect(fromPerson.links[0]?.description).toBe("what they own");
  });

  /*
   * A CONNECTIONS SECTION READS FROM THE END YOU ARE STANDING ON.
   *
   * Its eyebrow was the edge kind, so a person's record read "Owned by" over
   * "What they own" — the reading `graview check` warns about by name
   * ("from a person it is captioned 'owned by', which is the wrong way
   * round"). It says what is listed now, which is true from either end.
   */
  it("captions a connections section from this end, and never backwards", () => {
    const store = makeStore();
    const onTheDuty = renderToStaticMarkup(
      <PagesApp context={{ store }} initialPath="/duties/school-run" />,
    );
    expect(onTheDuty).toContain("Who owns it");
    expect(onTheDuty).toContain("People");
    expect(onTheDuty).not.toContain("What they own");

    const onThePerson = renderToStaticMarkup(
      <PagesApp context={{ store }} initialPath="/people/ana" />,
    );
    expect(onThePerson).toContain("What they own");
    expect(onThePerson).toContain("Duties");
    // The declaring end's words, over the far end's list, is the wrong way round.
    expect(onThePerson).not.toContain("Who owns it");
    expect(onThePerson).not.toContain("Owned by");
  });
});

describe("the routed face renders from the declaration", () => {
  const app = (path: string) =>
    renderToStaticMarkup(<PagesApp context={{ store: makeStore() }} initialPath={path} />);

  it("derives routes from plurals, both directions", () => {
    expect(pluralSlug(schema, "duty")).toBe("duties");
    expect(kindOfSlug(schema, "duties")).toBe("duty");
    expect(recordPath(schema, "duty", "school-run")).toBe("/duties/school-run");
  });

  it("home indexes every kind and states the standing", () => {
    const html = app("/");
    expect(html).toContain("People");
    expect(html).toContain("Duties");
    // The count is the bar's standing's (FR-122, FR-131); the home says what to do about it.
    expect(html).toContain("A rule is broken — see what, and what would fix it");
    expect(html).toContain('data-testid="standing-link"');
  });

  it("a list page marks trouble and links each record", () => {
    const html = app("/duties");
    expect(html).toContain("School run");
    expect(html).toContain("⚠");
    expect(html).toContain('href="/duties/school-run"');
  });

  it("a record page carries fields, links, violations, actions and the spatial stop", () => {
    const html = app("/duties/school-run");
    expect(html).toContain("Minutes");
    expect(html).toContain("75");
    expect(html).toContain('href="/people/ana"');
    expect(html).toContain("runs over an hour");
    expect(html).toContain("Rename it");
    expect(html).toContain(spatialHref("school-run"));
  });

  it("says none yet rather than rendering an empty void", () => {
    const empty = renderToStaticMarkup(
      <PagesApp
        context={{ store: new Store({ schema, mutations: [relabel], invariants: [] }) }}
        initialPath="/duties"
      />,
    );
    expect(empty).toContain("None yet");
  });
});

/*
 * A REPAIR WITH A BLANK IN IT IS AN ASK.
 *
 * Both repair surfaces rendered every repair as a bare button applying the
 * violation's args — so a repair that declared `missing: ["personId"]` threw
 * "Invalid arguments for mutation: personId: expected string, received
 * undefined" into the console and told the person nothing. The actions strip
 * has always turned that repair into an ask; the two faces disagreed.
 */
describe("a repair is one press, or an ask, and never a refusal", () => {
  const handOver = bound.defineMutation("hand-over", {
    title: "Hand it over",
    description: "Give a run to somebody.",
    connects: ["owned-by"],
    input: z.object({ id: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
    apply(ctx, args) {
      ctx.addEdge({ kind: "owned-by", from: args.id, to: args.personId });
    },
  });
  const unowned = bound.defineInvariant("somebody-owns-it", {
    scope: { kind: "duty" },
    repairs: ["hand-over", "relabel"],
    evaluate: ({ graph, subject }): Violation[] =>
      graph.out(subject.id, "owned-by").length > 0
        ? []
        : [
            {
              invariant: "somebody-owns-it",
              subjectId: subject.id,
              label: subject.label,
              message: `${subject.label} has nobody`,
              nodeIds: [subject.id],
              repairs: [
                {
                  mutation: "hand-over",
                  args: { id: subject.id },
                  missing: ["personId"],
                  label: `Hand ${subject.label} over`,
                },
                { mutation: "relabel", args: { id: subject.id, label: "Unowned run" }, label: "Rename it" },
              ],
            },
          ],
  });
  const orphaned = () =>
    new Store({
      schema,
      mutations: [relabel, handOver],
      invariants: [unowned],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "school-run", kind: "duty", label: "School run", minutes: 20 },
        ] as never,
        edges: [],
      },
    });

  const rendered = (path: string) =>
    renderToStaticMarkup(<PagesApp context={{ store: orphaned() }} initialPath={path} />);

  for (const [where, path] of [
    ["the problems page", "/problems"],
    ["a record page", "/duties/school-run"],
  ] as const) {
    it(`marks the incomplete repair as an ask on ${where}`, () => {
      const html = rendered(path);
      expect(html).toContain('data-graview-asks="true"');
      expect(html).toContain("Hand School run over …");
      // And the one that needs nothing stays one press.
      expect(html).toContain(">Rename it</button>");
      expect(html).not.toContain("Rename it …");
    });
  }

  it("asks only for what the violation left blank", () => {
    const store = orphaned();
    const html = renderToStaticMarkup(
      <PagesApp context={{ store }} initialPath="/problems" />,
    );
    // Closed until pressed: the ask is a question, not a form lying open.
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain('data-testid="form-hand-over"');
  });
});

/*
 * THE PICKER ASKS THE QUESTION THE DERIVATION NARROWED.
 *
 * An affordance carries the only honest answers for each node reference it
 * leaves open: a connecting act offers who is NOT already on, a severing act
 * only what is attached, and neither ever offers the record itself. The
 * derived form listed every node of the kind regardless, so the same act
 * asked a narrower question in the strip than on the page — a record's own
 * "owned by" offered the record.
 */
describe("a form asks the question the act left open", () => {
  const hand = bound.defineMutation("hand-to", {
    title: "Hand it to somebody",
    description: "Give a run to somebody.",
    subject: { kinds: ["duty"], arg: "id" },
    connects: ["owned-by"],
    input: z.object({ id: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
    apply(ctx, args) {
      ctx.addEdge({ kind: "owned-by", from: args.id, to: args.personId });
    },
  });
  const twoPeople = () =>
    new Store({
      schema,
      mutations: [hand],
      invariants: [],
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "bo", kind: "person", label: "Bo" },
          { id: "school-run", kind: "duty", label: "School run", minutes: 20 },
        ] as never,
        edges: [{ kind: "owned-by", from: "school-run", to: "ana" }],
      },
    });

  const optionsOf = (html: string, form: string): string[] => {
    const from = html.indexOf(`data-testid="${form}"`);
    const select = html.slice(from, html.indexOf("</select>", from));
    return [...select.matchAll(/value="([^"]+)"/g)].map((match) => match[1]!).filter(Boolean);
  };

  it("offers only who is not already on", () => {
    const store = twoPeople();
    const html = renderToStaticMarkup(
      <PagesApp context={{ store }} initialPath="/duties/school-run" />,
    );
    // The act is open on the page because the record page opens its forms
    // when pressed; render it open by asking for the affordance's own list.
    const facts = recordFacts(store, "school-run")!;
    const offer = facts.actions.affordances.find((one) => one.mutation === "hand-to");
    expect(offer?.open.find((one) => one.name === "personId")?.candidates).toEqual(["bo"]);
    // And the derived record page hands that list to the form it draws.
    expect(html).toContain("Hand it to somebody");
  });

  it("hands the narrowed list to the form rather than every node of the kind", () => {
    const store = twoPeople();
    const facts = recordFacts(store, "school-run")!;
    const offer = facts.actions.affordances.find((one) => one.mutation === "hand-to")!;
    const html = renderToStaticMarkup(
      <DerivedForm store={store} mutation={store.allMutations().find((m) => m.name === "hand-to")!} prefilled={offer.args} open={offer.open} />,
    );
    expect(optionsOf(html, "form-hand-to")).toEqual(["bo"]);
  });

  it("falls back to every node of the kind when there is no act to ask", () => {
    const store = twoPeople();
    const html = renderToStaticMarkup(
      <DerivedForm store={store} mutation={store.allMutations().find((m) => m.name === "hand-to")!} />,
    );
    expect(optionsOf(html, "form-hand-to")).toEqual(["school-run"]);
  });
});

/*
 * A REPAIR IS AN ACT, AND A SEAT MAY NOT BE ABLE TO TAKE IT.
 *
 * A rule names its repairs without knowing who is reading, and both repair
 * surfaces rendered them straight from the violation — going round the
 * permission question the actions strip has always asked through
 * `deriveAffordances`. A narrower seat was handed a live button and met the
 * refusal on submit.
 */
describe("a repair the seat may not take is struck through, not offered", () => {
  const handOver = bound.defineMutation("hand-over", {
    title: "Hand it over",
    description: "Give a run to somebody.",
    connects: ["owned-by"],
    input: z.object({ id: nodeRef(["duty"]), personId: nodeRef(["person"]) }),
    apply(ctx, args) {
      ctx.addEdge({ kind: "owned-by", from: args.id, to: args.personId });
    },
  });
  const unowned = bound.defineInvariant("somebody-owns-it", {
    scope: { kind: "duty" },
    repairs: ["hand-over"],
    evaluate: ({ graph, subject }): Violation[] =>
      graph.out(subject.id, "owned-by").length > 0
        ? []
        : [
            {
              invariant: "somebody-owns-it",
              subjectId: subject.id,
              label: subject.label,
              message: `${subject.label} has nobody`,
              nodeIds: [subject.id],
              repairs: [
                {
                  mutation: "hand-over",
                  args: { id: subject.id, personId: "ana" },
                  label: `Hand ${subject.label} over`,
                },
              ],
            },
          ],
  });
  const guarded = () =>
    new Store({
      schema,
      mutations: [handOver],
      invariants: [unowned],
      policy: {
        roles: ["coordinator", "helper"],
        grants: [
          { roles: ["coordinator"], mutations: "*", describe: "The coordinator keeps the map." },
        ],
      },
      snapshot: {
        nodes: [
          { id: "ana", kind: "person", label: "Ana" },
          { id: "school-run", kind: "duty", label: "School run", minutes: 20 },
        ] as never,
        edges: [],
      },
    });
  const asRole = (roles: readonly string[], path: string) =>
    renderToStaticMarkup(
      <PagesApp
        context={{ store: guarded(), principal: { id: "somebody", kind: "human", roles } }}
        initialPath={path}
      />,
    );

  for (const path of ["/problems", "/duties/school-run"]) {
    it(`withholds it on ${path}`, () => {
      const helper = asRole(["helper"], path);
      expect(helper).toContain("<s>Hand School run over</s>");
      expect(helper).toContain("coordinator can");
      expect(helper).toContain("The coordinator keeps the map.");
      // And the coordinator still gets the button.
      const boss = asRole(["coordinator"], path);
      expect(boss).toContain("data-graview-repair=\"hand-over\"");
      expect(boss).not.toContain("<s>Hand School run over</s>");
    });
  }
});

describe("an act the seat may not take is stated, not offered", () => {
  /*
   * The list page offered every creating act to everyone, and a gardener
   * met "Agree every plot has a caretaker" as a live form that refused on
   * submit. The verdict is the store's own, asked before anything is drawn.
   */
  const adopt = bound.defineMutation("adopt", {
    title: "Adopt a duty",
    description: "Take on a new run.",
    creates: ["duty"],
    input: z.object({ label: z.string().min(1) }),
    apply(ctx, args) {
      ctx.addNode({ id: `duty-${args.label}`, kind: "duty", label: args.label, minutes: 10 } as never);
    },
  });
  const policy = {
    roles: ["coordinator", "helper"],
    grants: [{ roles: ["coordinator"], mutations: "*" as const, describe: "The coordinator keeps the map." }],
  };
  const page = (roles: readonly string[]) =>
    renderToStaticMarkup(
      <PagesApp
        context={{
          store: new Store({ schema, mutations: [adopt], invariants: [], policy }),
          principal: { id: "someone", kind: "human", roles },
        }}
        initialPath="/duties"
      />,
    );

  it("withholds the creating act from a seat without the role, with the reason", () => {
    const html = page(["helper"]);
    expect(html).not.toContain('data-testid="form-adopt"');
    expect(html).toContain('data-testid="withheld"');
    expect(html).toContain("<s>Adopt a duty</s>");
    expect(html).toContain("coordinator can");
    // The empty-list hint does not send a helper to a form they cannot use.
    expect(html).not.toContain("starts below");
  });

  it("offers it to a seat with the role", () => {
    const html = page(["coordinator"]);
    expect(html).toContain('data-testid="form-adopt"');
    expect(html).not.toContain('data-testid="withheld"');
  });
});

describe("an administered module on the pages", () => {
  it("lists its kinds for the seat that keeps it and for nobody else", async () => {
    const { createSchema: make, declareInstallation, defineNode: node, Store: MakeStore } = await import("@graview/core");
    const { z: zed } = await import("zod");
    const thing = node("thing", { fields: zed.object({ label: zed.string() }), plural: "Things" });
    const installation = declareInstallation({ roles: ["keeper", "hand"], admin: "keeper" });
    const kept = make([thing, ...installation.kinds] as never);
    const policy = installation.withPolicy({ roles: ["hand"], grants: [{ roles: ["hand"], mutations: "*", kinds: ["thing"] }] });
    const page = (roles: readonly string[]) =>
      renderToStaticMarkup(
        <PagesApp
          context={{
            store: new MakeStore({ schema: kept as never, mutations: installation.mutations as never, modules: installation.modules, policy }),
            principal: { id: "someone", kind: "human", roles },
          }}
          initialPath="/"
        />,
      );
    expect(page(["keeper"])).toContain("People");
    expect(page(["keeper"])).toContain("Invitations");
    expect(page(["hand"])).not.toContain("People");
    expect(page(["hand"])).not.toContain("Invitations");
    expect(page(["hand"])).toContain("Things");
  });
});

/**
 * WHAT A FIELD READS AS WHEN IT IS NOT A WORD.
 *
 * A piece of ground with a five-corner outline had a field on its record
 * reading "[object Object], [object Object], [object Object]". Nobody wrote
 * that and nobody could read it: the rule that a nested object has no
 * one-line rendering was stated in the code and checked only of objects,
 * not of arrays of them.
 */
describe("a field that is not a word", () => {
  const shaped = defineNode("plot", {
    fields: z.object({
      label: z.string(),
      outline: z.array(z.object({ x: z.number(), y: z.number() })).optional(),
      corners: z.array(z.string()).optional(),
      at: z.object({ x: z.number(), y: z.number() }).optional(),
    }),
    plural: "Plots",
  });
  const node = {
    id: "p1",
    kind: "plot",
    label: "Back Lawn",
    outline: [{ x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 1 }],
    corners: ["north", "south"],
    at: { x: 0.5, y: 0.5 },
  };
  const keys = (definition: typeof shaped) =>
    readableFields(node, definition as never).map((f) => `${f.label}: ${f.value}`);

  it("leaves out a shape rather than printing what an object stringifies to", () => {
    const said = keys(shaped).join(" | ");
    expect(said).not.toContain("[object Object]");
    expect(said).not.toContain("Outline");
    expect(said).not.toContain("At");
  });

  it("still reads a list of words as a list of words", () => {
    expect(keys(shaped).join(" | ")).toContain("Corners: north, south");
  });

  it("says a shape the declaration knows how to say", () => {
    /*
     * Only the app knows the numbers are corners, so only the app can put
     * it in words — and once it has, that is a sentence worth showing.
     */
    const told = defineNode("plot", {
      fields: shaped.fields,
      plural: "Plots",
      display: { format: { outline: (value) => `${(value as unknown[]).length} corners` } },
    });
    expect(keys(told as never).join(" | ")).toContain("Outline: 3 corners");
  });
});
