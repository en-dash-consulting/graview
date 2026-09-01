# The Graview page

`index.html` is the page that explains this thing to a developer. It is a
complete, self-contained document: open it, or drop the folder on any static
host. Nothing in the build reads it.

```sh
open docs/site/index.html
pnpm site           # ten widths, both schemes, axe, keyboard, motion, zoom
```

## Where it also lives

It is published as a Claude artifact:

    https://claude.ai/code/artifact/407d388d-0523-4c33-ba0a-e305c37ad417

That host supplies the doctype, the head and the body itself and rejects a file
that brings its own, so publishing needs the page with its wrapper stripped.
There is one source and a script that strips it, rather than two files drifting
apart:

```sh
node scripts/site-artifact.mjs        # prints the path to write the body to
```

Then publish that file to the artifact above, keeping the same URL.

## What is in here

- `index.html` — the page. Montserrat and Merriweather, En Dash's navy and
  mint, and a live miniature of a Graview scene whose connector captions are
  read out of a schema rather than written for the page.
- `endash-mark.svg` — En Dash's square mark, from
  `endash.us/images/LogoSquareNoWords.svg`, inlined into the page because the
  artifact CSP blocks external images. It is also where the palette comes from:
  navy `#001769`, mint `#00E5B9`.

## What is checked

`scripts/verify-site.mjs` drives ten widths in both schemes and asks axe-core
for violations, then asks the questions axe cannot: does the first tab stop get
you past the navigation, does activating a node in the demo announce itself,
do the connector words exist as text for a screen reader, is reduced motion
honoured, do the meaningful marks survive Windows High Contrast, and does the
page reflow at 320px and at 200% text zoom without scrolling sideways.

A marketing page is exactly the kind of thing that rots unmeasured.
