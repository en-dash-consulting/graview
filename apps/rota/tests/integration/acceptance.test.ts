import { checkApp } from "@graview/core";
import { kindFacts, recordFacts } from "@graview/pages";
import { describe, expect, it } from "vitest";
import { rotaApp } from "../../src/domain/app.js";
import { rotaPolicy } from "../../src/domain/policy.js";
import { coverage } from "../../src/ui/views.js";
import { createRotaUiStore, EXAMPLE_TODAY, SEATS } from "../../src/ui/app.js";

/**
 * THE PRODUCT-GRADE EXAMPLE, held to the standard it exists to demonstrate.
 *
 * Things is the one nobody has to be taught and Seedbed is the one that
 * grows; Rota is the one a person would ship, which means the things worth
 * checking are not the domain — two kinds and an edge — but everything the
 * platform does around it: three roles with real differences between them,
 * an installation, rules that name their own repairs, a lens reused
 * unchanged, and a migration that carries a roster stored before a rule
 * existed.
 */

const context = { today: EXAMPLE_TODAY };
const [COORDINATOR, VOLUNTEER, VIEWER] = [SEATS[0].principal, SEATS[1].principal, SEATS[2].principal];
const store = () => createRotaUiStore(EXAMPLE_TODAY);

describe("a roster is enough to show the whole platform", () => {
  it("declares its domain, its installation and its own check", () => {
    expect(rotaApp.schema.kinds).toEqual(["shift", "volunteer", "rule", "user", "invitation"]);
    expect(checkApp(rotaApp).findings).toEqual([]);
    expect(rotaApp.version).toBe(2);
    expect(rotaApp.migrations).toHaveLength(1);
  });

  it("declares a kit the checker has measured", () => {
    // Not that it is pretty — that it can be SEEN. The first two greens
    // this app tried were refused at 2.67:1 and 2.49:1 on the light ground.
    expect(rotaApp.brand?.kit?.connectors?.byEdge?.["covered-by"]?.colour).toBe("#2f7a63");
    expect(checkApp(rotaApp).findings.filter((f) => f.code.startsWith("kit-"))).toEqual([]);
  });
});

describe("the rules fire on the roster it ships with", () => {
  it("finds the shifts nobody has taken, and asks who rather than choosing", () => {
    const violations = store()
      .violations(context)
      .filter((one) => one.invariant === "every-shift-covered");
    expect(violations.length).toBeGreaterThan(0);
    const repair = violations[0]!.repairs.find((one) => one.mutation === "cover")!;
    // A rota that assigned somebody on your behalf is the one thing an
    // organiser would never forgive it for.
    expect(repair.missing).toEqual(["volunteerId"]);
  });

  it("finds somebody down for more than they said they could do", () => {
    const over = store()
      .violations(context)
      .find((one) => one.invariant === "nobody-over-their-limit")!;
    expect(over.message).toContain("Bo Ferreira");
    // Two honest ways out: take one off them, or believe the new number.
    expect(over.repairs.some((one) => one.mutation === "uncover")).toBe(true);
    expect(over.repairs.some((one) => one.mutation === "set-limit")).toBe(true);
  });

  it("resolves through the repair the rule itself named", () => {
    const s = store();
    const before = s.violations(context).length;
    const violation = s.violations(context).find((one) => one.invariant === "every-shift-covered")!;
    const repair = violation.repairs.find((one) => one.mutation === "cover")!;
    s.apply({ name: "cover", args: { ...repair.args, volunteerId: "v-ada" } }, { author: COORDINATOR });
    expect(s.violations(context).length).toBe(before - 1);
  });
});

describe("three roles, and the third is the point", () => {
  it("gives the coordinator the roster and the installation", () => {
    const s = store();
    for (const call of [
      { name: "add-shift", args: { label: "x", on: EXAMPLE_TODAY, place: "The hall", day: "mon", from: 60, until: 120 } },
      { name: "drop-shift", args: { shiftId: "s-mon-open" } },
      { name: "invite", args: { email: "new@rota.test", roles: ["volunteer"] } },
      { name: "cover", args: { shiftId: "s-fri-repair", volunteerId: "v-ada" } },
    ]) {
      expect(s.permits(call, COORDINATOR).ok, call.name).toBe(true);
    }
  });

  it("lets a volunteer work the roster and keep nothing else", () => {
    const s = store();
    expect(s.permits({ name: "cover", args: { shiftId: "s-fri-repair", volunteerId: "v-ada" } }, VOLUNTEER).ok).toBe(true);
    expect(s.permits({ name: "set-limit", args: { volunteerId: "v-ada", limit: 4 } }, VOLUNTEER).ok).toBe(true);
    expect(s.permits({ name: "drop-shift", args: { shiftId: "s-mon-open" } }, VOLUNTEER).ok).toBe(false);
    expect(s.permits({ name: "invite", args: { email: "x@rota.test", roles: ["viewer"] } }, VOLUNTEER).ok).toBe(false);
  });

  it("refuses the viewer everything, and says who could instead", () => {
    const s = store();
    for (const call of [
      { name: "cover", args: { shiftId: "s-fri-repair", volunteerId: "v-ada" } },
      { name: "add-shift", args: { label: "x", on: EXAMPLE_TODAY, place: "The hall", day: "mon", from: 60, until: 120 } },
      { name: "rename", args: { id: "s-mon-open", label: "x" } },
    ]) {
      const verdict = s.permits(call, VIEWER);
      expect(verdict.ok, call.name).toBe(false);
      if (!verdict.ok) {
        expect(verdict.refusal.wouldNeed.length, call.name).toBeGreaterThan(0);
        expect(verdict.refusal.message).toContain("coordinator");
      }
    }
  });

  it("keeps the installation from everyone but the coordinator", () => {
    const s = store();
    expect(s.mayAdminister("installation", COORDINATOR)).toBe(true);
    expect(s.mayAdminister("installation", VOLUNTEER)).toBe(false);
    expect([...s.kindsKeptFrom(VIEWER)].sort()).toEqual(["invitation", "user"]);
  });

  it("makes a person's record their own profile", () => {
    const s = store();
    const edit = (id: string, who: typeof COORDINATOR) =>
      s.permits({ name: "edit-user", args: { id, label: "Another name" } }, who).ok;
    expect(edit("user-ada", VOLUNTEER)).toBe(true);
    expect(edit("user-jo", VOLUNTEER)).toBe(false);
    expect(edit("user-sam", VIEWER)).toBe(true);
  });

  it("narrows the routed face by the seat, from the same derivation", () => {
    const s = store();
    const offered = (who: typeof COORDINATOR) =>
      kindFacts(s, "shift", { principal: who, context }).actions;
    expect(offered(COORDINATOR).affordances.map((a) => a.mutation)).toContain("add-shift");
    expect(offered(VOLUNTEER).affordances.map((a) => a.mutation)).not.toContain("add-shift");
    // Stated rather than hidden: the viewer is told it exists and who could.
    const seen = offered(VIEWER);
    expect(seen.affordances).toEqual([]);
    expect(seen.withheld.map((a) => a.mutation)).toContain("add-shift");
    expect(seen.withheld.every((a) => a.refusal.wouldNeed.length > 0)).toBe(true);
  });

  it("says the same thing on a record", () => {
    const s = store();
    const asViewer = recordFacts(s, "s-fri-repair", { principal: VIEWER, context })!;
    expect(asViewer.actions.affordances).toEqual([]);
    expect(asViewer.actions.withheld.length).toBeGreaterThan(0);
  });
});

describe("a lens written for something else, pointed at a roster", () => {
  it("reads the declared direction of the edge rather than assuming one", () => {
    const s = store();
    const grid = coverage.build(s.graph.allNodes() as never, s.graph.allEdges(), s.schema as never);
    // Shifts are the rows — the things that must be covered — and the edge
    // is declared shift → volunteer, which is the other way round from the
    // lens's first domain.
    expect(grid.rows.length).toBe(s.graph.nodesOfKind("shift" as never).length);
    expect(grid.rows.some((row) => row.covered)).toBe(true);
    expect(grid.rows.some((row) => !row.covered)).toBe(true);
  });
});

describe("the policy the store refuses with is the one declared", () => {
  it("names three roles and grants nothing by starring it", () => {
    expect(rotaPolicy.roles).toEqual(expect.arrayContaining(["coordinator", "volunteer", "viewer"]));
    // An act added tomorrow is refused until somebody decides who may run it.
    expect(rotaPolicy.grants.every((grant) => grant.mutations !== "*")).toBe(true);
  });
});
