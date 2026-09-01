import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * Green, obviously — but a worked green, not a default one. The app is a
 * beginning; the brand should feel like early spring rather than a lawn — and dark enough that the check lets it label a pending action.
 */
const ACCENT = "#2e7d32";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    `Seedbed cannot be derived from ${ACCENT} alone. Needs: ${derived.missing.join(", ")} — ${derived.why}`,
  );
}

export const seedbedBrand: Brand = {
  name: "Seedbed",
  // A sprout: one stem, two first leaves.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<path d="M12 21V10"/><path d="M12 10C12 6 9 4 5 4c0 4 3 6 7 6Z"/>' +
    '<path d="M12 12c0-3 2.5-5 6.5-5 0 4-2.5 5-6.5 5Z"/></svg>',
  typography: {
    body: '"Figtree", ui-sans-serif, system-ui, -apple-system, sans-serif',
    display: '"Fraunces", ui-serif, Georgia, serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  shape: { radius: 12, density: 1 },
  schemes: derived.schemes,
};
