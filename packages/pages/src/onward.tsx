import type { CSSProperties, ReactNode } from "react";

/*
 * A LINK THAT LEADS ON ("All threats as a list →"): the words underlined
 * and the mark not, a space between them. An underline on a flex box
 * reaches every child, so the arrow wore it too and sat against the last
 * word ("a list→"); the link is undecorated (`onward` in page-typography),
 * the words carry the hairline, and the box's gap is the space. A module of
 * its own, so the page context's scene link draws it without the rest of
 * the typography.
 */
const underlined: CSSProperties = {
  textDecorationLine: "underline",
  textDecorationColor: "color-mix(in srgb, currentColor 50%, transparent)",
  textDecorationThickness: 1,
  textUnderlineOffset: "0.2em",
};

/** The words of an onward link, then its mark (→, ›, ↗), which a reader does not hear. */
export function Onward({ children, mark = "→" }: { readonly children: ReactNode; readonly mark?: string }) {
  return (
    <>
      <span style={underlined}>{children}</span>
      <span aria-hidden="true">{mark}</span>
    </>
  );
}
