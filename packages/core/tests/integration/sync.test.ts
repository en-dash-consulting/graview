import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  bindSchema,
  createSchema,
  defineNode,
  googleCalendar,
  googleCalendarMapping,
  nodeRef,
  Store,
  SyncEngine,
  type Fetcher,
  type RemoteAck,
  type RemoteChange,
  type RemoteSystem,
  type RemoteWrite,
  SYNC_CONFLICTS,
  syncConflictInvariant,
} from "../../src/index.js";

/**
 * Two-way sync, on top of the op log rather than beside it.
 *
 * The three things that break naive two-way sync are an echo of your own
 * write, a genuine conflict resolved silently, and a network that goes away.
 * Each has a test here, and each is checked for what it did rather than for
 * whether it threw.
 */

const block = defineNode("block", {
  fields: z.object({ label: z.string(), start: z.string(), end: z.string() }),
  plural: "Blocks",
});
const schema = createSchema([block]);
const bound = bindSchema(schema);

const retime = bound.defineMutation("retime", {
  title: "Change when it happens",
  description: "Move a block to a different time.",
  subject: { kinds: ["block"], arg: "id" },
  input: z.object({
    id: nodeRef(["block"]),
    label: z.string().optional(),
    start: z.string().optional(),
    end: z.string().optional(),
  }),
  apply(ctx, args) {
    const patch: Record<string, unknown> = {};
    for (const field of ["label", "start", "end"] as const) {
      if (args[field] !== undefined) patch[field] = args[field];
    }
    ctx.patchNode(args.id, patch);
  },
});

const mapping = googleCalendarMapping({
  events: [{ kind: "block", summary: "label", start: "start", end: "end" }],
});

function store() {
  return new Store({
    schema,
    mutations: [retime],
    snapshot: {
      nodes: [
        { id: "school", kind: "block", label: "School", start: "08:30", end: "15:00" },
      ],
      edges: [],
    },
  });
}

/** A remote that records what it was asked and answers what it is told to. */
function fake(script: {
  pulls?: readonly { changes: readonly RemoteChange[]; cursor: string }[];
  acks?: (writes: readonly RemoteWrite[]) => readonly RemoteAck[];
  failPull?: boolean;
  failPush?: boolean;
}): RemoteSystem & { readonly sent: RemoteWrite[][] } {
  const pulls = [...(script.pulls ?? [])];
  const sent: RemoteWrite[][] = [];
  return {
    name: "fake",
    sent,
    async pull() {
      if (script.failPull) throw new Error("offline");
      return pulls.shift() ?? { changes: [], cursor: "c0" };
    },
    async push(writes) {
      if (script.failPush) throw new Error("offline");
      sent.push([...writes]);
      return (
        script.acks?.(writes) ??
        writes.map((write, index) => ({
          localId: write.localId,
          id: write.id ?? `remote-${index}`,
          version: `v${sent.length}`,
        }))
      );
    },
  };
}

const engineFor = (live: Store<typeof schema>, remote: RemoteSystem) =>
  new SyncEngine({
    store: live,
    mapping,
    remote,
    // An inbound change goes through a MUTATION, like anything else.
    applyInbound: ({ localId, fields }) => ({ name: "retime", args: { id: localId, ...fields } }),
  });

describe("sending what changed here", () => {
  it("sends a node the remote has never seen, and remembers what it made of it", async () => {
    const live = store();
    const remote = fake({});
    const engine = engineFor(live, remote);
    const report = await engine.run();

    expect(report.pushed).toEqual(["school"]);
    expect(remote.sent[0]![0]!.fields).toEqual({
      summary: "School",
      "start.dateTime": "08:30",
      "end.dateTime": "15:00",
    });
    expect(report.state.links["school"]).toMatchObject({ id: "remote-0", version: "v1" });
  });

  it("sends nothing at all when nothing changed", async () => {
    const live = store();
    const remote = fake({});
    const engine = engineFor(live, remote);
    await engine.run();
    const second = await engine.run();
    expect(second.pushed).toEqual([]);
    expect(remote.sent).toHaveLength(1);
  });

  it("derives what to send by COMPARING, not by watching for edits", async () => {
    /*
     * A change nobody was listening for still gets sent. The alternative is a
     * subscription that has to be correct forever, and the day it is not is
     * the day a change quietly never leaves.
     */
    const live = store();
    const engine = engineFor(live, fake({}));
    await engine.run();
    live.apply({ name: "retime", args: { id: "school", start: "09:00" } });
    expect(engine.pending()).toHaveLength(1);
    expect(engine.pending()[0]!.fields).toMatchObject({ "start.dateTime": "09:00" });
  });
});

describe("taking what changed there", () => {
  it("lands an inbound change as an op with a system author, undoable like any other", async () => {
    const live = store();
    const engine = engineFor(live, fake({}));
    await engine.run();
    const link = engine.snapshot.links["school"]!;

    const inbound = fake({
      pulls: [
        {
          changes: [
            {
              resource: "events",
              id: link.id,
              version: "theirs-1",
              fields: { summary: "School (early)", "start.dateTime": "08:00" },
            },
          ],
          cursor: "c1",
        },
      ],
    });
    const report = await new SyncEngine(
      {
        store: live,
        mapping,
        remote: inbound,
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      // Carrying the state forward is the point: without the link, an inbound
      // change is about a record we have never heard of.
      engine.snapshot,
    ).run();

    expect(report.applied).toEqual(["school"]);
    expect((live.graph.getNode("school") as { start: string }).start).toBe("08:00");

    const op = live.log.all().at(-1)!;
    expect(op.author).toEqual({ kind: "system", id: "google-calendar" });
    // In the log, so it appears in the activity list beside a person's edits —
    // and comes back out the same way.
    const batch = live.batches().at(-1)!;
    live.undo(batch.id);
    expect((live.graph.getNode("school") as { start: string }).start).toBe("08:30");
  });

  it("RECOGNISES AN ECHO of its own write and does not re-apply it", async () => {
    /*
     * The loop that breaks naive two-way sync. We pushed; the remote told us
     * the version our push produced; the next pull hands that version back as
     * news. Applying it is harmless once and a loop when two systems do it to
     * each other.
     */
    const live = store();
    const engine = engineFor(live, fake({}));
    await engine.run();
    const link = engine.snapshot.links["school"]!;
    const before = live.log.length;

    const echo = fake({
      pulls: [
        {
          changes: [
            {
              resource: "events",
              id: link.id,
              // The very version our own push produced.
              version: link.version,
              fields: { summary: "School", "start.dateTime": "08:30", "end.dateTime": "15:00" },
            },
          ],
          cursor: "c1",
        },
      ],
    });
    const report = await new SyncEngine(
      {
        store: live,
        mapping,
        remote: echo,
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      engine.snapshot,
    ).run();

    expect(report.echoes).toEqual(["school"]);
    expect(report.applied).toEqual([]);
    expect(live.log.length).toBe(before);
  });
});

describe("when both sides changed the same thing", () => {
  it("SURFACES the conflict rather than picking a winner", async () => {
    const live = store();
    const engine = engineFor(live, fake({}));
    await engine.run();
    const link = engine.snapshot.links["school"]!;

    // We move it; they move it somewhere else.
    live.apply({ name: "retime", args: { id: "school", start: "09:00" } });
    const contested = fake({
      pulls: [
        {
          changes: [
            {
              resource: "events",
              id: link.id,
              version: "theirs-1",
              fields: { "start.dateTime": "07:45", summary: "School run" },
            },
          ],
          cursor: "c1",
        },
      ],
    });
    const report = await new SyncEngine(
      {
        store: live,
        mapping,
        remote: contested,
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      engine.snapshot,
    ).run();

    expect(report.conflicts).toEqual([
      { localId: "school", field: "start", ours: "09:00", theirs: "07:45", base: "08:30" },
    ]);
    // Ours stands until somebody decides. Silently taking theirs is the sync
    // layer making a domain decision in a place nobody looks.
    expect((live.graph.getNode("school") as { start: string }).start).toBe("09:00");
    // And a field only THEY changed is not a conflict, so it lands.
    expect((live.graph.getNode("school") as { label: string }).label).toBe("School run");
  });

  it("resolves either way, through the same mutation as everything else", async () => {
    const live = store();
    const first = engineFor(live, fake({}));
    await first.run();
    const link = first.snapshot.links["school"]!;
    live.apply({ name: "retime", args: { id: "school", start: "09:00" } });

    const engine = new SyncEngine(
      {
        store: live,
        mapping,
        remote: fake({
          pulls: [
            {
              changes: [
                { resource: "events", id: link.id, version: "t1", fields: { "start.dateTime": "07:45" } },
              ],
              cursor: "c1",
            },
          ],
        }),
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      first.snapshot,
    );
    const report = await engine.run();
    engine.resolve(report.conflicts[0]!, "theirs");

    expect((live.graph.getNode("school") as { start: string }).start).toBe("07:45");
    expect(live.log.all().at(-1)!.author).toEqual({ kind: "system", id: "google-calendar" });
  });
});

describe("a conflict is a violation, with a repair", () => {
  it("becomes something the interface already knows how to show", async () => {
    /*
     * The framework already has the right shape for "something is wrong and
     * here is what would fix it". A conflict uses it rather than inventing a
     * parallel notification nobody reads — so it appears in the standing
     * indicator, lights the node it is about, and offers its repair in the
     * actions strip, all without one line of sync-aware interface code.
     */
    const invariant = syncConflictInvariant<typeof schema>({
      system: "google-calendar",
      mutation: "retime",
      argsFor: (conflict) => ({ id: conflict.localId, [conflict.field]: conflict.theirs }),
    });
    const live = new Store({
      schema,
      mutations: [retime],
      invariants: [invariant],
      snapshot: {
        nodes: [{ id: "school", kind: "block", label: "School", start: "08:30", end: "15:00" }],
        edges: [],
      },
    });

    const first = engineFor(live, fake({}));
    await first.run();
    const link = first.snapshot.links["school"]!;
    live.apply({ name: "retime", args: { id: "school", start: "09:00" } });

    const engine = new SyncEngine(
      {
        store: live,
        mapping,
        remote: fake({
          pulls: [
            {
              changes: [
                { resource: "events", id: link.id, version: "t1", fields: { "start.dateTime": "07:45" } },
              ],
              cursor: "c1",
            },
          ],
        }),
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      first.snapshot,
    );
    const report = await engine.run();

    // Nothing at all until the conflicts are threaded through the context —
    // they are facts about the last conversation with the remote, not about
    // the graph.
    expect(live.violations()).toEqual([]);

    const violations = live.violations({ [SYNC_CONFLICTS]: report.conflicts });
    expect(violations).toHaveLength(1);
    expect(violations[0]!.message).toContain("07:45");
    expect(violations[0]!.message).toContain("Yours stands until you choose");
    expect(violations[0]!.nodeIds).toEqual(["school"]);

    // And the repair is an ordinary mutation, so applying it is an ordinary
    // edit — logged, attributed and undoable.
    const repair = violations[0]!.repairs[0]!;
    expect(repair.mutation).toBe("retime");
    live.apply({ name: repair.mutation, args: repair.args! });
    expect((live.graph.getNode("school") as { start: string }).start).toBe("07:45");
    expect(live.violations({ [SYNC_CONFLICTS]: report.conflicts })).toHaveLength(1);
  });
});

describe("when the network is not there", () => {
  it("degrades to local-only and reconciles on reconnect", async () => {
    /*
     * Not an error. A household week that stops working on a train is worse
     * than one that syncs later.
     */
    const live = store();
    const offline = await engineFor(live, fake({ failPull: true, failPush: true })).run();
    expect(offline.offline).toBe(true);
    expect(offline.queued).toEqual(["school"]);

    // Work carries on, locally.
    live.apply({ name: "retime", args: { id: "school", start: "09:15" } });

    const back = fake({});
    const report = await new SyncEngine(
      {
        store: live,
        mapping,
        remote: back,
        applyInbound: ({ localId, fields }) => ({
          name: "retime",
          args: { id: localId, ...fields },
        }),
      },
      offline.state,
    ).run();

    expect(report.offline).toBe(false);
    expect(report.pushed).toEqual(["school"]);
    // One write, carrying the LATEST value — not one per edit made offline.
    expect(back.sent[0]).toHaveLength(1);
    expect(back.sent[0]![0]!.fields).toMatchObject({ "start.dateTime": "09:15" });
  });

  it("keeps a write the remote refused, and says which", async () => {
    const live = store();
    const report = await engineFor(
      live,
      fake({ acks: (writes) => writes.map((w) => ({ localId: w.localId, id: "", version: "", error: "403" })) }),
    ).run();
    expect(report.refused).toEqual([{ localId: "school", error: "403" }]);
    expect(report.state.links["school"]).toBeUndefined();
  });
});

describe("the Google Calendar transport", () => {
  /** A recorded conversation, so this exercises the real request shapes. */
  const recorded = (): { fetch: Fetcher; seen: { url: string; method: string; body?: string }[] } => {
    const seen: { url: string; method: string; body?: string }[] = [];
    const fetcher: Fetcher = async (url, init) => {
      seen.push({ url, method: init?.method ?? "GET", ...(init?.body ? { body: init.body } : {}) });
      if ((init?.method ?? "GET") === "GET") {
        return {
          ok: true,
          status: 200,
          json: async () => ({
            items: [
              {
                id: "evt-1",
                etag: '"abc"',
                summary: "School",
                start: { dateTime: "2026-09-01T08:30:00Z" },
                end: { dateTime: "2026-09-01T15:00:00Z" },
              },
              { id: "evt-2", etag: '"def"', status: "cancelled" },
            ],
            nextSyncToken: "tok-2",
          }),
        };
      }
      return {
        ok: true,
        status: 200,
        json: async () => ({ id: "evt-9", etag: '"ghi"' }),
      };
    };
    return { fetch: fetcher, seen };
  };

  it("reads Google's nesting into the dotted paths a mapping names", async () => {
    const { fetch, seen } = recorded();
    const remote = googleCalendar({ calendarId: "me@example.com", token: () => "t", fetch });
    const { changes, cursor } = await remote.pull();

    expect(cursor).toBe("tok-2");
    expect(changes[0]).toEqual({
      resource: "events",
      id: "evt-1",
      version: '"abc"',
      fields: {
        summary: "School",
        "start.dateTime": "2026-09-01T08:30:00Z",
        "end.dateTime": "2026-09-01T15:00:00Z",
      },
    });
    // A cancelled event is a DELETION, not a record that stopped appearing.
    expect(changes[1]).toMatchObject({ id: "evt-2", deleted: true });
    // And the first pull asks for deleted events, or one would be
    // indistinguishable from an event we never had.
    expect(seen[0]!.url).toContain("showDeleted=true");
  });

  it("writes the dotted paths back into Google's nesting", async () => {
    const { fetch, seen } = recorded();
    const remote = googleCalendar({ calendarId: "me@example.com", token: () => "t", fetch });
    const acks = await remote.push([
      {
        resource: "events",
        localId: "school",
        fields: { summary: "School", "start.dateTime": "2026-09-01T08:30:00Z" },
      },
    ]);

    expect(acks[0]).toEqual({ localId: "school", id: "evt-9", version: '"ghi"' });
    expect(JSON.parse(seen[0]!.body!)).toEqual({
      summary: "School",
      start: { dateTime: "2026-09-01T08:30:00Z" },
    });
    expect(seen[0]!.method).toBe("POST");
  });

  it("starts over when Google rejects the sync token, rather than looking offline", async () => {
    /*
     * A 410 is the one error here that is not an error. Throwing would look
     * like being offline, and being offline is handled by KEEPING the cursor —
     * which is exactly the wrong response to "your cursor is no good".
     */
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 410, json: async () => ({}) };
      return {
        ok: true,
        status: 200,
        json: async () => ({ items: [], nextSyncToken: "fresh" }),
      };
    };
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch: fetcher });
    const { cursor } = await remote.pull("stale");
    expect(cursor).toBe("fresh");
    expect(calls).toBe(2);
  });

  it("reports one refusal without failing the whole run", async () => {
    let calls = 0;
    const fetcher: Fetcher = async () => {
      calls += 1;
      if (calls === 1) return { ok: false, status: 403, json: async () => ({}) };
      return { ok: true, status: 200, json: async () => ({ id: "evt-2", etag: '"z"' }) };
    };
    const remote = googleCalendar({ calendarId: "c", token: () => "t", fetch: fetcher });
    const acks = await remote.push([
      { resource: "events", localId: "a", fields: { summary: "A" } },
      { resource: "events", localId: "b", fields: { summary: "B" } },
    ]);
    expect(acks[0]!.error).toContain("403");
    expect(acks[1]!.id).toBe("evt-2");
  });
});
