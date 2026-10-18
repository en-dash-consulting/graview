import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, Store } from "../../src/index.js";
import { search } from "../../src/search.js";

/**
 * A PAST RECORD NAMED OUTRANKS A CURRENT ONE THAT ONLY MENTIONS IT (the
 * eleventh walk).
 *
 * An animal shelter has 62 animals in its care, 3,000 gone home, and 1,400
 * adopters whose phone numbers end in four digits. "Find anything" for
 * "1539" — the number in "Moose #1539" — found the adopter whose phone ends
 * 1539, and since a current record answered, the horizon held and Moose,
 * adopted in 2022, was not offered at all. A current record that carries the
 * words only in a field does not answer the way a record named by them does:
 * where no current record is named by the words and a past one is, the past
 * ones named are offered too, said as past, ranked by how they matched.
 */
const animal = defineNode("animal", {
  fields: z.object({ label: z.string(), status: z.enum(["in-care", "adopted"]) }),
  lifecycle: { field: "status", retired: ["adopted"] },
});
const adopter = defineNode("adopter", {
  fields: z.object({ label: z.string(), phone: z.string().optional() }),
});
const schema = createSchema([animal, adopter]);
const shelter = () =>
  new Store({
    schema,
    snapshot: {
      nodes: [
        { id: "biscuit", kind: "animal", label: "Biscuit #3001", status: "in-care" },
        { id: "moose", kind: "animal", label: "Moose #1539", status: "adopted" },
        { id: "ana", kind: "adopter", label: "Ana Smith", phone: "+1 555 1539" },
      ] as never,
      edges: [],
    },
  });
const records = (found: ReturnType<typeof search>) => found.hits.filter((hit) => hit.about === "node").map((hit) => hit.id);

describe("Find, a name behind the horizon and a field in front of it", () => {
  it("offers the past record the words name ahead of a current one that carries them in a field", () => {
    const found = search(shelter(), "1539");
    expect(records(found)).toEqual(["moose", "ana"]);
    expect(found.hits.find((hit) => hit.about === "node" && hit.id === "moose")).toMatchObject({ current: false });
    expect(found.searched.past).toBe(true);
  });

  it("keeps to the current where a current record is named by the words", () => {
    const found = search(shelter(), "biscuit");
    expect(records(found)).toEqual(["biscuit"]);
    expect(found.searched.past).toBe(false);
  });
});
