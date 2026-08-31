import type { AnySchema } from "@graview/core";
import { useGraview } from "@graview/react";
import { GRAVIEW_BRAND } from "./theme.js";

/**
 * Whose product this is.
 *
 * The name and the logo come from the declared brand, alongside the palette
 * and the typography, because they are one decision — a brand handing over a
 * hex code has not given you a theme, and one handing over a logo without a
 * colour has not either. An app that declares nothing gets the framework's
 * own, which is an ordinary declared brand like any other.
 *
 * The logo is inline SVG using `currentColor` by convention, so one file
 * works in both schemes.
 */
export function Wordmark<S extends AnySchema>() {
  const brand = useGraview<S>().brand ?? GRAVIEW_BRAND;
  return (
    <span
      className="graview-wordmark"
      data-testid="wordmark"
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: 11,
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: "var(--graview-ink-muted)",
        whiteSpace: "nowrap",
      }}
    >
      {brand.logo ? (
        <span
          aria-hidden="true"
          style={{ display: "inline-flex", color: "var(--graview-accent)" }}
          // The logo is the brand's own markup. It is declared by the
          // installation, not supplied by a user, which is the difference
          // between this and rendering arbitrary HTML.
          dangerouslySetInnerHTML={{ __html: brand.logo }}
        />
      ) : null}
      {brand.name}
    </span>
  );
}
