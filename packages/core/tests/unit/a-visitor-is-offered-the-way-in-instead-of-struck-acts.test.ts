import { describe, expect, it } from "vitest";
import { signInInstead, type Refusal, type SignIn } from "../../src/index.js";

/**
 * A VISITOR IS OFFERED THE WAY IN, NOT A WALL OF STRUCK ACTS (FR-183). The
 * host says what a signed-out reader could gain; where every act withheld
 * from them is one some role could take — one a member would hold, when the
 * host names the roles signing in gives — that one line stands in for them.
 */
const signIn: SignIn = { label: "Sign in to make changes", run: () => {} };
const refused = (wouldNeed: readonly string[]): { readonly refusal: Refusal } => ({ refusal: { mutation: "add-era", message: "Only an editor can.", wouldNeed } });

describe("the way in, instead of the struck acts", () => {
  it("is the host's line when every withheld act is one some role could take", () => {
    expect(signInInstead([refused(["editor"]), refused(["owner", "editor"])], signIn)).toBe(signIn);
  });

  it("is nothing where the host offered no way in: the reader is a member, and FR-16's struck list stands", () => {
    expect(signInInstead([refused(["editor"])], undefined)).toBeNull();
  });

  it("is nothing where one act is one no role can take, since signing in would not give it", () => {
    expect(signInInstead([refused(["editor"]), refused([])], signIn)).toBeNull();
  });

  it("is nothing where nothing is withheld", () => {
    expect(signInInstead([], signIn)).toBeNull();
  });

  it("reads the roles a member is given, where the host names them", () => {
    const member = { ...signIn, roles: ["member"] };
    expect(signInInstead([refused(["member", "owner"])], member)).toBe(member);
    expect(signInInstead([refused(["member"]), refused(["owner"])], member)).toBeNull();
  });
});
