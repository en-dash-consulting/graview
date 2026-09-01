import {
  bindSchema,
  createSchema,
  defineNode,
  labelOf,
  readableFields,
  Store,
  violationsTouching,
  type Violation,
} from "@graview/core";
import { deriveAffordances } from "@graview/tools";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { PagesApp, kindOfSlug, pluralSlug, recordFacts, recordPath, spatialHref } from "../../src/index.js";

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
  edges: { "owned-by": { to: ["person"], description: "who owns it" } },
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
    expect(html).toContain("1 problem");
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
