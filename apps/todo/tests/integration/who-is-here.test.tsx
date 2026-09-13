import { kindFacts, recordFacts } from "@graview/pages";
import { describe, expect, it } from "vitest";
import { todoApp } from "../../src/domain/app.js";
import { todoPolicy } from "../../src/domain/policy.js";
import { EXAMPLE_TODAY, SEATS, createTodoUiStore } from "../../src/ui/app.js";

/**
 * THE INSTALLATION, IN THE APP PEOPLE OPEN FIRST.
 *
 * Who may use this list, who has been asked to, and what each of them may do
 * are nodes and acts like everything else — so what has to be checked is not
 * a screen but the policy: what each seat is offered, what it is refused and
 * in whose words, and which kinds exist for it at all.
 */

const KEEPER = SEATS[0].principal;
const MEMBER = SEATS[1].principal;
const context = { today: EXAMPLE_TODAY };

const store = () => createTodoUiStore(EXAMPLE_TODAY);

describe("who is here, and what each of them may do", () => {
  it("declares two roles, a keeper who administers and a member who does not", () => {
    expect(todoPolicy.roles).toEqual(expect.arrayContaining(["keeper", "member"]));
    expect(todoApp.modules?.["installation"]?.visibility).toBe("admin");
    const s = store();
    expect(s.mayAdminister("installation", KEEPER)).toBe(true);
    expect(s.mayAdminister("installation", MEMBER)).toBe(false);
  });

  it("seeds both people and one pending invitation", () => {
    const s = store();
    expect(s.graph.nodesOfKind("user" as never).map((node) => (node as { id: string }).id)).toEqual([
      "user-nora",
      "user-sam",
    ]);
    const asked = s.graph.nodesOfKind("invitation" as never) as unknown as { status: string }[];
    expect(asked.map((one) => one.status)).toEqual(["pending"]);
  });

  it("keeps the installation's kinds from the member entirely, rather than refusing them", () => {
    const s = store();
    expect([...s.kindsKeptFrom(MEMBER)].sort()).toEqual(["invitation", "user"]);
    expect([...s.kindsKeptFrom(KEEPER)]).toEqual([]);
  });

  it("lets the keeper invite, welcome, withdraw, grant, revoke and remove — and refuses the member each, in the policy's own words", () => {
    const s = store();
    const acts: readonly [string, Record<string, unknown>][] = [
      ["invite", { email: "kit@things.test", roles: ["member"] }],
      ["welcome", { invitationId: "inv-jo", label: "Jo" }],
      ["revoke-invitation", { invitationId: "inv-jo" }],
      ["grant", { userId: "user-sam", role: "keeper" }],
      ["revoke", { userId: "user-sam", role: "member" }],
      ["remove-user", { userId: "user-sam" }],
    ];
    for (const [name, args] of acts) {
      expect(s.permits({ name, args }, KEEPER).ok).toBe(true);
      const refused = s.permits({ name, args }, MEMBER);
      expect(refused.ok).toBe(false);
      // Not a shrug: the sentence names the role that could.
      if (!refused.ok) {
        expect(refused.refusal.wouldNeed).toEqual(["keeper"]);
        expect(refused.refusal.message).toContain("keeper");
      }
    }
  });

  it("leaves the list itself to everybody, because a policy that stops the work teaches the wrong lesson", () => {
    const s = store();
    for (const who of [KEEPER, MEMBER]) {
      expect(s.permits({ name: "finish", args: { taskId: "t-deposit" } }, who).ok).toBe(true);
      expect(s.permits({ name: "add-task", args: { listId: "today", label: "A thing" } }, who).ok).toBe(true);
    }
  });

  it("makes a person's record their own profile: theirs to edit, read-only to another member", () => {
    const s = store();
    // The derived edit names its subject `id`, as every derived edit does.
    const edit = (id: string, who: typeof KEEPER) =>
      s.permits({ name: "edit-user", args: { id, label: "Another name" } }, who).ok;
    // Yours is yours, by the self grant and nothing else: Sam holds no role
    // that reaches a user at all.
    expect(edit("user-sam", MEMBER)).toBe(true);
    expect(edit("user-nora", MEMBER)).toBe(false);
    expect(edit("user-nora", KEEPER)).toBe(true);
    /*
     * And the keeper reaches Sam's too — not by a grant naming `edit-user`,
     * but because `permits` reads a derived edit through the declared acts
     * it rides, and the keeper may `welcome` a person into existence and
     * `grant` them roles. Whoever may make a thing may change what was set
     * when it was made; asserting the opposite here would be asserting
     * against the framework rather than against this app.
     */
    expect(edit("user-sam", KEEPER)).toBe(true);
    const refused = s.permits({ name: "edit-user", args: { id: "user-nora", label: "X" } }, MEMBER);
    if (!refused.ok) expect(refused.refusal.message).toContain("own name and address");
  });

  it("offers the acts on the pages the same way, from the same derivation", () => {
    const s = store();
    const offered = (who: typeof KEEPER) =>
      kindFacts(s, "invitation", { principal: who, context }).actions.affordances.map((a) => a.mutation);
    expect(offered(KEEPER)).toContain("invite");
    expect(offered(MEMBER)).not.toContain("invite");

    // And a person's record: the keeper's own is editable, the member's is not.
    const nora = recordFacts(s, "user-nora", { principal: KEEPER, context })!;
    expect(nora.actions.affordances.map((a) => a.mutation)).toContain("edit-user");
    const norasProfileToSam = recordFacts(s, "user-nora", { principal: MEMBER, context })!;
    expect(norasProfileToSam.actions.affordances.map((a) => a.mutation)).not.toContain("edit-user");
    // Stated rather than hidden: Sam is told the act exists and why it is not theirs.
    expect(norasProfileToSam.actions.withheld.map((a) => a.mutation)).toContain("edit-user");
  });

  it("welcomes an invitation into a person, as the keeper, and says so in the log", () => {
    const s = store();
    s.apply({ name: "welcome", args: { invitationId: "inv-jo", label: "Jo" } }, { author: KEEPER });
    const people = s.graph.nodesOfKind("user" as never) as unknown as { label: string }[];
    expect(people.map((one) => one.label)).toContain("Jo");
    const last = s.log.all().at(-1)!;
    expect(last.intent).toContain("Welcome Jo");
    expect(last.author.id).toBe("user-nora");
  });
});
