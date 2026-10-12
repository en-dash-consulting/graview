---
"@graview/core": patch
"@graview/guest": patch
"@graview/primitives": patch
"@graview/studio": patch
---

A sight can reach the records that link to you (the Graview Roadmap's open request "Visibility scoped by relation"). `sees` kept whole kinds, and `own` showed a seat every record any relation joins to its own — so a Secret Santa match, joined to its giver and its receiver, was shown to both. `{ "roles": ["participant"], "kinds": ["match"], "via": "givenBy" }` shows a seat a match only where `givenBy` joins it, at either end, to the seat's own record of the people kind: each giver sees their own match and not the one they receive in. It holds wherever sight is honored — a seat's graph and its counts, names, search, what a place says, the served log, the wire's state, polls and export, an answer to a seat, a seat's problems and its tools — and moves as the link does. A declaration says it as `Sight.via`; the studio carries it. `graview check` refuses a relation no kind declares (`sight-via-unknown-edge`), one that never joins the kind to the people (`sight-via-misses-people`) and a policy that says one with no people kind (`people-unsaid`). `packages/core/tests/document/fixtures/secret-santa.gdd.json` is the worked example.

Compatibility: additive. The document format gains `policy.sees[].via` within `graview-document@1`; a build that predates it refuses it by path. Check finding codes: `sight-via-unknown-edge` and `sight-via-misses-people` are new, errors only about a sight that could not be written before. A seat is served what it was before under every sight a declaration could already say. Ops, stored formats, the wire's shapes and tool names and schemas are unchanged. New: `Sight.via`.
