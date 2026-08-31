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
     name: "the bid-desk example",
     // Inline SVG using currentColor: one file works in both schemes.
     logo: '<svg viewBox="0 0 24 24" ... stroke="currentColor">...</svg>',
     typography: { body: '"Inter", ui-sans-serif, system-ui, sans-serif' },
     schemes: derived.schemes,
   };
   ```

2. **Expect the refusal path to be real.** No single colour can be accent TEXT
   in both schemes — 4.5:1 on white needs a lightness under about 0.18 and
   4.5:1 on a dark panel needs one over about 0.24, and those do not overlap.
   So `brandFromAccent` keeps the hue and saturation, which are the brand's,
   and moves the lightness the smallest distance that clears AA. When that
   distance is far enough that the colour has stopped being theirs, it refuses
   and names what to supply. **Do not catch that and carry on with a guess** —
   shipping a colour they did not choose under their own name is worse than
   asking.

3. **Hand it to `themeCss` and to the provider.**
   `sheet.replaceSync(themeCss(scheme, brand))` for the tokens;
   `<GraviewProvider brand={brand}>` so `Wordmark` and anything else that asks
   can read the name and the mark.

4. **Declare it on the app too:** `defineApp({ ..., brand })`.

## Worked example

- `the bid-desk example/src/domain/brand.ts` — the bid desk shipping as "the bid-desk example"
  from one accent, one mark and one typeface, with the refusal path left live

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

`theme-contrast-below-aa` names the exact token pair, the scheme and where it
is drawn — "a field name", "text on a filled accent" — because "your theme has
a contrast problem" is not something anyone can act on.
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
