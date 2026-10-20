# This site is a Graview app

graview.dev is a Graview app: one declaration, [`apps/site/app.json`](https://github.com/en-dash-consulting/graview/blob/main/apps/site/app.json), and 396 records written out of the repository by `node scripts/site-docs.mjs`. Every page the site serves is one of those records, rendered as static HTML by `renderPlace` from `@graview/pages/static` in the site's own design, so a search engine and a model read plain pages, and none of them can say what the records do not.

## The site, running

This is that declaration, compiled in your browser by the same compiler `graview check` uses, over the same records the pages are rendered from: the city of its packages, skills, check findings and pages. Press a district; come down to a record; switch to its pages.

*graview.dev as a Graview app, live: a live demo, on the HTML page.*

## What it declares

**graview.dev**: Graview's own site and docs as a Graview app: every page graview.dev serves is a record, written out of the repository by scripts/site-docs.mjs and rendered by renderPlace, beside the packages, skills, checks and recipes it is about. 13 kinds, each read out of the tree:

| Kind | What it is | Records |
| --- | --- | --- |
| `page` | An address graview.dev serves: a web page, the Markdown twin beside it, or a file for crawlers and models. | 65 |
| `package` | An npm package Graview ships, read off its package.json, its README.md and its barrel. | 14 |
| `entry` | One subpath a package exports, as a product imports it. | 92 |
| `skill` | An authoring skill an assistant reads before it changes a Graview app, read off its SKILL.md. | 26 |
| `check` | A thing graview check can say, read out of the checker's source. | 107 |
| `command` | A graview subcommand, read off the help the CLI prints. | 13 |
| `concept` | One of the ideas a Graview declaration is made of: not in the repository, the reason it is shaped the way it is. | 7 |
| `recipe` | The prompt on the front page with a different task, and the declaration and seed an agent made of it, under docs/site/recipes/. | 3 |
| `chapter` | A step of the garden, grown: a declaration that passes its own check, opened in a browser on every push. | 16 |
| `example` | An example app in the repository, described by its own package.json. | 5 |
| `question` | A question the front page answers plainly, read off its FAQ. | 7 |
| `release` | A version every package shares, as the releases page says it: when npm published it, what came in it in a few plain lines, and what a host must know before upgrading. Written by hand with the Version packages pull request (apps/site/releases.json). | 40 |
| `scaffold` | What graview create writes, read from the generator itself. | 1 |

## How a page is made

`scripts/site-docs.mjs` reads the repository — each package's `package.json`, `README.md` and barrel, each skill's `SKILL.md`, the checker's source, the CLI's help, the recipes, the chapters — and writes a record for each, then a page record for every address graview.dev serves, related to what it is about. Each page record is rendered by `renderPlace` with the site's design, `apps/site/design.mjs`: a docs page in the docs shell, the front page, the tour and the long version filled into their hand-designed pages (`apps/site/pages/`), and `llms.txt`, `llms-full.txt`, the sitemap and `start.md` as records too. `tests/site.test.ts` holds every served address to a record, and the declaration to `graview check`.

```sh
npx graview check --document apps/site/app.json
node scripts/site-docs.mjs --check
```

---

graview.dev is itself a Graview app: one declaration and the records written out of the repository, every page rendered from a record by renderPlace, and the whole of it live on this page.

The page: https://graview.dev/docs/site.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
