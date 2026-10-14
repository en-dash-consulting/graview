import "@graview/core/field-sight";
import { describe, expect, it } from "vitest";
import { editableFields } from "../../src/edit.js";
import { coach, parent, world } from "../../../core/tests/support/hidden-phones.js";

/**
 * A FIELD A SEAT MAY NOT SEE IS NOT OFFERED TO EDIT (Roadmap f-field-sight).
 * The store refuses a write of it as an argument the act does not take; the
 * fields a record offers to change in place, read through the seat's view,
 * leave it out, so nothing offers a refusal.
 */
const offered = (seat: typeof parent, id: string) => editableFields(world("555 0101").seenBy(seat), id).map((field) => `${field.mutation}:${field.field}`);

describe("a field a seat may not see", () => {
  it("is not offered to a parent to edit on a player whose phone it may not see", () => {
    expect(offered(parent, "player:ann")).not.toContain("set-phone:phone");
    expect(offered(parent, "player:ann")).toContain("rename-player:name");
  });

  it("is offered where the seat's sight shows it: the parent's own child, and to the coach", () => {
    expect(offered(parent, "player:bea")).toContain("set-phone:phone");
    expect(offered(coach, "player:ann")).toContain("set-phone:phone");
  });
});
