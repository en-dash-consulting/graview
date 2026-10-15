# The Graview site

**graview.dev is a Graview app**, and this directory is what it renders to.
Its declaration is [`apps/site/app.json`](../../apps/site/app.json): pages,
packages and their entry points, skills, check findings, commands, concepts,
recipes, chapters, questions, releases and what `graview create` writes, with
the relations between them. `scripts/site-docs.mjs` writes the records out of
the repository, a page record for every address the site serves, and renders
each one with `renderPlace` (`@graview/pages/static`) in the site's own
design, [`apps/site/design.mjs`](../../apps/site/design.mjs). The rule that
follows: **nothing on any of these pages is written twice, and nothing here
is edited by hand** — edit the source and run `pnpm site:build:all`.

| | | |
|---|---|---|
| `index.html` | the landing page | one prompt to hand an agent, the recipes under it with the app each made running beside it, the three moves, Cloud, the questions — hand designed in `apps/site/pages/index.html`, its recipe tabs and rows and its structured data filled from records |
| `tour.html` | the tour | the feature-by-feature argument that used to follow the hero: one live frame per claim, the stepper, the use cases — hand designed in `apps/site/pages/tour.html` |
| `start.md` | for the agent | the procedure the prompt points at: scaffold, read, declare, check, preview, report back, written in `apps/site/pages/start.md`; `tests/recipes.test.ts` holds its commands to the CLI's |
| `recipes/` | the recipes | each one's `app.json` and `seed.json` as an agent wrote them in Larkspur (`scripts/fixtures/recipes/larkspur.mjs`), checked by `pnpm check` and `tests/recipes.test.ts`, opened in a browser by `scripts/progression.mjs` |
| `progression.html` | the long version | sixteen live chapters, the packages, the lenses, the kit — hand designed in `apps/site/pages/progression.html` |
| `docs/` | the reference | every page a record — getting started, concepts, packages, the CLI, working with a model, skills, the findings, live demos, stability, and `site.html`, the site itself opened live as the app it is — each with a Markdown twin beside it |

Published at [graview.dev](https://graview.dev) by `.github/workflows/pages.yml`
on every push to `main`. `CNAME`, `.nojekyll`, `og.png` and the stylesheet are
the deployment's own files; `robots.txt`, `sitemap.xml`, `llms.txt`,
`llms-full.txt` and `404.html` are records like every page.

```sh
open docs/site/index.html
pnpm site:build:all   # stylesheet, numbers, poster, records and pages — after changing any of them
npx graview check --document apps/site/app.json
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
| `scripts/site-css.mjs` | the stylesheet, inlined into every hand-designed page (and so every docs page, whose head is the landing page's) — the artifact host blocks a `<link>`, so it cannot live in one |
| `scripts/site-numbers.mjs` | every number on the landing page, counted out of the tree |
| `scripts/site-docs.mjs` | the site's records — a package per package (its `package.json`, `README.md` and barrel), its entry points, a skill per `SKILL.md`, a finding per code in the checker, a command per `graview --help` section, the recipes, the chapters, the FAQ, the releases, what the scaffolder writes, and a page per address — and every address rendered from its page record by `renderPlace`: a page per package, per skill, per recipe, getting started, the CLI, working with a model, the findings, live demos, the concepts, stability (`docs/stability.md`) and this site; a Markdown twin of each; `llms.txt`, `llms-full.txt`, `robots.txt`, `start.md`, the sitemap with each page's last change; and the hand-designed pages with their recipe tabs and rows and their structured data filled in |
| `scripts/site-poster.mjs` | the hero's first frame: the chapter it mounts, drawn by `sceneThumbnail` in both lightings, so the frame is a picture before the bundle arrives |
| `scripts/site-progression.mjs` | the chapter articles in `apps/site/pages/progression.html`, which the chapter records are read off |

`tests/site.test.ts` runs each of them with `--check` and fails when a page
has gone stale, checks the declaration with `graview check`, and holds every
address the site serves to the page record it is rendered from; `tests/site-for-machines.test.ts` holds what a crawler, an
answer engine and a model read: every page's title, description, canonical
and card, unique; the structured data parsing and matching the page; every
docs page in the sitemap and in `llms.txt`; no broken link; no script,
stylesheet or picture in the markup from another site (the analytics tag,
added by script on graview.dev only, is the one thing that is); every count the tree's; and the license named as what it is, the Elastic
License 2.0, with "source-available" the only category word for it.

That is the whole point: a page that says "three lenses" six
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
