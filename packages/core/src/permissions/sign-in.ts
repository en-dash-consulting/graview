import type { Refusal } from "./types.js";

/**
 * WHAT A SIGNED-OUT READER COULD GAIN (FR-183), in the host's words: the
 * line said, "Sign in to make changes", and what pressing it does. A host
 * hands one only while the reader is a visitor — so the app does not offer
 * a visitor "Notify me" either, there being nobody to tell.
 *
 * A visitor on a public app may do nothing, and every act struck through
 * with the policy's sentence told them so seven times without saying how to
 * get the right. Where every act withheld from them is one a member could
 * take, the menu, the Inspector and a list's foot say this one line instead.
 */
export interface SignIn {
  readonly label: string;
  readonly run: () => void;
  /**
   * The roles signing in gives, when the host knows them: then an act
   * stands in for the line only where one of these could take it. Unsaid,
   * any act some role could take is one a member could.
   */
  readonly roles?: readonly string[];
}

/**
 * The way in, said in place of the acts withheld — or null, and the struck
 * list stands (FR-16): where the host offered none (a member lacking one
 * role is told who could), where nothing is withheld, or where one act is
 * one signing in would not give.
 */
export function signInInstead(withheld: readonly { readonly refusal: Refusal }[], signIn: SignIn | undefined): SignIn | null {
  if (!signIn || withheld.length === 0) return null;
  const gains = signIn.roles;
  const member = (refusal: Refusal) => (gains ? refusal.wouldNeed.some((role) => gains.includes(role)) : refusal.wouldNeed.length > 0);
  return withheld.every(({ refusal }) => member(refusal)) ? signIn : null;
}
