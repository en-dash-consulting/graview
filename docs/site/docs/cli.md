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

## graview serve

```text
graview serve <entry> [--data <dir>] [--port <n>] [--seed <file>] [--sqlite <file>]

    --trust-seat-headers says the network in front of it can be trusted.

```

[--host <address>] [--trust-seat-headers] Serves the app's store over HTTP, and live over a WebSocket at /graview/live. The op log is the wire: a client sends calls, the store judges them under the caller's own seat, and the ops come back, pushed to every socket as they land. Data lives in <dir> (default ./data) as readable JSON, or in a SQLite file with --sqlite. It listens on 127.0.0.1 and believes the seat a request names in its headers, because only this machine can reach it; on any other --host it will not start unless

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

---

graview create, check, docs, describe, lens, figure, serve and skills — what each reads and what each says.

The page: https://graview.dev/docs/cli.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
