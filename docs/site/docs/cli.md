# The CLI

`graview` is Graview's command line: it starts a product, checks its declaration, writes its agent docs and serves its store. Every subcommand lives in the package whose concern it is: the generator and the checker in `@graview/core`, `serve` in `@graview/ship`, `skills` in `@graview/skills`. None of them needs a browser.

```sh
npm install -g graview
```

Or not at all: a project made by `graview create` has it as a devDependency, so `npx graview check` works from inside one, and `npx graview create` works from nowhere.

## graview check

```text
graview check <entry> [--views <module>] [--json]

--document <file>
    Any command that takes an <entry> takes a declaration document instead
    (a .json file in the Graview document format): compiled, never run as
    code, and checked with the JSON path of every finding. With
    --previous <file>, check holds every renamedFrom to the version before.
    A template (a graview-template .json) is read as the document inside it.

```

Loads <entry> (a module whose default export, or `app` export, is a GraviewApp) and reports schema problems. Exits 1 on any error.

## graview create

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

Starts a product on Graview in <dir>: the declaration split into domain and UI, an eighty-line shell, a headless test, a CI workflow.

## graview describe

```text
graview describe <entry> [--as <role>] [--views <module>] [--place <slug|id>]

    --place <slug|id> [--seed <snapshot.json>] [--width <px>] [--id <who>] says what one
    place shows that seat instead: headings, figures, lists and problems.

```

Reads the app out: what a blank installation meets and in what order, what is drawn and what falls back, the hues, what a seat may do, how a model is reached, what is judged. The rung between check and a browser — "run it and look" for something that cannot see.

## graview docs

```text
graview docs <entry> [--out <dir>] [--views <module>]
```

Writes llms.txt and agents.md next to the entry, or into <dir>.

## graview doctor

```text
graview doctor [<dir>] [--document <file>] [--json]
```

Says whether the product in <dir> (default .) is on one Graview release: every graview and @graview/* pin in its package.json the same version, its lockfile and its node_modules holding that version, each declaration document's formatVersion one the installed core reads, and react beside react-dom at one version (React refuses a mismatched pair at startup, and the page is blank). Run from a framework checkout with no graview on PATH, it says how to put it there. Each problem is said with its fix; exits 1 on any.

## graview figure

```text
graview figure <entry> --kind <kind> [--name <shipped>]
```

[--from "<what the thing is>"] [--judge <file|->] Prints the figure line to paste into defineNode. With --name it is one of the shipped drawings; with neither, it suggests the nearest one by name and says so. --from prints the brief to hand a model — the rules, the angle and a shipped figure as the style — and --judge reads the answer back, holds it to the rules graview check holds a figure to, and prints the line. Nine shipped figures is a vocabulary to start from, not a vocabulary to finish in.

## graview lens

```text
graview lens <name> --roles a,b,c [--binds fields|entities] [--dir <dir>]
```

Writes a lens that compiles: the role check that fails loudly, the createXLens factory, three fidelities, pick targets — and beside it a REUSE TEST in a domain the app is not about, red until you make the claim true. If you cannot make it pass, you wrote a view, and a view is a legitimate thing to have written.

## graview preview

```text
graview preview <document.json | app module> [--seed <file>] [--port <n>] [--host <address>]
```

[--data <dir> | --sqlite <file>] [--as <id>] [--roles a,b] [--no-sync] [--view <view.js> --manifest <manifest.json>] Serves the store and Graview's own faces over it — the scene and Pages, with the bar — so a document and a snapshot can be looked at with no product. Nothing to build or install: the page ships with graview. An app declared in code is taken as graview check takes it (./dist/domain/app.js), its module bundled for the page with the project's esbuild. The store is in memory unless --data or --sqlite name where to keep it; the page sits as a person holding every role the app declares, unless --as or --roles say who. Its connections run as serve's do, unless --no-sync. --view and --manifest draw a worker view proposed and not kept where it attaches, marked as a draft. Each of the app's forms for visitors is at /forms/<name>, drawn alone and answered as a visitor minted for that page.

## graview serve

```text
graview serve <entry> [--data <dir>] [--port <n>] [--seed <file>] [--sqlite <file>]

    --no-sync leaves them off. What people looked for and could not do
    (a search that found nothing, an act refused) is kept for 90 days in
    friction.json beside the data, each person reading only their own and
    the counts, never a visitor's; --no-friction keeps none.

```

[--host <address>] [--trust-seat-headers] [--allow-origin <origin>] [--no-sync] [--no-friction] Serves the app's store over HTTP, and live over a WebSocket at /graview/live. The op log is the wire: a client sends calls, the store judges them under the caller's own seat, and the ops come back, pushed to every socket as they land. Data lives in <dir> (default ./data) as readable JSON, or in a SQLite file with --sqlite. It listens on 127.0.0.1 and believes the seat a request names in its headers, because only this machine can reach it — from a program, or from a page on its own origin; a page on another origin is refused unless --allow-origin names it (say it once per origin, as http://localhost:5195), and no header names the system's seat. On any other --host it will not start unless --trust-seat-headers says the network in front of it can be trusted, and then it believes every seat header, the system's too. The app's declared connections (a Google calendar, a Notion database) run beside it, with credentials from the environment and their cursors beside the data;

## graview shots

```text
graview shots <document.json | app module> [--seed <file>] [--places a,b] [--out <dir>]
```

[--scheme light|dark|both] [--width <px>[,<px>]] [--faces pages,scene] [--view <view.js> --manifest <manifest.json>] Photographs places headless to PNGs, <place>-<scheme>-<width>.png in <dir> (default ./shots): each place by its address word or title (the home, overview, a lens's name, a kind's plural) or a path such as /tasks/t1; every place when none is named. Needs Playwright, which you install beside the project (npm i -D playwright, then npx playwright install chromium). --view and --manifest picture a proposed view before it is kept: name its place by its title, as a kept view's.

## graview skills

```text
graview skills install [dir]   copy the skills into ${SKILL_DESTINATIONS.join(" and ")}
graview skills list            what is in this package
graview skills path            where the skill files live
```

Copies the authoring skills into `.claude/skills` and `.agents/skills`, where Claude Code and Codex look for them; `list` says what ships and `path` says where the files live. `graview create` runs the install for you.

## graview sync

```text
graview sync-seed <entry> --seed <file> [--data <dir> | --sqlite <file>]
```

[--apply] [--prune] [--json] Diffs the bootstrap seed against the live store and says, as content steps, what would bring the store in step with it: records put, fields patched, ties made. Prints and exits by default; --apply lands the steps as one logged, undoable operation; --prune also drops what the seed no longer has. The seed itself is only ever read at first install — this is how default content moves afterwards, in place of deleting the store.

## graview types

```text
graview types <document.json> [--out <file.d.ts>]
```

Writes the document's kinds, fields and relations as TypeScript: each kind's record with its fields' own types (an enum's options as a union), and the Types that typedReader (@graview/core/typed) reads a store through — so a renamed field or relation fails tsc in the product that reads it. To stdout, or to --out.

---

graview create, check, types, docs, describe, lens, figure, serve and skills — what each reads and what each says.

The page: https://graview.dev/docs/cli.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
