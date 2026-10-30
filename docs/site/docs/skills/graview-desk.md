# graview-desk

`graview-desk` is one of Graview's 31 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## A desk a model works at

`graview-agent-seat` is the model BESIDE the product: a seat in the bar that answers questions and proposes a change. A desk is the model INSIDE it — the surface a person brings something to. Photographs of a property, a paragraph about a season, a spreadsheet somebody was sent. It is often the feature the product is for, and it is four seams, all of which the framework ships.

### The four seams

1. **Intake** — getting the something in. `<Intake onPhotos={...} />` hands back data URLs.
2. **A door** — reaching the model. Declared, not hard-wired: ```ts intelligence: [{ name: "surveyor", kind: "llm", reach: ["paste", "local"], bridge: "/__graview/local", keyStorage: "in this browser only, never in the repository", may: ["stake-out", "place-feature"], }] ``` `<Door provider="surveyor" prompt={...} photos={...} onProposals={...} />` draws exactly the doors declared. **Paste is the floor** — a prompt out, an answer back, no key and no network — and a product reachable that way is a product anybody can run. `local` is the machine under the dev server, offered only when something is actually answering there. A locally-run product very often has a coding agent installed, logged in and paid for; the browser cannot spawn it and the dev server can:

```ts // vite.config.ts import { localIntelligence } from "@graview/ship/dev"; plugins: [localIntelligence({ path: "/__graview/local", budgetUsd: 2 })] ```

Read it with `useLocalIntelligence(path)` from `@graview/react`. The spawned session gets Read and only Read, beneath its own temporary folder (`Read(./**)`), the prompt after `--`, a turn per photograph plus three, a dollar budget, a closed stdin and only the environment it needs (`PATH`, `HOME`, the locale, proxies, `ANTHROPIC_*`). Every dev door answers only the page opened from the address the dev server prints (`?graview_door=<key>`, the key in `~/.graview/door-key`): open that once. `apply: "serve"` means a build carries no door: a deployed copy probes, gets nothing, and reads as **closed** — which is a state, not a fault.

1. **A plan** — what came back, as an object rather than a list: ordered by the chain, judged against the policy and the provider's `may`, reviewable. `planFrom(store, proposals, { app, principal })`.
2. **A review** — `<PlanReview plan={plan} onApplied={...} />`. Applied as one turn, so `store.undo(batch)` takes the whole thing back.

### Or in the context menu

A desk can be a section of the menu a right-click opens on either face (on the pages Shift+F10 and a long press too): `menuSections` on the provider, `embed()` or the pages' context. Each source is told what the menu was opened on — `{ face, on, about, field, place, href }` — and answers `{ id, heading?, items?: [{ id, label, run }], render?: (close) => node }` or nothing. It is drawn beside the acts the store would accept, never instead of them, and what it proposes goes through the same four seams.

### The inline AI, already in the menu

Hand the host's models and Graview draws an AI section in the context menu on both faces — no section to write. `ai={{ fast, thinking }}`: the Fast slot is Jev's shape (`jevFast()`, or any `{ model, decide }`), the Thinking slot `{ model, think({ system, prompt, state, catalog }) }`; each call reports tier, model and tokens to `ai.meter`. The model only PICKS from `catalogOf(store, target, { principal })` (`@graview/core/catalog`): acts the viewer may run, panels of the kind, places, neighbors, field values, never anything they cannot see or run; `aiContextOf` is the state it reads. A change waits as a ghost (Accept, Accept some, Dismiss) and is kept as one batch with lineage `interaction`; a panel is a draft "Keep as a lens" keeps. Each interaction is an `AiInteraction` in Activity (filter All / Changes / AI, "Just mine") and on its record's page; `ai.interactions` `{ load, keep }` stores them. A letter typed in the menu narrows every row to those whose words begin with it, the Fast slot then lighting what they mean once the typing rests, Enter running the one lit; words that fit nothing are its last row, "Ask about <it>: …", answered on the quick ask's card beside the thing with its thinking marked on it — the Fast slot picking the context the Thinking slot is told (`entry.context`) — and with no model the field only filters. `TYPESAFE_API_KEY=… XAI_API_KEY=… pnpm dev` lends both slots through the dev server — Anthropic, xAI or OpenAI by the key set — Jev in the Fast one (`decisionBridge`; that provider's small quick model without a Jev key). While it thinks, "Graview, for <person>" stands among who is here. An ask about a list acts on each of its records as one change; one the app cannot do is answered with what it lacks and, with `onProposeChange`, one plan — the app change and the records — asked "Should I?" (`ReshapeProposal.records`). `ai={{ off: true }}` hides every AI part. Prove it with stubs: `stubFast()`, `stubThinking()` from `@graview/tools/inline-ai` (`pnpm verify inline-ai`).

### Do this

1. **Write the prompt from the graph.** What kinds exist, what acts exist and what they take — `generateLlmsTxt(app)` from `@graview/core/check` writes that — plus what is already there. A model that cannot see the graph invents a second Back Lawn.

1. **Ask for proposals, not prose.** One JSON object with a `proposals` array of `{ mutation, args, as?, why? }`. `firstJsonObject` finds it inside whatever the model wrapped it in; `validateProposals` drops what this app does not have and what the provider may not do.

1. **Declare the allowlist and mean it.** `may` is enforced by the store now, on every path including your own code. A surveyor that may describe the ground and may not touch the record is a promise the runtime keeps.

1. **Never a second path to the store.** The desk's answer becomes ordinary mutations, applied by the same store, judged by the same policy, in the same log, with the same undo. "Add AI" is an entry in the declaration, never a way around it.

1. **Say what it did in the product's words.** `why` on each proposal is the sentence the review shows; a plan of eleven calls with no reasons is a thing nobody can approve.

### Then find out whether it worked

```sh
pnpm build:domain && npx graview check ./dist/domain/app.js
```

The checker verifies every act in `may` exists, warns on a `local` reach with no bridge and a `key` reach with no storage story, and `graview describe` lists the doors. Then drive it: a test that feeds a canned answer through `planFrom` and asserts the plan's order, its refusals and what the graph holds afterwards costs ten lines and catches the whole class.

### What the check cannot see

- Whether the model can actually see what you sent. A photograph a model was never handed produces a confident description of nothing.
- Whether a refusal is legible. The store refuses in a sentence; if the desk swallows it, a person meets a button that does nothing.
- Whether the answer is TRUE. Everything here makes a proposal safe, ordered and reversible. None of it makes it right, which is why a person reads it.

---

Put a model INSIDE a Graview product — a surface that takes photographs or words, reaches the model through a declared door, and turns the answer into a plan somebody reviews before it touches the graph.

The page: https://graview.dev/docs/skills/graview-desk.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
