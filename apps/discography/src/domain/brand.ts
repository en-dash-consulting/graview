import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * One accent, and both schemes derived from it. `graview check` measures
 * every text pair against AA rather than trusting the color; if the accent
 * cannot label a pending action legibly, the derivation says which pair
 * failed and why instead of shipping it.
 */
const ACCENT = "#2e7d32";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    `Discography cannot be derived from ${ACCENT} alone. Needs: ${derived.missing.join(", ")} — ${derived.why}`,
  );
}

export const discographyBrand: Brand = {
  name: "Discography",
  // A mark: replace it with your own. Sixteen pixels, currentColor.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 3"/></svg>',
  typography: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  shape: { radius: 10, density: 1 },
  // Color-by-kind, declared rather than hashed: one hue per kind.
  accents: { song: 150, album: 30, artist: 280, theme: 200, era: 330 },
  schemes: derived.schemes,
  kit: {
    connectors: {
      all: { route: "orthogonal" },
      byEdge: { features: { color: "#d0582a", pattern: "dashed" }, about: { visible: false } },
    },
  },
};
