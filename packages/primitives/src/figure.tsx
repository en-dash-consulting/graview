import { figureSvg, type AnySchema, type Brand, type Schema } from "@graview/core";

import { useMarkup } from "./markup.js";
import { hueFor } from "./default-views.js";

/**
 * A KIND'S FIGURE, drawn wherever the kind is.
 *
 * One component, because the whole claim is that a figure is declared ONCE
 * and every surface draws it: the kind card at altitude, the district's
 * heading, a chip, the relation key, a record page's eyebrow. Anything that
 * drew its own version would be a second place for a kind's picture to be
 * wrong.
 *
 * The ink is `currentColor` in the art and the kind's own hue here, so a
 * figure takes the scheme and the palette without being redrawn — and a
 * kind with no figure falls back to the dot it has always had, which is why
 * nothing about a figure is required and no app has to adopt one.
 */
export function KindFigure<S extends AnySchema>({
  kind,
  schema,
  brand,
  size = 16,
  title,
}: {
  readonly kind: string;
  readonly schema?: S | Schema<never>;
  readonly brand?: Brand;
  readonly size?: number;
  /** A name, where the figure is the only thing saying which kind this is. */
  readonly title?: string;
}) {
  const declared = (schema as { tryDefinition?: (kind: string) => { figure?: string } | undefined } | undefined)
    ?.tryDefinition?.(kind)?.figure;
  // The brand's say comes first: an installation with its own drawing of a
  // person keeps the domain's declaration as the domain's.
  const art = figureSvg(brand?.figures?.[kind] ?? declared);
  const hue = Math.round(hueFor(kind, brand?.accents) * 360);
  /*
   * The same drawing must be the SAME OBJECT or React re-parses it on every
   * render — and a node replaced between two clicks is a double-click that
   * never happens. See `useMarkup`.
   */
  const drawing = useMarkup(art);

  if (!art) {
    return (
      <span
        aria-hidden={title === undefined ? "true" : undefined}
        {...(title === undefined ? {} : { role: "img", "aria-label": title })}
        data-graview-figure={kind}
        data-graview-figure-kind="dot"
        style={{
          display: "inline-block",
          width: Math.round(size * 0.62),
          height: Math.round(size * 0.62),
          borderRadius: "50%",
          flex: "0 0 auto",
          background: `hsl(${hue} 55% 52%)`,
          boxShadow: `0 0 0 3px hsl(${hue} 55% 52% / 0.18)`,
        }}
      />
    );
  }

  return (
    <span
      aria-hidden={title === undefined ? "true" : undefined}
      {...(title === undefined ? {} : { role: "img", "aria-label": title })}
      data-graview-figure={kind}
      data-graview-figure-kind="figure"
      /*
       * The art is trusted because it is DECLARED: it comes from the app's
       * own `defineNode` or its brand, both of which are code this bundle
       * already runs, and `graview check` has read it. A figure arriving
       * from a graph would be a different question with a different answer.
       */
      dangerouslySetInnerHTML={drawing}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: size,
        height: size,
        flex: "0 0 auto",
        color: `hsl(${hue} 55% 52%)`,
        // The drawing fills the box it is given, whatever its own viewBox.
        ["--graview-figure-size" as string]: `${size}px`,
      }}
    />
  );
}

/** Whether a kind has a drawing of its own, for a surface that lays out differently when it does. */
export function hasFigure(
  kind: string,
  schema: { tryDefinition?: (kind: string) => { figure?: string } | undefined } | undefined,
  brand?: Brand,
): boolean {
  return figureSvg(brand?.figures?.[kind] ?? schema?.tryDefinition?.(kind)?.figure) !== undefined;
}
