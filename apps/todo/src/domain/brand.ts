import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * Quiet, so the list is the loud thing.
 *
 * A todo app is used for thirty seconds at a time by somebody deciding what to
 * do next, and anything decorative is in the way. One confident indigo, no
 * second colour, and the framework's own neutrals — which is also the point of
 * showing it here: a brand can be a single line, and the framework does the
 * rest and refuses what it cannot do.
 */
const ACCENT = "#4f46e5";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    `Things cannot be derived from ${ACCENT} alone. Needs: ${derived.missing.join(", ")} — ${derived.why}`,
  );
}

export const thingsBrand: Brand = {
  name: "Things",
  // A tick. One stroke, which is the whole product.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M4.5 12.5 9.5 17.5 19.5 6.5"/></svg>',
  /*
   * A checklist wants to be plain and quick. Figtree is a rounded grotesque
   * that stays legible at twelve pixels, which is most of what this app is.
   */
  typography: {
    body: '"Figtree", ui-sans-serif, system-ui, -apple-system, sans-serif',
    display: '"Figtree", ui-sans-serif, system-ui, sans-serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  // Soft and roomy. Nothing here is formal.
  shape: { radius: 14, density: 1 },
  schemes: derived.schemes,
};
