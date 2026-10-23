import { createSchema, defineApp, defineNode, Graph, Store, TYPE_TEXT, type Batch, type Principal } from "@graview/core";
import { describe, expect, it } from "vitest";
import { z } from "zod";
import { createStoreHandler, openRemote, type LiveConnection, type LiveSocketLike, type RemoteStore, type StoreHandler } from "../../src/index.js";

/**
 * TYPING TOGETHER CONVERGES WHATEVER THE NETWORK DOES (Roadmap
 * f-collab-text, phase 6: hardening).
 *
 * Three pages type into one text at random — inserts of one to three
 * characters (an emoji now and then, two UTF-16 code units that must never
 * be split), deletions and replacements, at random places — end their runs,
 * and take back their own latest run of typing as Ctrl or ⌘ Z does, while
 * the network misbehaves under them: a line held one way or both and let
 * go later, a frame delivered twice (a call sent again must be answered,
 * not applied again; ops heard twice must not be folded twice), and a
 * connection that breaks.
 *
 * A real socket is ordered, so nothing here reorders frames within one
 * connection. What reorders is what a network really reorders: the three
 * pages' frames interleave at the server in whatever order their lines are
 * let go, and a connection that breaks with frames held loses each of them
 * or delivers it before the server sees the close — a frame in flight may or
 * may not have arrived — after which the page reconnects (its backoff) and
 * carries what it has not heard answered across.
 *
 * When the network heals and every page has ended its typing and heard
 * every answer, all three pages hold the server's text, the server's log
 * folds from the seed to the text it holds, and nothing was refused but
 * what the test expects. Seeded: a failure names its seed, which replays it;
 * `GRAVIEW_FUZZ_SEEDS=10,11,12 GRAVIEW_FUZZ_STEPS=3000` runs others, longer.
 */
const note = defineNode("note", { fields: z.object({ title: z.string(), body: z.string().max(100_000).optional() }) });
const schema = createSchema([note]);
const app = defineApp({ name: "notes", schema, mutations: [], version: 1 });
const SEED_TEXT = "The quick brown fox jumps over the lazy dog.";
const SEED = { nodes: [{ id: "n1", kind: "note", title: "Plan", body: SEED_TEXT }], edges: [] };
const PEOPLE: readonly Principal[] = [
  { kind: "human", id: "ana", name: "Ana" },
  { kind: "human", id: "ben", name: "Ben" },
  { kind: "human", id: "cy", name: "Cy" },
];

/** mulberry32: a small seeded generator, so a run replays from its seed. */
function random(seed: number) {
  let state = seed >>> 0;
  const next = () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  return { next, int: (below: number) => Math.floor(next() * below), chance: (p: number) => next() < p };
}

const tick = () => new Promise((done) => setTimeout(done, 1));
async function until(holds: () => boolean, what: string, state: () => unknown = () => ""): Promise<void> {
  for (let tries = 0; !holds(); tries++) {
    if (tries > 2000) throw new Error(`${what} never came true: ${JSON.stringify(state())}`);
    await tick();
  }
}

/** A socket between a page and the handler, in this process, that the test can hold, duplicate and break. */
interface Line {
  up: boolean;
  down: boolean;
  /** The next frame either way is delivered twice. */
  twiceUp: boolean;
  twiceDown: boolean;
  release(): void;
  /** The connection breaks: each held frame up is lost or arrives first, as `arrives` says; held frames down are lost. */
  drop(arrives: () => boolean): void;
}

function harness(handler: StoreHandler<typeof schema>) {
  const socketFor = (lines: Line[]) => (url: string, headers: Readonly<Record<string, string>>): LiveSocketLike => {
    const upHeld: string[] = [];
    const downHeld: string[] = [];
    let connection: LiveConnection | undefined;
    const toServer = (text: string) => queueMicrotask(() => connection?.receive(text));
    const toPage = (text: string) => queueMicrotask(() => client.readyState === 1 && client.onmessage?.({ data: text }));
    const client: LiveSocketLike & { readyState: number } = {
      readyState: 0,
      onopen: null,
      onmessage: null,
      onclose: null,
      onerror: null,
      send(text) {
        if (client.readyState !== 1) return;
        if (line.up) upHeld.push(text);
        else toServer(text);
        if (line.twiceUp) {
          line.twiceUp = false;
          if (line.up) upHeld.push(text);
          else toServer(text);
        }
      },
      close() {
        if (client.readyState === 3) return;
        client.readyState = 3;
        connection?.close();
        queueMicrotask(() => client.onclose?.({ code: 1000, reason: "" }));
      },
    };
    const line: Line = {
      up: false,
      down: false,
      twiceUp: false,
      twiceDown: false,
      release() {
        line.up = false;
        line.down = false;
        for (const text of upHeld.splice(0)) toServer(text);
        for (const text of downHeld.splice(0)) toPage(text);
      },
      drop(arrives) {
        // A frame in flight when the line broke may have reached the server before it saw the close.
        for (const text of upHeld.splice(0)) if (arrives()) connection?.receive(text);
        downHeld.length = 0;
        line.up = false;
        line.down = false;
        client.close();
      },
    };
    lines.push(line);
    void handler
      .connect(new Request(url.replace(/^ws/, "http"), { headers }), {
        send(text) {
          if (client.readyState === 3) return;
          const twice = line.twiceDown;
          line.twiceDown = false;
          for (const once of twice ? [text, text] : [text]) {
            if (line.down) downHeld.push(once);
            else toPage(once);
          }
        },
        close: () => client.close(),
      })
      .then((made) => {
        if (made instanceof Response) throw new Error(`refused: ${made.status}`);
        connection = made;
        if (client.readyState === 3) return void made.close();
        client.readyState = 1;
        client.onopen?.({});
      });
    return client;
  };
  const fetcher = ((url: string, init?: RequestInit) => handler.handle(new Request(url, init))) as typeof fetch;
  const page = async (principal: Principal) => {
    const lines: Line[] = [];
    const remote = await openRemote({ app, url: "https://store.example", principal, live: true, fetch: fetcher, socket: socketFor(lines), pollMs: 0, backoff: () => 5 });
    return { remote, line: () => lines[lines.length - 1]! };
  };
  return { page };
}

const bodyOf = (store: { readonly graph: { getNode(id: string): unknown } }) => ((store.graph.getNode("n1") as { body?: string } | undefined)?.body ?? "");

const high = (code: number) => code >= 0xd800 && code <= 0xdbff;
/** An offset never between the two halves of a pair. */
const whole = (text: string, at: number) => (at > 0 && at < text.length && high(text.charCodeAt(at - 1)) ? at - 1 : at);

/** Whether a batch is a run of typing into the body: every op a `type-text` into it. */
const typedInto = (batch: Batch) =>
  batch.ops.length > 0 &&
  batch.ops.every((op) => {
    const args = op.mutation?.args as { node?: unknown; field?: unknown } | undefined;
    return op.mutation?.name === TYPE_TEXT && args?.node === "n1" && args.field === "body";
  });

/** The run ⌘Z takes back (as the live editor's `runToTakeBack` picks it): this person's latest run into the field, not taken back, that the log lets go of. */
function runToTakeBack(store: RemoteStore<typeof schema>["store"], who: Principal): string | undefined {
  const batches = store.batches();
  for (let at = batches.length - 1; at >= 0; at--) {
    const batch = batches[at]!;
    if (batch.author.kind !== "human" || (batch.author.id !== undefined && batch.author.id !== who.id)) continue;
    if (batch.undone || !typedInto(batch)) continue;
    if (store.canUndo(batch.id).ok) return batch.id;
  }
  return undefined;
}

const ALPHABET = "abcdefghij ,.\n";
const EMOJI = ["😀", "🦊", "👍🏽", "é"];

async function fuzz(seed: number, steps: number) {
  const rng = random(seed);
  const store = new Store({ schema, mutations: [], snapshot: SEED as never });
  const handler = await createStoreHandler({ app, store, trustSeatHeaders: true });
  const { page } = harness(handler);
  const pages = await Promise.all(PEOPLE.map(async (who) => ({ who, ...(await page(who)) })));
  const refused: string[] = [];
  const conflicts: string[] = [];
  for (const one of pages) {
    one.remote.onRefusal((sentence) => refused.push(`${one.who.id}: ${sentence}`));
    one.remote.onConflict((conflict) => conflicts.push(`${one.who.id}: ${JSON.stringify(conflict.conflicts)}`));
  }
  const typings = await Promise.all(pages.map((one) => one.remote.typing("n1", "body")));
  const counts = { typed: 0, flushed: 0, undone: 0, held: 0, released: 0, twice: 0, dropped: 0 };

  for (let step = 0; step < steps; step++) {
    const at = rng.int(pages.length);
    const one = pages[at]!;
    const typing = typings[at]!;
    const roll = rng.next();
    if (roll < 0.55) {
      const text = bodyOf(one.remote.store);
      const from = whole(text, rng.int(text.length + 1));
      const kind = rng.int(3);
      const span = kind === 0 ? 0 : whole(text, Math.min(text.length, from + 1 + rng.int(3))) - from;
      const remove = text.length - span < 4 ? 0 : Math.max(0, span);
      const insert = kind === 1 && remove > 0 ? "" : rng.chance(0.1) ? EMOJI[rng.int(EMOJI.length)]! : Array.from({ length: 1 + rng.int(3) }, () => ALPHABET[rng.int(ALPHABET.length)]).join("");
      typing.splice(from, remove, insert);
      counts.typed++;
    } else if (roll < 0.63) {
      typing.flush();
      counts.flushed++;
    } else if (roll < 0.67) {
      typing.flush();
      const run = runToTakeBack(one.remote.store, one.who);
      if (run) {
        one.remote.store.undo(run);
        counts.undone++;
      }
    } else if (roll < 0.74) {
      const line = one.line();
      if (rng.chance(0.5)) line.up = true;
      else line.down = true;
      counts.held++;
    } else if (roll < 0.84) {
      one.line().release();
      counts.released++;
    } else if (roll < 0.88) {
      if (rng.chance(0.5)) one.line().twiceUp = true;
      else one.line().twiceDown = true;
      counts.twice++;
    } else if (roll < 0.9) {
      one.line().drop(() => rng.chance(0.5));
      counts.dropped++;
    } else {
      await tick();
    }
    if (step % 7 === 0) await Promise.resolve();
  }

  // The network heals: every line let go, every run ended, every answer heard.
  for (let round = 0; round < 3; round++) {
    for (const one of pages) {
      const line = one.line();
      line.twiceUp = false;
      line.twiceDown = false;
      line.release();
    }
    for (const typing of typings) typing.flush();
    await until(() => typings.every((typing) => typing.waiting() === 0) && pages.every((one) => one.remote.status() === "online"), `seed ${seed}: every run answered`, () => pages.map((one, at) => ({ waiting: typings[at]!.waiting(), status: one.remote.status(), counters: one.remote.counters() })));
    await Promise.all(pages.map((one) => one.remote.settled()));
  }
  await until(() => pages.every((one) => bodyOf(one.remote.store) === bodyOf(store)), `seed ${seed}: every page at the server's text`);

  const graph = Graph.from(schema, SEED as never);
  for (const op of store.log.all()) graph.applyPrimitives(op.primitives);
  const texts = pages.map((one) => bodyOf(one.remote.store));
  for (const one of pages) one.remote.close();
  await handler.close();
  return { server: bodyOf(store), pages: texts, folded: bodyOf({ graph }), refused, conflicts, counts, ops: store.log.length };
}

const SEEDS = (process.env["GRAVIEW_FUZZ_SEEDS"] ?? "1,2,3,4").split(",").map(Number);
const STEPS = Number(process.env["GRAVIEW_FUZZ_STEPS"] ?? 1500);

describe("typing together over a network that misbehaves", () => {
  // Found by the fuzz: an undo of a run held behind the one on its way was sent before that run, naming a batch the server did not have yet.
  it("an undo of a run still held behind another is sent once that run is answered, not before", async () => {
    const store = new Store({ schema, mutations: [], snapshot: SEED as never });
    const handler = await createStoreHandler({ app, store, trustSeatHeaders: true });
    const { page } = harness(handler);
    const ana = await page(PEOPLE[0]!);
    const refused: string[] = [];
    ana.remote.onRefusal((sentence) => refused.push(sentence));
    const typing = await ana.remote.typing("n1", "body");
    ana.line().up = true;
    typing.splice(0, 0, "A");
    typing.flush();
    typing.splice(1, 0, "B");
    typing.flush();
    expect(typing.waiting()).toBe(2);
    const run = runToTakeBack(ana.remote.store, PEOPLE[0]!);
    expect(run).toBeDefined();
    ana.remote.store.undo(run!);
    expect(bodyOf(ana.remote.store)).toBe(`A${SEED_TEXT}`);
    ana.line().release();
    await until(() => typing.waiting() === 0, "both runs answered");
    await ana.remote.settled();
    await until(() => bodyOf(store) === `A${SEED_TEXT}` && bodyOf(ana.remote.store) === bodyOf(store), "the page and the server at one text", () => [bodyOf(store), bodyOf(ana.remote.store)]);
    expect(refused).toEqual([]);
    ana.remote.close();
    await handler.close();
  });

  for (const seed of SEEDS) {
    it(`three pages typing, ending runs and taking their own back converge (seed ${seed})`, async () => {
      const run = await fuzz(seed, STEPS);
      const said = `seed ${seed} (GRAVIEW_FUZZ_SEEDS=${seed} replays it): ${JSON.stringify(run.counts)}`;
      expect(run.pages, said).toEqual([run.server, run.server, run.server]);
      expect(run.folded, said).toBe(run.server);
      expect(run.conflicts, said).toEqual([]);
      expect(run.refused, said).toEqual([]);
      expect(run.counts.typed, said).toBeGreaterThan(STEPS / 3);
      expect(run.ops, said).toBeGreaterThan(0);
    }, 30_000);
  }
});
