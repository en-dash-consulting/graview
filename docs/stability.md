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

### 3. The wire and live protocols: additive within a major

`WIRE` (in `@graview/ship`) lists every route `serveStore` answers, and `createStoreHandler` answers the same routes in any runtime (FR-09). `WIRE_PROTOCOL` numbers the protocol. The guest-view protocol (`@graview/guest`, FR-04) is held to the same rules, and `GUEST_PROTOCOL` numbers it.

- Within a major, a route or a response field may be added. None is removed, renamed or changed in meaning.
- A request field the server does not know is ignored, never refused.
- The live socket at `/graview/live` (FR-05) holds to the same rules: a message type or a field may be added, and a message the server does not know is ignored. `hello` and `welcome` carry `WIRE_PROTOCOL`, so either side can tell what the other speaks. Its seqs mean what `/graview/since?seq=N` means.
- A field's revision, which a stale write is refused against, is the seq of the op that last wrote it. It is derived from the log and never stored, so it never changes a stored format.
- `WIRE_PROTOCOL` moves only when a client of the previous protocol can no longer be served, and that is a major.

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
