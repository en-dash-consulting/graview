# graview-agent-seat

`graview-agent-seat` is one of Graview's 15 authoring skills: instructions an AI coding assistant such as Claude Code or Codex reads before it changes a Graview app. What it teaches: Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.

Installed into a project by `graview skills install .`, and read by whichever assistant is working beside you.

## The skill

## Wire an agent seat

There is no agent API to build. The tools generate from the same mutation declarations a person's buttons come from, which is why an agent's edit produces literally the same diff, lands in the same op log with an author, and is undone by the same control. If you find yourself writing a second code path for the agent, stop: that path is the one that will drift.

### Do this

1. **Create the runtime with a principal.**

```ts const runtime = createToolRuntime(store, { author: { kind: "agent", id: "claude", session: "ui", roles: ["analyst"] }, }); ```

The author is a `Principal` — an author with roles — so what the log blames and what the policy judged are one object. A seat's tools narrow to what that principal may run, with no second list to keep in step. See `graview-permissions`.

1. **Pick a transport.** `createInAppAdapter(runtime)` for a seat inside the interface; `createMcpAdapter(runtime)` for an external client. Both are thin wrappers over the same runtime — that is the whole design.

1. **Show the calls.** `runtime.onCall(listener)` announces every call as it starts and as it settles. Feed it to `ActivityRail`. A diff says what changed and never what was *considered*, so an agent turn without this is a spinner and a toast.

1. **Report what it READ.** `useAttention(runtime)` pipes a settled read-only call's node ids into the picture, so a kind lights faintly where the agent looked. That is the half a diff cannot show, and the half that says whether to trust what it then did.

1. **Find by name with `search_graph`, before `get_graph`.** It is the Find box's matcher: hits with why they matched, `key:value` conditions (`done:false`, `is:any` for the past, `kind:task`), and the records it names counted as reads. Reading the whole graph to scan it is the move a person with a search box never makes.

**Ask what a place shows with `describe_place`, before you say done.** `{ place: "home" | "<slug>" | "<record id>", width: 390 }` returns the headings, figures, lists (each record's title and what its card or row says), group headings, empty words and problems this seat would see, as data and text. It reads what the faces draw from (`describePlace`, from `@graview/core/describe`), so it is not a guess. Hand the runtime the app (`createToolRuntime(store, { app })`, `createMcpHttpHandler({ app })`) or it says only kinds and records. On a checkout: `graview describe <entry> --place home --seed seed.json --as partner --width 390`.

1. **Prefer `get_affordances` over composing calls by hand.** The tool descriptions say so, and it matters: derived affordances cannot name an action that does not exist or is not legal on this selection.

1. **Host the seat where the data is, for an agent outside the page.** An editor's assistant or a scheduled worker does not need glue of its own:

```sh graview mcp ./dist/domain/app.js --data ./data --as cursor --roles keeper graview mcp ./dist/domain/app.js --remote-url http://localhost:5196 --roles keeper graview apply ./dist/domain/app.js --data ./data --roles keeper \ --call add-task --args '{"listId":"today","label":"Book the van","id":"t-van"}' ```

`mcp` is MCP over stdio around this same runtime; `apply` is one act, a plan of many as one batch, or an undo, from a shell. Both open the store `graview serve` opens — a folder, SQLite, or a running server — and act under the seat you name, so the policy refuses there what it refuses here. Put `serve` and `mcp` in the app's scripts so the door is always there, and tell the agent the seed is a first-install snapshot: it changes the live graph through these, never by editing `example.json` and wiping. `graview mcp <entry> --list --roles …` prints the seat's tools as `tools/list` JSON — the catalog a host registers without writing one.

### Worked examples

- `apps/todo/src/ui/app.tsx` — the seat, the runtime, and an agent that finds what it will change with `search_graph` before it moves
- `packages/tools/src/agent/tools.ts` — how the tools generate, and what a read-only call reports about what it looked at

### Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker verifies the mutations behind the tools: `mutation-untitled`, `mutation-undescribed`, `mutation-title-ambiguous`. A tool description that falls back to a title is a LABEL where an instruction belongs, and an agent reads that string to decide whether to reach for it.

**And prove the paths are one path**, which is the claim this design exists to support:

```ts
it("produces the same diff whether a human or an agent acts", async () => {
  const byHand = human.apply({ name: "reassign", args });
  const byAgent = await seat.call("reassign", args);
  // A refusal is a RESULT, so `ToolResult` is a union: establish there was a
  // diff before claiming anything about it, or this does not compile.
  if (!byAgent.ok) throw new Error(byAgent.error);
  expect(byAgent.diff).toEqual(byHand.diff);
});
```

**And prove the seat is bounded**, if it holds a restricted principal: call a mutation it was not given a tool for and check it is refused by the STORE rather than merely absent from the schema.

**Branch on the reason, never the words.** A refused call says `reason` beside its sentence (MCP's `structuredContent` too): `forbidden`, `missing`, `invalid` for the call as sent, `refused` when the act's own rule said no. A TypeScript mutation says its rule's no with `throw new ActRefusal(sentence)`; a bare `Error` is `invalid`, since nothing can tell it from a slip. Every act refuses an argument it does not take, naming those it does (a creating act takes `id` too), and its tool says `additionalProperties: false`; write `z.looseObject` only for an act that means to keep the rest.

### What the check cannot see

- Whether the agent's turn is legible while it is happening. Open the app and watch one; `pnpm watching` measures the marks but not whether they read.
- Whether the tool descriptions are good instructions. They are prose an agent reasons from, and "get the graph" is worse than "read the whole graph: start here when you need the shape of the domain rather than one thing in it".
- Whether the agent should be doing this at all.

### The seat is one of four surfaces on one seam

Everything intelligent travels the same contract — validated proposed calls to declared mutations — so adding AI is choosing a provider, never a second path to the store:

- **Providers** whisper suggestions into the acts every surface derives (`insightProvider` ships in the defaults; `intelligenceProvider(...)` wraps any `Intelligence`).
- **The seat** (this skill) runs one-press turns.
- **The ask field** — `<SeatField />`, "Ask <the app>…" at the foot of the scene and of Pages — is where the seat lives for a person. Asked, it grows into a panel over the picture (⇄ snaps it to the other foot; a bottom sheet on a phone): one line about where they are, at most three questions the graph can answer, at most three acts (the repairs a broken rule names for this thing, and their own pins), and the conversation. "This" is `useSubject()`: the selection, else where they are. Every other act is one question, the context menu (right-click, or A on a card), or Pages' "What can be done" away. The person never reads the word "seat". `<Shell ask="hidden" />` and the embed's `seat: "hidden"` draw none.
- **The conversation** belongs to the app (the provider's `seatTalk`), so it survives a switch between the scene and Pages. It answers in words. Keyless it answers from the graph (`graphResponder`: standings, named things, when/who, mutations phrased in their own titles). **The host decides the AI, once**: `ai={{ complete }}` on `GraviewProvider` (or `mount`/`<Embed>`'s `ai`) gives open questions a model; no reader picks one. With none, an open question hears that AI isn't on here; a model's answer carries a quiet "Answered with AI", its proposals logged `via: "ai:<name>"`. `ai.decide` (`jevDecide`) answers typed decisions; `onDevice: true` runs a model in the browser. **Your own responder goes in through the shell**: `<Shell chat={{ respond }} />`, which hands it to the ask field. A proposal is one line with "Do it" and "Not now"; Find's last row, "Ask: ‘…’", asks the same seat. "Why do I still have mosquitoes?" is a walk through THIS graph, and the generic answer to it is a plausible paragraph about gardens.
- **External agents** arrive over the derived tool surface with a scoped principal.
- **A desk** — the model INSIDE the product, taking photographs or words and proposing a plan somebody reviews. That is `graview-desk`; this skill is the seat beside the product rather than the surface in it.

Declare what runs where on the app: `intelligence: [{ name, kind: "graph" | "llm" | "external" | "decision", may: [...mutations] }]` — `graview check` refuses an allowlist naming a mutation nobody registered, refuses a `"decision"` provider (one that answers typed questions — a choice, a truth, a score — and never prose) any act whose required arguments want text, and the STORE enforces it: hand the store `intelligence` and an author `{ kind: "agent", id: "<provider name>" }` is refused anything outside its `may`, on `apply` as on a tool call. `openStore` and the embed pass it through for you.

---

Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.

The page: https://graview.dev/docs/skills/graview-agent-seat.html · Every Graview docs page, for a model: https://graview.dev/llms.txt
