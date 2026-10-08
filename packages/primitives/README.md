# @graview/primitives

A rich primitive set, six lenses, the workbench and the visual system.

**Primitives** — `Panel`, `Chip`, `Roster`, `Grid`, `Axis`, `Connector`,
`Aggregate`, `Fields`. Enough that a new node kind renders sensibly at all
three fidelities before anyone writes a view for it.

**Lenses** — a timeline, a calendar, a coverage matrix, a board, a plan and a status board.
Each binds ROLES to an app's own fields or kinds, so a lens written for one
domain is reused by another without learning anything about it. All six are
built from the public primitives, which makes them the worked example of the
authoring API rather than privileged insiders. The board draws discs when
every slot's code is three characters or fewer and tokens — a pill sized to
the word, the occupants inside it — when any code is longer; `arrange:
"shelf"` lays a board whose x and y are categories out as headed bands. The
status board (`columns`) draws a choice field's values as columns, in their
declared order, and moves a card — by the keyboard or a drag — only by an act
the seat may run that sets that field: a named step such as "Book" to its own
column, where its condition holds for that card, and otherwise an act told the
value.

A coverage cell over a path selects what it joins — its row, its column and
the records between (`data-graview-joins`) — and draws the crossing's lines to
the row's name and the column's head.

**One rule for what looks pressable.** A capsule is a choice the reader can
make, or a record's state badge, and nothing else is one: in a set of choices
the chosen one wears it and the rest are words to press. The places
(`Places`) are text tabs that scroll, the current one underlined, at every
width. A name is never cut where it is the thing to read: a row wraps before
it cuts its badge or progress, a drive-in's marquee says its showings by
name, and what is cut on purpose carries its whole name as its title and
accessible name.

**Workbench** — the parts of an interface that are not about the domain: what
is selected and what can be done with it, whether the rules hold, what just
happened and how to take it back, how to back out of a view. All derived from
the schema, the invariants and the op log.

**The app, said once** — `AppBar`: one bar over every face (FR-131) — the
brand's mark (`AppMark`, drawn as given, never an SVG that could act) and
the app's name as the page's heading, the switch between the scene and the
pages (`faces`, FR-137), the place you are on as one control that
opens every place (`barPlaces`: the home, the Lists, the Pictures, FR-138;
on the scene `useScenePlaces`: the whole thing and each picture, FR-144),
the places standing on the row where they fit, the rest under "More"
(`placesThatStand`, FR-145),
and three tools of one size: the Find a
face puts in it (`useBarFind`), `Standing` and `Profile`. `AppTitle` draws
the mark, the name and the line under it elsewhere; `useFavicon` is for a
face that owns the page.

**Visual system** — `themeCss(scheme, brand)`. Two schemes that are not
inversions of each other: dark loses luminance, light loses contrast and gains
haze. A brand supplies its own and `graview check` measures it. The sheet is
three parts: `themeBaseCss`, what every face draws on; `viewsCss`, the blocks
a view spec is drawn with, which each face that draws a view draws beside it;
and `sceneCss`, the rules only the scene draws (the districts from altitude,
the plots, the village, the billboards), which an embed's scene face draws
beside it so a page on the pages face carries none of them.

## Design language

Three layers, and a component reads only the middle one:

| Layer | Where | What it holds |
|---|---|---|
| The identity | @graview/core (the design kit, revision 03) | En Dash navy #001769 and turquoise #00E5B9, paper #F7F7F2, ink #18213A, muted #586174; Montserrat at 550, 450 and 600; the shared-plane symbol |
| The semantic tokens | `themeCss` writes them as custom properties | surfaces (`--graview-ground`, `-panel`, `-panel-muted`, `-panel-warning`, `-bar`, `-float`), text (`--graview-ink`, `-ink-muted`, `-ink-faint`), interaction (`--graview-accent`, `-accent-dim`, `-accent-ink`, `-edge`, `-edge-bright`), state (`--graview-warn`, `-good`, `-bad`), type (`--graview-font-body`, `-display`, `-mono`, `--graview-weight-display`, `-body`, `-label`), shape (`--graview-radius`, `-radius-sm`, `-pad`, `-pad-sm`, `-gap`), depth (`--graview-lift-low`, `-lift-high`, `--graview-layer-*`) and the kit (`--graview-kit-*`) |
| The app's overrides | the app's brand | name, logo, page icon, both schemes' tokens, faces and weights, radius and density, a hue per kind, the kit |

The shipped schemes are built on the identity: paper, reading ink and navy in
the light, a deep navy ground with the navy's hue made light in the dark.
Neither paints a wash or a glow; hover firms an edge rather than glowing.
Turquoise is not a token at all: it is the symbol's point, a fill that is
never text (1.5:1 on paper; navy reads on it at 9.7:1), so nothing the
framework draws depends on it. An app that declares its own brand keeps its
own colors, faces and logo, and the framework never puts Graview's mark in it.

How the scene reads against any district's color: a kind's hue is the
brand's (`accents`) or a stable hash, and only the hue: the lighting of a
block's three faces and the plot under it is the scene's, so a block reads
as a block on both grounds. Selection and the keyboard's place are drawn in
the accent, as an outline set off from the block, never as a change of the
block's own hue, so a selected block in a navy-ish district still reads as
selected. A relation is told from another by its pattern, its end cap and its
width as well as its color, and every district, block and relation carries
its name in words, so nothing is said by color alone. Disabled is a dimmed
control that cannot be pressed; empty, loading and refused are said in
sentences.

The words are set in Montserrat when the host has it, and in the reader's
system sans otherwise: the framework names the face and never fetches it.
A host that wants it imports the optional copy once —
`import "@graview/primitives/montserrat.css"`, 32 KB of woff2, weights
400–700, Latin, under the SIL Open Font License (beside it in the package).
`GraviewMark` is the symbol for a host drawing Graview's own identity — a
signature, a hosting service's chrome — inline in the ink it stands in, the
point in `--graview-mark-point` when set, decorative unless given a `title`,
and the optical micro cut under 28 px.
