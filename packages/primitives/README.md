# @graview/primitives

A rich primitive set, five lenses, the workbench and the visual system.

**Primitives** — `Panel`, `Chip`, `Roster`, `Grid`, `Axis`, `Connector`,
`Aggregate`, `Fields`. Enough that a new node kind renders sensibly at all
three fidelities before anyone writes a view for it.

**Lenses** — a timeline, a calendar, a coverage matrix, a board and a plan.
Each binds ROLES to an app's own fields or kinds, so a lens written for one
domain is reused by another without learning anything about it. All five are
built from the public primitives, which makes them the worked example of the
authoring API rather than privileged insiders. The board draws discs when
every slot's code is three characters or fewer and tokens — a pill sized to
the word, the occupants inside it — when any code is longer; `arrange:
"shelf"` lays a board whose x and y are categories out as headed bands.

**Workbench** — the parts of an interface that are not about the domain: what
is selected and what can be done with it, whether the rules hold, what just
happened and how to take it back, how to back out of a view. All derived from
the schema, the invariants and the op log.

**Visual system** — `themeCss(scheme, brand)`. Two schemes that are not
inversions of each other: dark loses luminance, light loses contrast and gains
haze. A brand supplies its own and `graview check` measures it.
