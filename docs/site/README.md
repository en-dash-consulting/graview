# The Graview site

Three things, one stylesheet, and a rule: **nothing on any of these pages is
written twice.**

| | | |
|---|---|---|
| `index.html` | the landing page | what the kit does and who it is for, one picture per claim, the product live where it fits |
| `progression.html` | the long version | sixteen live chapters, the packages, the lenses, the kit |
| `docs/` | the reference | 36 pages, all written out of the repository: getting started, concepts, packages, the CLI, working with a model, skills, the findings, live demos |

Published at [graview.dev](https://graview.dev) by `.github/workflows/pages.yml`
on every push to `main` that touches this directory. `CNAME`, `.nojekyll`,
`robots.txt`, `sitemap.xml` (written by `site-docs.mjs`), `404.html` and
`og.png` are the deployment's own files.

```sh
open docs/site/index.html
pnpm site:build:all   # stylesheet, numbers, docs — after changing any of them
pnpm site             # every page: ten widths, both schemes, axe, keyboard, motion, zoom
```

## Why it is split

It used to be one document doing both jobs and therefore neither. It opened
with a headline and a code block — a getting-started page — and then ran to
fifteen chapters and nine reference sections, which is documentation. A
person deciding whether to use this had to read a tutorial; a person already
using it had nothing to look anything up in.

The landing page is a marketing page, and answers one question — *what is
this and why would I* — in plain words with one picture per claim: the
example garden live in the hero; how it works in three moves; one feature
per section (the routed face, rules that repair, lenses, the seat, the
studio, actions and permissions), each a live frame of the example opened at
the stop that shows the claim — no photographs remain; the stepper;
four use cases from the products built on it; the two ways in — the
framework, or Graview Cloud, the hosted product built on it, under the same
symbol and claiming only what graview.cloud itself says; and one install line. No code
on it but that line. The first cut was a docs page with a headline; the
second showed the product but argued like documentation.

## What is generated, and what that buys

| Written by | What |
|---|---|
| `scripts/site-css.mjs` | the stylesheet, inlined into every page — the artifact host blocks a `<link>`, so it cannot live in one |
| `scripts/site-numbers.mjs` | every number on the landing page, counted out of the tree |
| `scripts/site-docs.mjs` | all 36 docs pages: a page per package, per skill, plus getting started (from what the scaffolder writes), the CLI (from its help), working with a model, the findings, live demos and the concepts — and the sitemap |
| `scripts/site-progression.mjs` | the chapter records in `progression.html` |

`tests/site.test.ts` runs each of them with `--check` and fails when a page
has gone stale. That is the whole point: a page that says "three lenses" six
months after the fourth one shipped is a page the team quietly stops
defending, and there is no amount of care that prevents it — only a test.

A package's page is its own `README.md` and `package.json`. A skill's page is
its `SKILL.md`. The CLI's page is the help `graview --help` prints, so the
docs and the terminal say the same words because they are the same words.
The findings page is every `code:` in `check.ts`.

## Where the landing page also lives

It is published as a Claude artifact:

    https://claude.ai/code/artifact/407d388d-0523-4c33-ba0a-e305c37ad417

That host supplies the doctype, the head and the body and rejects a file that
brings its own, so publishing needs the page with its wrapper stripped. One
source, one script:

```sh
node scripts/site-artifact.mjs        # prints the path to write the body to
```

This is also why the stylesheet is inlined rather than linked, and why the
mark is an inline SVG: that host blocks every external stylesheet and image.

## What is checked

`scripts/verify-site.mjs` drives ten widths in both schemes across the
landing page, the long version and a sample of the docs, asks axe-core for
violations, and then asks the questions axe cannot: does the first tab stop
get you past the navigation, does the stepper actually mount a different
application at a different step, do arrow keys move between the steps, are
the connector words there as text for a screen reader, is reduced motion
honored, do the meaningful marks survive Windows High Contrast, and does
every page reflow at 320px and at 200% text zoom without scrolling sideways.

A marketing page is exactly the kind of thing that rots unmeasured.
