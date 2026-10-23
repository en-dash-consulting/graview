import { afterEach, describe, expect, it } from "vitest";
import { z } from "zod";
import { digestWords, foldDigests, suggest } from "../../src/tidying.js";
import {
  bindSchema,
  createSchema,
  defineNode,
  nodeRef,
  sayIn,
  Store,
  type AnySchema,
  type Author,
} from "../../src/index.js";

/**
 * A NIGHT'S TIDYING IS ONE ROW OF ACTIVITY. Everything the app's own actor
 * applied in one pass carries that pass's id (`Lineage.run`), and Activity
 * folds the run into one row — "Tidied 4 things overnight" — wherever a
 * person's change fell between its batches; two runs are two rows. Where an
 * actor said no run, consecutive batches fold as they always have.
 */
const vendor = defineNode("vendor", {
  fields: z.object({ label: z.string() }),
});
const schema = createSchema([vendor]);
const { defineMutation } = bindSchema(schema);
const rename = defineMutation("rename-vendor", {
  title: "Rename a vendor",
  subject: { kinds: ["vendor"], arg: "id" },
  input: z.object({ id: nodeRef(["vendor"]), label: z.string() }),
  apply(ctx, args) {
    ctx.patchNode(args.id, { label: args.label });
  },
});

const actor: Author = {
  kind: "system",
  id: "tidying",
  name: "Graview, tidying",
  automated: true,
};
const nick: Author = { kind: "human", id: "nick", name: "Nick" };

/** A store whose clock reads what each change is handed. */
function storeAt() {
  let clock = "2026-10-14T02:00:00.000Z";
  const store = new Store<AnySchema>({
    schema,
    mutations: [rename] as never,
    now: () => clock,
    snapshot: {
      nodes: ["bloom", "harbor", "quill"].map((id) => ({
        id: `vendor:${id}`,
        kind: "vendor",
        label: id,
      })) as never,
      edges: [],
    },
  });
  const at = (moment: string, run: () => void) => {
    clock = moment;
    run();
  };
  return { store, at };
}

const renamed = (id: string, label: string) => ({
  name: "rename-vendor",
  args: { id: `vendor:${id}`, label },
});
const inRun = (run: string | undefined) => ({
  author: actor,
  lineage: {
    basis: "The invoice spells it so",
    confidence: 0.95,
    ...(run ? { run } : {}),
  },
});
const said = (rows: ReturnType<typeof foldDigests>) =>
  rows.map((row) =>
    "digest" in row
      ? `digest:${row.digest.run ?? "-"}:${row.digest.things}`
      : `batch:${row.batch.author.id}`,
  );

afterEach(() => sayIn({}));

describe("a night's tidying in Activity", () => {
  it("is one row per run, standing where the run's last batch does, though a person's change fell between", () => {
    const { store, at } = storeAt();
    at("2026-10-14T01:00:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom Florals"), inRun("night-1")),
    );
    at("2026-10-14T01:05:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor"), { author: nick }),
    );
    at("2026-10-14T01:10:00.000Z", () =>
      store.apply(renamed("quill", "Quill Stationers"), inRun("night-1")),
    );
    at("2026-10-14T01:20:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor Catering"), inRun("night-1")),
    );
    const rows = foldDigests(store.batches(), (id) => store.log.get(id));
    expect(said(rows)).toEqual(["batch:nick", "digest:night-1:3"]);
  });

  it("is two rows for two runs, however close together they came", () => {
    const { store, at } = storeAt();
    at("2026-10-14T01:00:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom Florals"), inRun("night-1")),
    );
    at("2026-10-14T01:10:00.000Z", () =>
      store.apply(renamed("quill", "Quill Stationers"), inRun("night-2")),
    );
    at("2026-10-14T01:20:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor Catering"), inRun("night-1")),
    );
    expect(
      said(foldDigests(store.batches(), (id) => store.log.get(id))),
    ).toEqual(["digest:night-2:1", "digest:night-1:2"]);
  });

  it("folds consecutive batches as before where the actor said no run, and never folds those into a run's row", () => {
    const { store, at } = storeAt();
    at("2026-10-14T01:00:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom Florals"), inRun("night-1")),
    );
    at("2026-10-14T01:10:00.000Z", () =>
      store.apply(renamed("quill", "Quill Stationers"), inRun(undefined)),
    );
    at("2026-10-14T01:20:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor Catering"), inRun(undefined)),
    );
    at("2026-10-14T01:30:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor"), { author: nick }),
    );
    at("2026-10-14T01:40:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom"), inRun(undefined)),
    );
    expect(
      said(foldDigests(store.batches(), (id) => store.log.get(id))),
    ).toEqual(["digest:night-1:1", "digest:-:2", "batch:nick", "digest:-:1"]);
  });

  it("leaves what the run suggested to the Suggested tray, and does not break the run for it", () => {
    const { store, at } = storeAt();
    at("2026-10-14T01:00:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom Florals"), inRun("night-1")),
    );
    at("2026-10-14T01:05:00.000Z", () =>
      suggest(store, [renamed("quill", "Quill & Co")], inRun("night-1")),
    );
    at("2026-10-14T01:10:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor Catering"), inRun("night-1")),
    );
    expect(
      said(foldDigests(store.batches(), (id) => store.log.get(id))),
    ).toEqual(["digest:night-1:2"]);
  });

  it('says a run made in the night, ending today, as "overnight", and one made by day as the day it fell on', () => {
    sayIn({ appTimeZone: "UTC" });
    const { store, at } = storeAt();
    at("2026-10-13T23:30:00.000Z", () =>
      store.apply(renamed("bloom", "Bloom Florals"), inRun("night-1")),
    );
    at("2026-10-14T02:10:00.000Z", () =>
      store.apply(renamed("quill", "Quill Stationers"), inRun("night-1")),
    );
    at("2026-10-14T13:00:00.000Z", () =>
      store.apply(renamed("harbor", "Harbor Catering"), inRun("noon-1")),
    );
    const [night, noon] = foldDigests(store.batches(), (id) =>
      store.log.get(id),
    ).map((row) => ("digest" in row ? row.digest : undefined));
    expect(digestWords(night!, "2026-10-14")).toBe("Tidied 2 things overnight");
    expect(digestWords(noon!, "2026-10-14")).toBe("Tidied one thing today");
    expect(digestWords(night!, "2026-10-15")).toBe("Tidied 2 things on Oct 14");
    // Without a run, a night's batches are a day's, as they always were.
    expect(
      digestWords({ things: 2, at: "2026-10-14T02:10:00.000Z" }, "2026-10-14"),
    ).toBe("Tidied 2 things today");
  });
});
