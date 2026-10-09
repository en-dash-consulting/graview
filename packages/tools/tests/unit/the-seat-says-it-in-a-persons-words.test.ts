import { bindSchema, createSchema, defineNode, isoDate, nodeRef, Store, type AppPlace } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { resolveAsk } from "../../src/go.js";
import { graphResponder } from "../../src/index.js";

/**
 * THE SEAT SAYS IT IN A PERSON'S WORDS, across apps, not only the one it
 * was written against. Walked over rota, seedbed and Cloud's workshop, it
 * said "Went to the shifts date this week. 9 shifts are date this week",
 * told about "Email to Todd" counted the picture of that name instead of
 * saying what the email is, described a task as "(finished: no, due
 * 2026-09-01)", and answered "rename it to …" with "needs label" — the
 * argument's identifier.
 */
const shift = defineNode("shift", {
  fields: z.object({ label: z.string(), date: isoDate.optional(), finished: z.boolean().default(false) }),
  plural: "Shifts",
});
const schema = createSchema([shift]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-shift", {
  title: "Rename",
  subject: { kinds: ["shift"], arg: "id" },
  writes: ["label"],
  input: z.object({ id: nodeRef(["shift"]), label: z.string().min(1) }),
  apply: (ctx, args) => ctx.patchNode(args.id, { label: args.label }),
});
const store = () =>
  new Store({
    schema,
    mutations: [rename],
    invariants: [],
    snapshot: {
      nodes: [
        { id: "s1", kind: "shift", label: "Friday repair cafe", date: "2026-09-18", finished: false },
        { id: "s2", kind: "shift", label: "Monday open up", date: "2026-09-14", finished: true },
        { id: "s3", kind: "shift", label: "Sunday deep clean", date: "2026-09-27", finished: false },
      ] as never,
      edges: [],
    },
  });
const places: AppPlace[] = [
  { slug: "home", title: "Home", kind: null, cardinality: "many", address: "/", stop: "#" },
  { slug: "shifts", title: "Shifts", kind: "shift", cardinality: "many", address: "/shifts", stop: "#focus=aggregate:shift" },
  // A picture named after the record it draws, as Cloud's workshop names one.
  { slug: "friday-repair-cafe", title: "Friday repair cafe", kind: "shift", cardinality: "many", address: "/places/friday-repair-cafe", stop: "#view=friday-repair-cafe" },
];
const TODAY = "2026-09-14";

describe("the seat, in a person's words", () => {
  it("says a date field that only means 'when' as the date words alone", () => {
    const answer = resolveAsk(store(), "shifts this week", { places, today: TODAY });
    expect("say" in answer && answer.say).toMatch(/^Went to the shifts this week\. 2 shifts are this week: /);
    expect("say" in answer && answer.say).not.toMatch(/date this week/);
  });

  it("told about a thing a picture is named after, tells about the thing", () => {
    const answer = resolveAsk(store(), "tell me about Friday repair cafe", { places, today: TODAY });
    expect(answer).toMatchObject({ about: "describe", subject: "s1" });
  });

  it("says a day as a person says one, and a one-word yes or no as the state it is", async () => {
    const reply = await graphResponder<typeof schema>()(store(), "tell me about Friday repair cafe", { today: TODAY } as never);
    expect(reply.say).toContain("date 18 Sep 2026");
    expect(reply.say).toContain("not finished");
    expect(reply.say).not.toMatch(/\d{4}-\d{2}-\d{2}|finished: no/);
  });

  it("takes what follows 'to' as the words an act asks for, and names what is missing in the act's words", async () => {
    const renamed = await graphResponder<typeof schema>()(store(), "rename Friday repair cafe to Friday fixing club", {} as never);
    expect(renamed.proposals).toEqual([{ mutation: "rename-shift", args: { id: "s1", label: "Friday fixing club" }, why: expect.any(String) }]);
    const bare = await graphResponder<typeof schema>()(store(), "rename Friday repair cafe", {} as never);
    expect(bare.say).not.toContain("label");
    expect(bare.say).toMatch(/needs a name/i);
  });
});
