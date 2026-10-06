# What a version may change

A host runs thousands of stored apps on one build of `@graview/*`. Before it takes a new version it needs to know three things: whether stored data folds the same, whether a declaration that compiled still compiles, and whether the tools a model calls moved. This page is the promise, and `capabilities()` is how a host reads what a build ships instead of guessing from a number.

Every `@graview/*` package shares one version (a changesets `fixed` group). Before 1.0, a minor may break what this page allows a major to break; each break is still said in a `Compatibility:` line. From 1.0 on, the rules below hold within a major.

## The five surfaces

### 1. Ops and primitives: the stable contract

An `Operation` and its `Primitive`s are history, and history is never rewritten. Within a major:

- Never changed incompatibly. A field may be added if it is optional, and an op without it reads as before (`via`, `author.name`, `author.onBehalfOf` arrived this way).
- No field is removed or changes meaning. No primitive is removed.
- A fold of the same log gives the same graph on every version of the major.

A major that must change them ships `upgradeOp` steps (below).

### 2. Snapshot and log formats: versioned

What is stored carries the format it was written in (FR-31). `FORMATS` names the current formats (`snapshot`, `op`), and `formatStamp()` gives `{ framework, formats }`. A store's meta and every bundle are stamped with it.

- A reader meeting a newer format says so with `NewerFormatError` and does not fold it. The host refolds from the log or rolls forward. Rollback is therefore always safe: the previous version never misreads what the next one wrote.
- An older format is brought up by `upgradeSnapshot(snapshot, from)` and `upgradeOp(op, from)`, one step per format change. Each step ships with a test over a fixture of the format before it (`packages/core/tests/fixtures/formats/`).
- Anything written before stamps existed (0.1.0) is format 1.
- A log compacted behind an undo horizon (FR-23) is not a new format. Its ops are ops, its checkpoint is an epoch marked `horizon`, and the archive sits beside it. A build before compaction refuses such a store on open, because its log no longer begins at seq 0. It never misreads one.
- A checkpoint keeps who made each record behind it (`Epoch.creators`, record id to seat id), so an `own` sight knows them after a restart without the archive. The field is optional and additive within format 1: a checkpoint without it opens as before and knows its makers from the horizon on, and a build that predates it ignores it, folds the same graph and judges sights as it always did. A build that predates it and compacts again writes its next checkpoint without the field. Epochs are never served to a seat, so the ids it names stay with the host.

### 3. The wire and live protocols: additive within a major

`WIRE` (in `@graview/ship`) lists every route `serveStore` answers, and `createStoreHandler` answers the same routes in any runtime (FR-09). `WIRE_PROTOCOL` numbers the protocol. The guest-view protocol (`@graview/guest`, FR-04) is held to the same rules, and `GUEST_PROTOCOL` numbers it.

- Within a major, a route or a response field may be added. None is removed, renamed or changed in meaning.
- A request field the server does not know is ignored, never refused.
- The live socket at `/graview/live` (FR-05) holds to the same rules: a message type or a field may be added, and a message the server does not know is ignored. `hello` and `welcome` carry `WIRE_PROTOCOL`, so either side can tell what the other speaks. Its seqs mean what `/graview/since?seq=N` means.
- A refusal's `reason` (FR-46) is one of `REFUSAL_REASONS` — `forbidden`, `missing`, `invalid`, `limit`, `unavailable` — on the socket's `refused` and on every refusing answer of the routes. A code never changes meaning. Before 1.0 a code may be added, and the changelog says so as a change to this surface; from 1.0 none is added within a major, so a program that branches on all five has branched on every refusal. `wouldNeed` is the roles that could, when the policy knows them. A call naming a record the seat may not see is refused exactly as one naming a record that does not exist — `missing`, one sentence that names the act and not the id (FR-55) — and permission is asked of it as if the record were not there, so no refusal tells a guessed id from a real one. What this cannot hide is an act's own logic: a condition that counts records its caller may not see, a refusal worded from one, an effect that copies from one. `graview check` warns of each act that reads a kind some role allowed to run it may not see (`act-reads-hidden-kind`, FR-105), reading a document's act for itself and a TypeScript act by the kinds it declares it `reads`.
- `busy` (FR-45) is not a refusal: the host asked for the change again after `retryAfter` milliseconds (429 with `Retry-After` over HTTP), nothing was judged, and a client keeps the change. `limit` is a refusal: the change can never succeed as asked, and is taken back. `unavailable` is the one refusal that is not final: the host takes no changes for a while and cannot say how long (503 over HTTP), nothing was judged, and a client keeps the change and sends it again, backing off. A call sent again after it landed is answered with its ops before a host's `limit` is asked, so it is never told busy, `limit` or `unavailable`.
- A field's revision, which a stale write is refused against, is the seq of the op that last wrote it. It is derived from the log and never stored, so it never changes a stored format.
- `WIRE_PROTOCOL` moves only when a client of the previous protocol can no longer be served, and that is a major.
- A host that stops serving an older protocol says so with `reload` (FR-44): `minProtocol` names the lowest it serves, and a client carries its unsent calls across the reload. `hello.wire` and the subprotocol `graview.ship.1` name ship's codec, so a host can serve another beside it on one path. `build` in `hello` and `welcome` is the host's opaque string and is never judged. A host numbers its own half of the wire with `hello.hostProtocol`, which `minHostProtocol` answers with `reload` carrying `hostProtocol`; `hello.protocol` stays `WIRE_PROTOCOL`.
- A client names its batch as a `Store` mints it, `batch:<tag>:<n>` or `undo:<tag>:<n>` (`isClientBatch`); any other is refused `invalid`. A batch sent again is answered only with the asking seat's own ops, and one that holds somebody else's is refused `invalid`. A server mints its own batches outside that shape (`served:…`), and serves another seat's withheld op under an opaque `withheld:<16 hex>` batch. A `via` in a call or a post is a claim, ignored unless the host's `viaOf` accepts it (FR-52).
- The declaration `version` a welcome, a route and a `declaration` push say is the host's own monotonic number for the declaration it serves, the one a client hands `resolveApp`; a push with the number a client already serves is ignored.
- A declaration change is pushed as `declaration` (FR-43), and every welcome says the declaration `version` it serves. Neither moves `WIRE_PROTOCOL`.
- A host that holds the app read-only says so (FR-66): `{ t: "held", sentence }` to every socket that said hello when the hold starts, `sentence: null` when it ends, `held` in every welcome and on every answer a poll reads while it stands, and every change meanwhile refused `unavailable` in that sentence. Additive to protocol 1, so it does not move `WIRE_PROTOCOL` or the codec's name: a client that does not know the message ignores it.
- What a seat is served holds no id of a record it may not see (FR-55): not in the snapshot, the log, an op's primitives, inverse, reads, writes, call or sentence, a presence, a conflict, `/graview/health` or a tool's answer — beyond the seat's own words. A field whose current value this seat wrote (or the person an agent acts for; an undo is never the author of what it puts back) is served as written, whatever it names, and a record withheld only for such a field is served; so is the seat's own call in its own ops, and an argument it sent that an answer says back. A seat that guessed an id and wrote it is then served the same whether the guess was real, and a write of the value a field already holds, when that value names what the seat may not see, is kept in the log as the seat's. An oracle that checks what a seat is served excludes the strings the seat itself wrote. An act's sentence is worded from its author's view: `describe` reads the graph as the author is served it, so a record the author may not see is named only by what the author wrote, as one that does not exist is — and a reader who sees more reads that sentence as the author would have. The seat's own words excuse only what it wrote — values in its primitives and the inverse that puts them back, and its own calls; another author's call, sentence and name are judged by sight alone. An op records which records its sentence read (`described`), and another author's op is served whole only when its reader may see every one of them. An act's own refusal worded from a record its caller may not see is said as "“<act>” could not be done as asked." An answer's `reads` name only records the seat sees; an id that names no record is left out as a hidden one is. `seatLens` is the judgement, and `seenBy`, `logSeenBy`, the routes, the live socket and the agent tools all read it. A seen record whose field names a hidden one is served with that field cleared when its kind declares the field optional (or does not declare it); when the field is required, clearing it would serve a record that fails its own declaration, so the record is withheld from that seat whole, as if its sight did not reach it — with its links, and with every op that touched it withheld. An op whose only mention of a hidden record is in its `reads` or `writes`, and whose primitives are served as written, is served whole with those trimmed. Any other op that names a hidden id is withheld, and its primitives are judged by whether each record was served just before and just after them: served to served is the patch as the seat is served the record (a hidden id written into an optional field arrives as that field cleared, `UNSET`); not served to served is an `add-node` of the record as now served, with its links to records the seat is served; served to not served is a `remove-node`; neither is nothing; and a link is served when both its ends are — an end that is not there at its moment, as a dangling link a repair removes has, is judged as `seesId` judges its id, so one that names no record is served and one that names a record the seat may not see, removed before, after or with the link, is not (FR-67). A seat from whom nothing is kept (`hidesFrom` false) is served every op as it is. So the log a seat is served folds — from nothing, from any cursor, or from the epoch base its view serves after a compaction — to exactly the snapshot it is served. `/graview/health` keeps `ok` and every count the whole store's — a poller asks whether the store is well, a count names no record, and a count of only what the asker sees would call a broken store well — and its `danglingEdges` names only the links whose ends the asking seat may be told of; a caller the host cannot tell is judged as a seat with no id and no roles. This narrows what a seat is sent and never adds a field, so it does not move `WIRE_PROTOCOL`.

### 4. The declaration, the document format and check finding codes

A declaration that compiled and checked clean on one version compiles on the next version of the major.

- A check finding's `code` never changes meaning. A new code may appear, and a new warning or note is not a break. A new *error* on a declaration that used to pass is a break.
- The stored-data finding codes of `validateGraph` (FR-21) hold to the same rule. Each is a record, a link or a rule that no longer fits the declaration, found by id:

  | Code | What it says | `repairPlan` |
  |------|--------------|--------------|
  | `node-shape` | a record's field does not fit its kind (`detail` names the field) | clear an optional field, coerce a required one to its default, else drop the record with its links |
  | `kind-unknown` | a record of a kind the declaration no longer has | drop it, with its links |
  | `edge-dangling` | a link to or from a record that is not there | drop the link |
  | `edge-disallowed` | a link the declaration does not allow between those kinds | drop the link |
  | `rule-error` | a rule threw rather than judged (`could-not-judge`; `detail` names the rule) | none: the declaration's to fix |
  | `rule-budget` | a rule would have read more than its budget (`over-budget`) | none: the declaration's to fix |

- The declaration document format (FR-01) is versioned like a stored format, and `capabilities().documentFormats` lists what a build parses.
- A key may be added to a document format within its version when it is optional and a document without it means what it meant: `kinds.<kind>.computed` (FR-83) arrived in `graview-document@1` this way. Every key is closed, so a build that predates one refuses a document that uses it as `unknown-key`, by path, and never misreads it. A host that keeps documents for more than one build reads `capabilities().shipped` before it writes the key.
- The app's money arrived the same way (FR-100). Its one home is the brand: `brand.currency` (a three-letter code) and `brand.locale` (a language tag) in a document, `Brand.currency` and `Brand.locale` in a declaration, and a document's `brand` may now carry them without an `accent`. A figure or a field shown as money takes `currency` of its own; one that names none, and a template's `{x | money}`, take the brand's, written by `Intl.NumberFormat` in the brand's locale ("en-US" when it names none). A document without them says a sum as it always did: a figure with a currency in that currency, anything else as a number with no symbol. A figure's and a meter's `label` became a template (FR-99): a label without braces says what it said. The rule language gained `out(S, 'edge')`, `in(S, 'edge')` and `&`, `|` and `-` between sets (FR-101); an expression that parsed before means what it meant, except that a `|` inside brackets within a template's braces, which was a formatter and refused, is now a join. A build that predates them refuses `brand.currency`, `brand.locale`, a field's `currency` and a set operator by path, but draws a templated label as its words and a two-argument walk as "—", so a host reads `capabilities().shipped` for FR-99, FR-100 and FR-101 before it writes them.
- A number's range arrived the same way (FR-114): `min`, `max` and `step` on a `number` or `integer` field (and on an act's declared argument), each optional, a field without them taking any number as before. The edit vocabulary gained `set-range`, and `DocumentDiff` gained `narrowedRanges`. A range is judged by the checker (`default-range`, `field-range`), not by `readDocument`. A build that predates them refuses the keys by path, so a host reads `capabilities().shipped` for FR-114 before it writes them.
- An act's `setsOther` and `replaces` arrived the same way (FR-115), each optional, an act without them doing what it did. One meaning changed with them: an act's `connects` or `severs` shorthand on a subject that is only the far end of the relation (`connects: "owns"` on a component, where `owns` is declared on person) now links from the record it is given to the subject, as the declaration says the relation goes; before, it tried the link the other way round, which the graph refused, so no document that worked reads differently. `effectsOf` may return a `ReplaceEffect` beside the effects a document lists. A host reads `capabilities().shipped` for FR-115 before it writes the keys.
- A check finding code added this way (FR-99's `view-braces`, FR-100's `brand-currency` and `brand-locale`, FR-105's `act-reads-hidden-kind`, FR-114's `default-range` and `field-range`, FR-115's `act-sets-other` and `act-replaces`) is a warning or an error only about what is new: `act-reads-hidden-kind` and `view-braces` are warnings, and the brand, range and other-end codes judge keys a declaration could not hold before.

### 5. Derived tool names and input schemas

Tools are derived from the declaration (`createToolRuntime`, `graview mcp`), and a model that listed them before a change sends what it learned then.

- A change to a derived tool's name, description or input schema for an unchanged declaration is called out in a `Compatibility:` line, even when it is a fix.
- A change caused by the declaration (a renamed field renames an argument) is the app's change, not the framework's. The framework's part is saying which tools moved.

## The conformance kit

`@graview/core/conformance` ships fixtures: declaration documents with the check findings and tool schemas this framework made of them, and op logs with the snapshot hash each folds to. `conformance()` runs them against this build, or against a build a host hands it, and returns the differences by fixture id. A host runs it before it takes a version.

The fixtures are append-only. `node scripts/conformance-fixtures.mjs` only ever adds a fixture with a new id, and a lock holds the rest. A change to a recorded fixture is an announced difference (`ANNOUNCED`), with the version that made it and what changed.

## The Compatibility line

A pull request that touches a file on one of the five surfaces asks every changeset it adds for a line:

```md
Compatibility: additive — `Operation.via` is a new optional field; ops without it read as before.
```

The line says the surface, whether the change is *additive*, *breaking* or *unchanged*, and for whom. `scripts/require-changeset.mjs` refuses a changeset without one (CI's `changeset` job), and the files that count as each surface are in `scripts/lib/surfaces.mjs`. The line goes into each package's CHANGELOG with the rest of the changeset, so every release lists what it did to compatibility.

## `capabilities()`

```ts
import { capabilities } from "@graview/core";

capabilities();
// { version: "0.1.2", protocol: 1, documentFormats: [], formats: { snapshot: 1, op: 1 },
//   shipped: ["FR-06", "FR-11", …] }
```

`shipped` lists the ids of the seams this build ships, by the ids Graview Cloud filed them under. A host retires its interim for a seam when the id appears. A test holds the list to the FR ids the changesets name, so a seam cannot ship unannounced or be announced without shipping.

`FRAMEWORK_VERSION` is the version alone, for a host that records which framework folded a store.
