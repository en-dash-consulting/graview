# @graview/skills

Skills that teach an assistant how to build with Graview — and, more usefully,
how to find out whether it worked.

```sh
npx graview skills install .    # into .claude/skills and .agents/skills
npx graview skills list
```

The command line is the `graview` package; this one ships the skills and
the move, and `graview skills` dispatches here.

## Why this framework is worth having skills for

Most skills end in a claim: "you have added a node kind." That is worth very
little, because the assistant writing it is the same one that just decided it
was done.

Graview can answer the question itself. `graview check` reads the declaration
and reports an edge to a kind nobody wrote, an invariant scoped to a kind that
does not exist, a repair naming a mutation nobody registered, a lens role
bound to a missing field, a mutation with no title, a palette pair that fails
WCAG AA, a role that may do nothing. So every skill here **ends in a check and
reports the real verdict** — including when the verdict is bad.

A skill that cannot verify its own outcome says so. That is the rule, and the
skills say which parts of their work the checker cannot see.

## The skills

| Skill | The move it teaches |
|---|---|
| `graview-node-kind` | Add a node kind: fields, edges, plural, roles, and what renders for free |
| `graview-invariant` | Write a rule that names the mutations that would repair it |
| `graview-lens` | Build a lens that binds roles rather than field names, so another domain can reuse it |
| `graview-shipped-lens` | Declare a lens the framework ships as a titled place, with the options it takes and what the checker and `add-lens` refuse |
| `graview-agent-seat` | Wire an agent seat that shares the interface's actions rather than shadowing them |
| `graview-permissions` | Declare who may do what, once, and let the strip and the seat narrow themselves |
| `graview-brand` | Put someone's name on an installation without forking a package |
| `graview-new-app` | Start a product on Graview in its own repository, with the CI that keeps it honest |
| `graview-pages` | The routed face: derived pages, one page in the app's words, a product design over every surface, and the embed |
| `graview-embed` | Put an app on somebody else's page, its theme scoped to one element, and somebody's HTML page inside the app as a framed view |
| `graview-host-page` | Host an app as the page itself: the address bar, a chat's widget, the host's menu and news, when a place has drawn, a view proposed and not kept, and pictures of places |
| `graview-port-app` | Port an existing application onto Graview, deciding what is a node and what is a field |
| `graview-studio` | Open the declaration as a graph, change it with acts, check before applying, migrate, and write it back as the scaffold's files |
| `graview-worker-view` | Write a worker view: one plain script with a manifest the host enforces, its links, its limits, and a headless run |
| `graview-view-forms` | Let a worker view change records: a bound press, a record's text filled to edit, a field that saves as it is typed, and hearing what became of each |
| `graview-view-drawing` | Draw in a worker view: what the host keeps, the app's tokens, the images a view may show — the logo, the app's own images, the pictures on records — and a record's video the host plays, with its full-screen viewer |

The worked examples live in `apps/` in the framework repository. The skills
point at them rather than restating them — a skill that copies an example goes
stale the moment the example changes.
