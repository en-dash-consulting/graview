import type { AnySchema } from "@graview/core";
import { useGraview } from "@graview/react/provider";
import { AppTitle } from "./app-title.js";
import { GRAVIEW_BRAND } from "./theme.js";

/**
 * Whose product this is.
 *
 * The name and the logo come from the declared brand, alongside the palette
 * and the typography, because they are one decision — a brand handing over a
 * hex code has not given you a theme, and one handing over a logo without a
 * color has not either. An app that declares nothing gets the framework's
 * own, which is an ordinary declared brand like any other.
 *
 * The logo is inline SVG using `currentColor` by convention, so one file
 * works in both schemes.
 */
export function Wordmark<S extends AnySchema>() {
  const { brand: declared, homeView, setView, setSelection, setMenuAt } = useGraview<S>();
  const brand = declared ?? GRAVIEW_BRAND;
  return (
    <button
      type="button"
      className="graview-wordmark"
      data-testid="wordmark"
      /*
       * The logo is the way HOME, the way it is on every site. It returns to
       * the view the app opened on — focus, relation, zoom and camera reset,
       * selection cleared. The cards someone deliberately pinned stay
       * pinned: going home is not tidying their desk.
       */
      title={`${brand.name} — back to the start`}
      onClick={() => {
        setView((current) => ({ ...homeView, pins: current.pins }));
        setSelection([]);
        setMenuAt(null);
      }}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 7,
        fontSize: "0.75rem",
        letterSpacing: "0.3em",
        textTransform: "uppercase",
        color: "var(--graview-ink-muted)",
        whiteSpace: "nowrap",
        // A control now, so it is at least a fingertip tall — the letters
        // stay exactly where they were.
        minHeight: 24,
        border: "none",
        background: "none",
        padding: 0,
        boxShadow: "none",
        cursor: "pointer",
      }}
    >
      <AppTitle brand={brand} size={18} />
    </button>
  );
}
