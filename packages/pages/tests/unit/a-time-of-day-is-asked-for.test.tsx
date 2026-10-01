import { bindSchema, createSchema, defineNode, Store, z } from "@graview/core";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { DerivedForm } from "../../src/index.js";

/**
 * A TIME OF DAY IS ASKED FOR on the routed face. "Add a workshop" takes a
 * start at `YYYY-MM-DDTHH:MM`; its form offered a date picker, and what a
 * date picker gives the act refused, so the form could never be sent.
 */
const dateTime = z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/);
const workshop = defineNode("workshop", { fields: z.object({ label: z.string(), startsAt: dateTime }), plural: "Workshops" });
const schema = createSchema([workshop]);
const { defineMutation } = bindSchema(schema);
const add = defineMutation("add-workshop", {
  title: "Add a workshop",
  creates: ["workshop"],
  input: z.object({ label: z.string().min(1), startsAt: dateTime }),
  apply: (ctx, args) => void ctx.addNode({ id: ctx.freshId(args.label, "workshop"), kind: "workshop", label: args.label, startsAt: args.startsAt }),
});

describe("a start with a time of day, on the routed face", () => {
  it("is asked for with a date and a time", () => {
    const store = new Store({ schema, mutations: [add] });
    const html = renderToStaticMarkup(<DerivedForm store={store} mutation={add} />);
    expect(html).toMatch(/<input[^>]*type="datetime-local"[^>]*name="startsAt"/);
  });
});
