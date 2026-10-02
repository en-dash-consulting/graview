import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createSchema, defineNode, nameOfAuthor } from "../../src/index.js";

/**
 * AN AUTHOR IS NEVER AN ID. The activity rail headed the showroom's
 * upgrade to version 2 "ship:migration" — the store's own author id —
 * because nothing names it (the seventh walk).
 */
const schema = createSchema([defineNode("car", { fields: z.object({ label: z.string() }), plural: "Cars" })]);
const where = { graph: { getNode: () => undefined }, schema };

describe("an author nothing names", () => {
  it("is said by what it is", () => {
    expect(nameOfAuthor({ kind: "system", id: "ship:migration" }, where)).toBe("the upgrade");
    expect(nameOfAuthor({ kind: "system", id: "sync:calendar" }, where)).toBe("the system");
    expect(nameOfAuthor({ kind: "agent", id: "agent_scheduler" }, where)).toBe("an agent");
  });

  it("keeps a plain name a host gave without seats", () => {
    expect(nameOfAuthor({ kind: "human", id: "kai" }, where)).toBe("kai");
  });
});
