import { signInInstead, type AnySchema, type Refusal } from "@graview/core";
import { useGraviewIfAny } from "@graview/react/provider";
import type { CSSProperties } from "react";
import type { PageContext } from "./page-context.js";
import { button, quiet } from "./page-typography.js";

/**
 * THE ACTS A SEAT MAY NOT TAKE, said under what it may: each struck through
 * with the policy's sentence (FR-16) — or, for a visitor the host offers a
 * way in, that one line to press (FR-183), where every act withheld is one
 * a member could take. The host's `signIn` on the face, else the
 * provider's around it.
 */
export function WithheldActs<S extends AnySchema>({
  context,
  withheld,
  style,
  testId,
}: {
  readonly context: PageContext<S>;
  readonly withheld: readonly { readonly id: string; readonly label: string; readonly refusal: Refusal }[];
  readonly style?: CSSProperties;
  /** What the struck list answers to, where a page's own tests find it. */
  readonly testId?: string;
}) {
  const around = useGraviewIfAny<S>();
  const gain = signInInstead(withheld, context.signIn ?? around?.signIn);
  if (gain) {
    return (
      <p style={{ ...style, margin: 0 }}>
        <button type="button" data-testid="sign-in" onClick={() => gain.run()} style={button}>
          {gain.label}
        </button>
      </p>
    );
  }
  if (withheld.length === 0) return null;
  return (
    <ul style={{ ...style, margin: 0, padding: 0, listStyle: "none", display: "grid", gap: 4 }} {...(testId ? { "data-testid": testId } : {})}>
      {withheld.map((entry) => (
        <li key={entry.id} style={quiet}>
          <s>{entry.label}</s> — {entry.refusal.message}
        </li>
      ))}
    </ul>
  );
}
