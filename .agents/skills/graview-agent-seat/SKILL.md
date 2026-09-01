---
name: graview-agent-seat
description: Wire an agent seat into a Graview app that shares the interface's own actions rather than shadowing them, and verify the diffs are identical rather than assuming they are.
---

# Wire an agent seat

There is no agent API to build. The tools generate from the same mutation
declarations a person's buttons come from, which is why an agent's edit
produces literally the same diff, lands in the same op log with an author, and
is undone by the same control. If you find yourself writing a second code path
for the agent, stop: that path is the one that will drift.

## Do this

1. **Create the runtime with a principal.**

   ```ts
   const runtime = createToolRuntime(store, {
     author: { kind: "agent", id: "claude", session: "ui", roles: ["analyst"] },
   });
   ```

   The author is a `Principal` — an author with roles — so what the log blames
   and what the policy judged are one object. A seat's tools narrow to what
   that principal may run, with no second list to keep in step. See
   `graview-permissions`.

2. **Pick a transport.** `createInAppAdapter(runtime)` for a seat inside the
   interface; `createMcpAdapter(runtime)` for an external client. Both are thin
   wrappers over the same runtime — that is the whole design.

3. **Show the calls.** `runtime.onCall(listener)` announces every call as it
   starts and as it settles. Feed it to `ActivityRail`. A diff says what
   changed and never what was *considered*, so an agent turn without this is a
   spinner and a toast.

4. **Report what it READ.** `useAttention(runtime)` pipes a settled read-only
   call's node ids into the picture, so a kind lights faintly where the agent
   looked. That is the half a diff cannot show, and the half that says whether
   to trust what it then did.

5. **Prefer `get_affordances` over composing calls by hand.** The tool
   descriptions say so, and it matters: derived affordances cannot name an
   action that does not exist or is not legal on this selection.

## Worked examples

- `the household example/src/ui/app.tsx` — the seat, the runtime, `useAttention`, and
  an agent that reads the graph before it moves
- `packages/tools/src/agent/tools.ts` — how the tools generate, and what a
  read-only call reports about what it looked at

## Then find out whether it worked

```sh
pnpm build && npx graview check ./dist/domain/app.js
```

The checker verifies the mutations behind the tools: `mutation-untitled`,
`mutation-undescribed`, `mutation-title-ambiguous`. A tool description that
falls back to a title is a LABEL where an instruction belongs, and an agent
reads that string to decide whether to reach for it.

**And prove the paths are one path**, which is the claim this design exists to
support:

```ts
it("produces the same diff whether a human or an agent acts", async () => {
  const byHand = human.apply({ name: "reassign", args });
  const byAgent = await seat.call("reassign", args);
  expect(byAgent.diff).toEqual(byHand.diff);
});
```

**And prove the seat is bounded**, if it holds a restricted principal: call a
mutation it was not given a tool for and check it is refused by the STORE
rather than merely absent from the schema.

## What the check cannot see

- Whether the agent's turn is legible while it is happening. Open the app and
  watch one; `pnpm watching` measures the marks but not whether they read.
- Whether the tool descriptions are good instructions. They are prose an agent
  reasons from, and "get the graph" is worse than "read the whole graph: start
  here when you need the shape of the domain rather than one thing in it".
- Whether the agent should be doing this at all.

## The seat is one of four surfaces on one seam

Everything intelligent travels the same contract — validated proposed calls
to declared mutations — so adding AI is choosing a provider, never a second
path to the store:

- **Providers** whisper suggestions into the inspector (`insightProvider`
  ships in the defaults; `intelligenceProvider(...)` wraps any
  `Intelligence`).
- **The seat** (this skill) runs one-press turns.
- **The chat** — `<ChatPanel />` in the bar — answers questions in words.
  Keyless it answers from the graph (`graphResponder`: standings, named
  things, when/who, mutations phrased in their own titles); a model plugs in
  through one completion function (`llmResponder`, `xaiCompletion`,
  `localCompletion`), chosen by the person in the panel's gear.
- **External agents** arrive over the derived tool surface with a scoped
  principal.

Declare what runs where on the app: `intelligence: [{ name, kind:
"graph" | "llm" | "external", may: [...mutations] }]` — `graview check`
refuses an allowlist naming a mutation nobody registered.
