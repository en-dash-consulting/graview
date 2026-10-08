---
name: graview-brand
description: Put an installation's own name, mark, typeface and palette on a Graview app without forking a package, and let graview check measure the contrast rather than trusting it.
---

# Brand an installation

Every primitive reads a custom property and `themeCss(scheme, brand)` emits
them, so a brand is a DECLARATION rather than a fork. The part worth getting
right is that a custom palette can be wrong in ways nobody notices until
somebody with a bright office files a bug — so the framework measures it.

## Do this

1. **Declare the brand in your domain layer**, so `graview check` reads it:

   ```ts
   import { brandFromAccent, DARK, LIGHT, type Brand } from "@graview/core";

   const derived = brandFromAccent({ accent: "#7a4bd0", base: { dark: DARK, light: LIGHT } });
   if (!derived.ok) {
     throw new Error(`Needs ${derived.missing.join(", ")} — ${derived.why}`);
   }

   export const brand: Brand = {
     name: "Acme Bids",
     // Inline SVG using currentColor: one file works in both schemes.
     logo: '<svg viewBox="0 0 24 24" ... stroke="currentColor">...</svg>',
     typography: { body: '"Inter", ui-sans-serif, system-ui, sans-serif' },
     schemes: derived.schemes,
   };
   ```

2. **Expect the refusal path to be real.** No single color can be accent TEXT
   in both schemes — 4.5:1 on white needs a lightness under about 0.18 and
   4.5:1 on a dark panel needs one over about 0.24, and those do not overlap.
   So `brandFromAccent` keeps the hue and saturation, which are the brand's,
   and moves the lightness the smallest distance that clears AA. When that
   distance is far enough that the color has stopped being theirs, it refuses
   and names what to supply. **Do not catch that and carry on with a guess** —
   shipping a color they did not choose under their own name is worse than
   asking.

3. **Hand it to `themeCss` and to the provider.**
   `sheet.replaceSync(themeCss(scheme, brand))` for the tokens;
   `<GraviewProvider brand={brand}>` so `Wordmark` and anything else that asks
   can read the name and the mark.

4. **Declare it on the app too:** `defineApp({ ..., brand })`.

5. **Color the kinds themselves.** Every surface that colors by kind —
   chips, districts, calendar spans, rosters — reads `brand.accents`, a hue
   in degrees per kind, before falling back to the stable hash:

   ```ts
   accents: { gardener: 28, plot: 42, planting: 122, rule: 210 },
   ```

   `graview check` refuses an accent naming a kind nobody declared (a typo
   would otherwise silently hash) and a value that is not a number.

6. **Dress the lines: the kit.** Everything the scene draws that is not a
   view is declared on `brand.kit` — any part, the rest as shipped:

   ```ts
   kit: {
     connectors: {
       all: { route: "orthogonal" },                       // curve | straight | orthogonal
       byEdge: { "tended-by": { color: "#1d3f8a", pattern: "dashed" }, "grows-in": { visible: false } },
     },
     captions: { visible: true }, grid: { visible: false }, lattice: { size: 46 },
     tags: { visible: true }, emphasis: { dim: 0.34 }, marks: { flag: "⚠" },
   },
   ```

   A route or a pattern is a named strategy, one case in one file
   (`@graview/react` `routes.ts`, `@graview/render` `connectors.ts`), so
   the next one is one more case. `graview check` holds an explicit line
   color to 3:1 against both grounds in both schemes
   (`kit-contrast-below-aa`); a kind kept quiet is still on the inspector.
   An embed's `handle.setBrand({ ...brand, kit })` re-dresses it live.

7. **Say its money.** `currency: "EUR"` and `locale: "de-DE"` on the brand
   (a document's `brand` may carry them alone, without an accent) are what
   a sum is said in wherever a block names none: a figure or a field shown
   as money, and `{net | money}` in a template — "21.000 €". A block's own
   `currency` wins. `graview check` refuses a code or a locale it cannot
   write (`brand-currency`, `brand-locale`). Without one, sums are numbers.

## A document's brand

A document (`graview-document@1`) holds the same brand as data, every key
optional, and an edit for each — `set-brand` (`null` clears a key),
`set-name`, `set-description` (drawn as the line under the name):

```json
"brand": {
  "name": "En Dash", "accent": "#0f6e5c",
  "logo": { "src": "/graview/assets/<sha256>.svg", "alt": "En Dash Consulting" },
  "favicon": "/graview/assets/<sha256>.svg",
  "typography": { "display": "system-serif", "body": "system-sans" },
  "shape": { "radius": 6, "density": 0.9 },
  "accents": { "workshop": 168 }, "scheme": "dark"
}
```

- **A mark** is inline SVG or a path on the app's own host — never another
  origin. It is drawn as given (`currentColor` takes the accent), so an SVG
  with a script, a handler, `foreignObject` or anything it loads is refused
  (`brand-mark`), never rewritten. On Cloud, `add_image` answers the path.
- **A face** is `system-serif`, `system-sans`, `system-mono`, a face every
  system has (Georgia, Menlo), or a web font on `DOCUMENT_FONTS`; one named
  by its address is refused (`brand-font`). The host decides where web
  fonts load from.
- **An accent** must read as given in light: `set-brand` refuses one that
  does not with the pair, its ratio and the shade that would pass — "#e6c200
  text on #f6f4f0 is 1.5:1; 4.5:1 is needed — #836e00 would pass." Send the
  shade it names.
- **The icon** is set only by a face that owns the page; an embed on
  somebody else's page leaves theirs alone unless the host passes
  `favicon: true`.

`describe_place("home")` says the masthead: the name, the line under it,
and the logo by its alt text.

## Styling by conversation

This skill is built to be DRIVEN IN NATURAL LANGUAGE — "warmer", "more
editorial", "our green is #1B4332", "make people amber and money green" —
because the whole look is one serializable declaration:

- **palette** → change `accent` (or supply explicit scheme tokens) and let
  `brandFromAccent` move lightness the minimum distance that clears AA;
- **lines** → `kit.connectors` ("right-angled lines", "hide the grows-in
  lines", "make tended-by dashed and navy") and the ground's `kit.grid`;
- **feel** → `shape.radius` (square = formal) and `shape.density` (tight =
  dense) — one number each;
- **voice** → `typography.body/display/mono` with real fallback stacks
  (unset, each is the framework's: `SHAPE` and `TYPOGRAPHY` in
  `@graview/core`; a page outside the app dressed to match reads
  `shapeOf(brand)`, `typographyOf(brand)` and `isoShade(scheme)`, never
  copied numbers);
- **kind colors** → `accents` hues per kind;
- **per-kind layout** → register a view over the registry cell, the same
  authoring move as everything else (see graview-node-kind).

The loop for each request: edit ONLY the declaration file, run `pnpm check`
(the framework measures contrast rather than trusting either of you), then
`pnpm survey` and show the before/after screenshots from `docs/survey/`
side by side. Never edit a component to achieve a look a token can carry —
if a look genuinely needs one, that is a missing token to raise, not a fork
to make.

## What a capsule means

One rule across the faces: a capsule (a pill) is a choice the reader can
make — a range, a setting, a seat, where the one chosen wears it —
or a record's state badge. Nothing else is one. A record is a card (a chip
has a card's corners), a field is its label and its value, the places are
text tabs on the app bar with the current one underlined, a district's name is
text on its plot, a drive-in says its showings by name, and the scene's
"Down to …", zoom and the seat's suggestions are quiet. A badge whose
context already says it is not drawn: no card wears its own board column's
status, no row its group's heading. Names wrap before they are cut, and a
badge or a progress label never truncates. Do not brand your way back to a
row of capsules: a host styling the old markup finds `nav[data-testid=
"places"]` holding `button.graview-place-tab` (no "More" select), and a
kind's mark is its plot in miniature, not a dot.

## Worked example

- `apps/todo/src/domain/brand.ts` — "Things" from one accent, one mark and one
  typeface, with the refusal path left live

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

`theme-contrast-below-aa` names the exact token pair as colors, the scheme,
its ratio and where it is drawn — "a field name", "text on a filled accent" —
and the shade of that ink that would pass, because "your theme has a contrast
problem" is not something anyone can act on.
`theme-token-unreadable` reports a value the checker could not parse rather
than passing it silently, which is the failure mode a contrast check exists to
prevent.

**And look at it, in both schemes.** The checker measures contrast and nothing
else. Run the app with `?theme=light` and `?theme=dark`, and run axe against
both — the framework's harnesses do this and report zero violations, which is
the bar a branded installation should also clear.

## What the check cannot see

- Whether it looks like the brand. Contrast is measurable; taste is not.
- Whether the logo reads at 18 pixels. Most do not.
- Whether the typeface is loaded. A declared face with no `@font-face` and no
  web font silently falls back, and the fallback is usually fine — which is why
  nobody notices for months.
- Anything about a value it cannot parse. It says so; believe it.
