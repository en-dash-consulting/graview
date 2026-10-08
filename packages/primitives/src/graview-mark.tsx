import { graviewSymbol } from "@graview/core";

/**
 * GRAVIEW'S SYMBOL, for a host that draws Graview's own identity — a
 * hosting service's chrome, a docs site, a "made with Graview" signature.
 *
 * Never drawn by the framework inside an app: an app leads with its own
 * name and logo (`Brand.logo`), and a Graview signature, where a host adds
 * one, is small and secondary. Inline and in `currentColor`, so it takes
 * the ink it stands in; the point takes `--graview-mark-point` when the
 * host sets it (the turquoise, on navy or on paper) and is the same ink
 * otherwise — the one-color mark, which is the whole mark. Under 28 px it
 * is the optical micro cut, at and over 28 the regular one.
 *
 * Decorative by default (beside a visible "Graview"); give it `title` when
 * it stands alone. A link around it is named by where it goes.
 */
export function GraviewMark(props: { readonly size?: number; readonly title?: string; readonly className?: string }) {
  const size = props.size ?? 24;
  return (
    <span
      className={props.className ?? "graview-mark"}
      data-testid="graview-mark"
      style={{ display: "inline-flex", lineHeight: 0, flex: "0 0 auto" }}
      // The kit's own outlines, as a string, so the symbol has one source (`graviewSymbol` in @graview/core).
      dangerouslySetInnerHTML={{ __html: graviewSymbol({ size, ...(props.title ? { title: props.title } : {}) }) }}
    />
  );
}
