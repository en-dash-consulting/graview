import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

/**
 * A ROSTER PINNED TO A WALL.
 *
 * Things is quiet because a checklist wants to be; Rota is the opposite
 * problem — a rota is read across a room, argued over by a committee, and
 * printed out by somebody who will write on it. So: a display face with
 * some weight to it, tighter shapes than Things, and a KIT that makes the
 * one relation this app has say what it is.
 *
 * The first accent was a burnt orange, and `brandFromAccent` refused it in
 * both schemes: "the warning colour shares the accent's hue, so 'something
 * is broken' looks like 'this is selected'". On a roster whose whole job is
 * to make an uncovered shift obvious, that is the worst possible collision
 * — and it is exactly the kind nobody catches by eye at noon. A deep sage
 * is as far from the warning as it is from the paper.
 */
const ACCENT = "#2f6f5e";

const derived = brandFromAccent({ accent: ACCENT, base: { dark: DARK, light: LIGHT } });

if (!derived.ok) {
  throw new Error(
    `Rota cannot be derived from ${ACCENT} alone. Needs: ${derived.missing.join(", ")} — ${derived.why}`,
  );
}

export const rotaBrand: Brand = {
  name: "Rota",
  // A grid of four, one of them filled: a roster with one shift covered.
  logo:
    '<svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true" fill="none" ' +
    'stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">' +
    '<rect x="3" y="3" width="7.5" height="7.5" rx="1.5"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="1.5"/>' +
    '<rect x="3" y="13.5" width="7.5" height="7.5" rx="1.5"/>' +
    '<rect x="13.5" y="13.5" width="7.5" height="7.5" rx="1.5" fill="currentColor"/></svg>',
  typography: {
    body: '"Inter", ui-sans-serif, system-ui, -apple-system, sans-serif',
    // A rota has a masthead. Fraunces has the weight for one.
    display: '"Fraunces", ui-serif, Georgia, serif',
    mono: '"JetBrains Mono", ui-monospace, SFMono-Regular, Menlo, monospace',
  },
  // Squarer and denser than Things: this is a grid of slots, not a list.
  shape: { radius: 8, density: 0.94 },
  /*
   * THE KIT: what the scene draws that is not a view.
   *
   * One relation, and it means one thing — somebody is covering something —
   * so it is drawn as a direct line with an arrow, in the brand's own
   * colour, rather than as an anonymous curve. The ground keeps its lattice
   * and loses its grid, because a roster is a thing on a wall and not
   * graph paper. `graview check` measures the declared colour against both
   * grounds in both schemes, so a line nobody can see is a finding rather
   * than a decision somebody made once at noon.
   */
  kit: {
    connectors: {
      all: { route: "straight" },
      byEdge: {
        "covered-by": { colour: "#2f7a63", pattern: "solid", width: 2, cap: "arrow" },
      },
    },
    grid: { visible: false },
    marks: { flag: "!" },
  },
  schemes: derived.schemes,
};
