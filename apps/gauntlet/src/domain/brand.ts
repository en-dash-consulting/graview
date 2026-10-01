import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/** One accent, both schemes derived from it, and the contrast measured by `graview check`. */
const ACCENT = "#7a3db8";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(`The programme cannot be derived from ${ACCENT} alone. Needs: ${derived.missing.join(", ")} — ${derived.why}`);
}

export const gauntletBrand: Brand = {
  name: "Programme",
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></svg>',
  typography: {
    body: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    display: 'ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
    mono: 'ui-monospace, SFMono-Regular, Menlo, Consolas, monospace',
  },
  shape: { radius: 8, density: 1 },
  accents: { talk: 270, speaker: 30, session: 200, workshop: 140, room: 90, topic: 320, staff: 0 },
  schemes: derived.schemes,
};
