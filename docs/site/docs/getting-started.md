# Getting started

Starting a product on Graview takes one command, `npm create graview`, which writes a running app for your own domain. Everything on this page below the command is read out of the generator that writes it, so it is what you will actually get.

```sh
npm create graview@latest my-app
```

Or `pnpm create graview my-app`, or `npx graview create my-app`. Node 22 or later.

## What it asks

The directory is the only thing it needs; the rest has a default it says out loud. Give it the product's name and the first kind of thing your domain has — `--kind shift`, `--kind work-order` — and it writes chapter one for that domain rather than for a placeholder.

```text
graview create <dir> [--name "Field Notes"] [--kind note] [--plural notes]

      --name <text>      the product's name (default: from <dir>)
      --kind <slug>      the first node kind (default: item)
      --plural <slug>    its plural (default: <kind>s)
      --link <path>      consume the framework from a sibling checkout by
                         path rather than from a registry
      --pm pnpm|npm      the package manager (default: whichever ran this)
      --port <n>         the dev server port (default: 5170)
      --accent <#hex>    the brand accent (default: a worked green)
      --no-install       write the files and stop
      --no-skills        do not install the authoring skills
      --no-git           do not initialize a git repository
      --workspace        the layout every real product ends up with: a
                         workspace root with the app under app/ and the
                         harness scripts at the root
      --merge            write only the files that do not exist yet, and
                         name every collision without touching it
      --force            write into a directory that is not empty
      --template <file|url>
                         start from a template made anywhere (Graview
                         Cloud's graview-template shape): the project keeps
                         its document as src/domain/app.json and the
                         template as template.json, for `graview apply
                         --template` to set a store up from. Named after
                         the template unless --name says otherwise.

```

## What it writes (20 files)

The declaration split into domain and UI, so the domain has no React in it and `graview check` can read it headless. `src/domain/` is the whole surface you will work in; the shell in `src/ui/` is eighty lines made of framework parts, and every one of them can be replaced.

`package.json`, `tsconfig.json`, `tsconfig.build.json`, `vite.config.ts`, `index.html`, `embed.html`, `.gitignore`, `README.md`, `src/domain/schema.ts`, `src/domain/mutations.ts`, `src/domain/invariants.ts`, `src/domain/brand.ts`, `src/domain/app.ts`, `src/ui/views.tsx`, `src/ui/app.tsx`, `src/ui/pages.tsx`, `src/main.tsx`, `src/embed.tsx`, `tests/domain.test.ts`, `.github/workflows/ci.yml`

Dependencies: `@graview/core`, `@graview/layout`, `@graview/tools`, `@graview/render`, `@graview/react`, `@graview/primitives`, `@graview/pages`, `@graview/ship`, `@graview/embed`, `@graview/studio`, `@graview/guest`, `react`, `react-dom`, `react-router-dom`. Dev: `graview`, `@types/node`, `@types/react`, `@types/react-dom`, `typescript`, `vite`, `vitest`. No zod of your own — `@graview/core` re-exports `z`, so a kind's fields are built with exactly the copy the framework was built with.

## The scripts it gives you

| Script | Runs |
| --- | --- |
| `npm run dev` | `vite` |
| `npm run typecheck` | `tsc -p tsconfig.json` |
| `npm run test` | `vitest run` |
| `npm run build:domain` | `tsc -p tsconfig.build.json` |
| `npm run build` | `npm run build:domain && vite build` |
| `npm run check` | `npm run build:domain && graview check ./dist/domain/app.js` |
| `npm run docs` | `npm run build:domain && graview docs ./dist/domain/app.js --out docs` |
| `npm run serve` | `npm run build:domain && graview serve ./dist/domain/app.js --data data` |
| `npm run mcp` | `npm run build:domain && graview mcp ./dist/domain/app.js --data data` |
| `npm run skills` | `graview skills install .` |
| `npm run verify` | `npm run typecheck && npm run test && npm run build && npm run check` |

**Start with `verify`** — typecheck, tests, build and `graview check`, in that order — and then `dev`: the scene at the root, the routed face at `/pages`.

## The loop from there

Open a session beside the declaration. The skills are already installed where Claude Code and Codex look for them, and the first one to read is [`graview-node-kind`](https://graview.dev/docs/skills/graview-node-kind.html). Describe a kind; let the model draft its fields, its edges, its acts and its rule; run `graview check`; look at the picture; declare more. The checker tells you both when a shape is wrong, in words, before a page does.

- [graview-new-app](https://graview.dev/docs/skills/graview-new-app.html): The shape of the declaration, the shell that comes for free, and the CI that keeps it honest.
- [graview-node-kind](https://graview.dev/docs/skills/graview-node-kind.html): Add a kind — fields, edges, label, plural, roles — and verify it with graview check.
- [graview-invariant](https://graview.dev/docs/skills/graview-invariant.html): A rule that names the acts that would repair it, then make it fire.
- [graview-pages](https://graview.dev/docs/skills/graview-pages.html): The routed face, from the derived pages to a design of your own.
- [graview-ship](https://graview.dev/docs/skills/graview-ship.html): Persistence, migrations, export and health, self-hosted or behind a service.

## Working on the framework itself

A product can consume a checkout of the framework by path instead of a registry, the way the first-party examples do: build the framework, then `pnpm graview create ../my-app --link .`. The project resolves every `@graview/*` import into the checkout's `dist/`, and its dev server rebuilds when the framework does.

```sh
git clone https://github.com/en-dash-consulting/graview && cd graview
pnpm install && pnpm build  # every package
pnpm graview create ../my-app --link . --name "My App" --kind thing
pnpm dev:seedbed  # the garden — ?chapter=N opens any chapter
```

---

From nothing to a running product on Graview, and the loop from there: declare, check, look, declare more.

The page: https://graview.dev/docs/getting-started.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
