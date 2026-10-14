---
"@graview/studio": patch
---

Two lenses of one name on different kinds are two nodes in the studio. A lens's node id was its name and its title's address word, so a board over tasks and a board over bugs, both titled "Board" (which the checker allows, a title being an address per kind), were one node: the studio drew one, and handed the app back with the second lens wearing the first one's bindings. The id now also names the kinds the lens stands on, its `on` or the kinds its bindings name, as `lens:columns:board@task`, read from the lens alone so the same declaration read twice gives the same ids. A lens that stands on no kind keeps its old id, `lens:<name>` or `lens:<name>:<title>`; one that does is now `…@<kind>[,<kind>]`.

Compatibility: no framework surface changes; a studio node id for a lens that stands on a kind is new (`lens:<name>[:<title>]@<kinds>`), so a host that kept such an id reads it again from the studio.
