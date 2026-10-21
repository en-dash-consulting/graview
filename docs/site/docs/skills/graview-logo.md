# graview-logo

`graview-logo` is one of Graview's 28 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Put a client's own logo and page icon on a Graview app — inline SVG or a path, one for each scheme so a picture on white is not a white slab in the dark, an emoji as the icon — drawn in the default shell and handed to a design's own, and let graview check refuse a mark that could act rather than trusting it.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## A logo, and an icon

The brand's mark is drawn as it was given, never redrawn, on every face: the app bar, a design's shell, the static page, a worker view. The palette and the type are `graview-brand`; this is the picture beside the name.

### Do this

1. **One mark when it can be one.** Inline SVG with `currentColor` takes the accent and works in both schemes from one file:

```ts logo: '<svg viewBox="0 0 24 24" ... stroke="currentColor">...</svg>', ```

1. **One for each scheme when it cannot.** A client's real logo — a JPG or PNG on white — sits as a white slab on a dark ground. Give the dark scheme its own:

```ts logo: { light: "/graview/assets/<sha>.jpg", dark: "/graview/assets/<sha>.png" }, ```

The light one is drawn in the light scheme, and in the dark too where there is no dark one. In a document the same object takes `alt`: `"logo": { "light": "…", "dark": "…", "alt": "TrueNorth Recon" }` (`{ "src", "alt" }` and a plain string still mean one logo).

1. **Inverting is asked for, never guessed.** Whether a light logo is a picture opaque on white cannot be known from it, so with no dark one nothing happens in the dark unless the brand says `darkFallback: "invert"`: then, in the dark scheme alone, it is drawn `invert(1) hue-rotate(180deg)` and screened onto the ground. Beside a `dark` one it is never used, and `graview check` says so (`brand-logo`).

1. **A design's shell draws it with `<AppMark brand={context.brand} />`** (`@graview/primitives`), as the default shell's bar does. Both marks are in the page, each `data-graview-scheme-only="light"` or `"dark"`, and the theme's sheet for the scheme the page is in hides the other's — so it switches with the scheme however the page chose it, with no hook. A design that draws its own `<img>` reads `logoFor(brand, scheme)` (`@graview/core`): `{ src, invert }`. Never a CSS filter of the design's own over the brand's logo.

1. **On Graview Cloud**, upload each with `add_image`, then `{"op": "set-brand", "logo": {"light": "/graview/assets/<sha>.jpg", "dark": "/graview/assets/<sha>.png"}}`. `set-brand` says what changed: "The logo gets one of its own for the dark scheme." `null` clears it.

### What a mark may be

- **Inline SVG or a path on the app's own host** in a document — never another origin. It is read element by element as the browser reads it: shapes, groups, gradients, filters, text and links to its own `#id`s, every attribute quoted, nothing after `</svg>`. A script, a handler, `<a>`, `<style>`, an animation, `foreignObject` or anything it loads is refused (`brand-mark`, at `brand.logo.light` or `brand.logo.dark`, with the reason), never rewritten. A declared app's mark may live at any address an image is drawn from; one that could act is refused the same.
- **The icon** (`favicon`) is a mark too, set only by a face that owns the page; an embed on somebody else's page leaves theirs alone unless the host passes `favicon: true`. `"favicon": { "emoji": "🏡" }` — exactly one standard emoji (👩🏽‍🌾 and 🇺🇸 count as one) — is the icon and, with no logo, the mark; anything else is refused (`brand-emoji`).

`describe_place("home")` says the app as the home draws it (its `masthead`): the name, the line under it, and the logo by its alt text.

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

`brand-mark` and `brand-logo` say which mark, where and why. Then **look at it in both schemes** — `?theme=light` and `?theme=dark` — on the bar and in the design's own shell: the dark one in the dark, or the light one inverted only where the brand asked.

### What the check cannot see

- Whether the logo reads at 18 pixels. Most do not.
- Whether an inverted logo still looks like the client's: its hues stay, its lightness flips, so a navy mark comes out pale blue. If that matters, give a dark one.
- Whether the dark one is the client's at all. Ask for it.

---

Put a client's own logo and page icon on a Graview app — inline SVG or a path, one for each scheme so a picture on white is not a white slab in the dark, an emoji as the icon — drawn in the default shell and handed to a design's own, and let graview check refuse a mark that could act rather than trusting it.

The page: https://graview.dev/docs/skills/graview-logo.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
