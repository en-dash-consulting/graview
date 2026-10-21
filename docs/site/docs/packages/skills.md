# @graview/skills

`@graview/skills` is one of the 14 npm packages of Graview, a TypeScript framework that derives an app’s interface, permissions and agent tools from one declaration. Skills that teach an assistant the authoring moves, each ending in a real graview check verdict.

```sh
pnpm add @graview/skills
```

Entry points: `@graview/skills`, `@graview/skills/cli`

## What it is

Skills that teach an assistant how to build with Graview — and, more usefully, how to find out whether it worked.

```sh
npx graview skills install .    # into .claude/skills and .agents/skills
npx graview skills list
```

The command line is the `graview` package; this one ships the skills and the move, and `graview skills` dispatches here.

### Why this framework is worth having skills for

Most skills end in a claim: "you have added a node kind." That is worth very little, because the assistant writing it is the same one that just decided it was done.

Graview can answer the question itself. `graview check` reads the declaration and reports an edge to a kind nobody wrote, an invariant scoped to a kind that does not exist, a repair naming a mutation nobody registered, a lens role bound to a missing field, a mutation with no title, a palette pair that fails WCAG AA, a role that may do nothing. So every skill here **ends in a check and reports the real verdict** — including when the verdict is bad.

A skill that cannot verify its own outcome says so. That is the rule, and the skills say which parts of their work the checker cannot see.

### The skills

| Skill | The move it teaches |
| --- | --- |
| `graview-node-kind` | Add a node kind: fields, edges, plural, roles, verbs, and what renders for free |
| `graview-view-specs` | Say a kind's card, row and page as data, and the values worked out from others that they show |
| `graview-lists` | Keep lists usable as an app grows: filters, order and groups, cards at a glance, several at once, a static page, a date that repeats |
| `graview-tidying` | Set records aside instead of deleting them, merge a duplicate, and let the app's own actor tidy by suggestion |
| `graview-invariant` | Write a rule that names the mutations that would repair it |
| `graview-lens` | Build a lens that binds roles rather than field names, so another domain can reuse it |
| `graview-shipped-lens` | Declare a lens the framework ships as a titled place, with the options it takes and what the checker and `add-lens` refuse |
| `graview-agent-seat` | Wire an agent seat that shares the interface's actions rather than shadowing them |
| `graview-permissions` | Declare who may do what, once, and let the strip and the seat narrow themselves |
| `graview-brand` | Put someone's name on an installation without forking a package |
| `graview-locale` | Say money, days and times the way the app's people do: a currency, a locale and a time zone, once |
| `graview-logo` | Put a client's logo and page icon on an app: one for each scheme, an inverted fallback only when asked, an emoji icon |
| `graview-new-app` | Start a product on Graview in its own repository, with the CI that keeps it honest |
| `graview-ship` | Deploy: persistence, op-log-native migrations, export, health, serving and a host that compiles once |
| `graview-sync` | Keep an app in step with another system: a snapshot projected from it, a sync back, an MCP remote, a Google calendar |
| `graview-pages` | The routed face: derived pages, one page in the app's words, and the embed |
| `graview-pages-design` | A product design over every surface of the routed face: its own shell, with Find and the way back in its own bar at its own height |
| `graview-embed` | Put an app on somebody else's page, its theme scoped to one element, and somebody's HTML page inside the app as a framed view |
| `graview-host-page` | Host an app as the page itself: the address bar, a chat's widget, the host's menu and news, when a place has drawn, a view proposed and not kept, and pictures of places |
| `graview-port-app` | Port an existing application onto Graview, deciding what is a node and what is a field |
| `graview-studio` | Open the declaration as a graph, change it with acts, check before applying, migrate, and write it back as the scaffold's files |
| `graview-worker-view` | Write a worker view: one plain script with a manifest the host enforces, its links, its limits, and a headless run |
| `graview-view-forms` | Let a worker view change records: a bound press, a record's text filled to edit, a field that saves as it is typed, and hearing what became of each |
| `graview-view-drawing` | Draw in a worker view: what the host keeps, the app's tokens, the images a view may show — the logo, the app's own images, the pictures on records — and a record's video the host plays, with its full-screen viewer |

The worked examples live in `apps/` in the framework repository. The skills point at them rather than restating them — a skill that copies an example goes stale the moment the example changes.

## What it exports (6)

Read off the package's own barrel, so this is what is there today.

`readSkills`, `SKILL_DESTINATIONS`, `SKILLS_BEGIN`, `SKILLS_DIR`, `SKILLS_END`, `withSkillsListed`

---

Skills that teach an assistant the authoring moves, each ending in a real graview check verdict.

The page: https://graview.dev/docs/packages/skills.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
