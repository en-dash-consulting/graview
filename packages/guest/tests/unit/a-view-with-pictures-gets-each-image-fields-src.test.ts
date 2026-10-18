// @vitest-environment jsdom
import { Store, type AnySchema } from "@graview/core";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ana, FILES, jobsApp, jobsSeed, sam } from "../../../../scripts/fixtures/jobs-app.js";
import { workerViewProps, type WorkerViewManifest } from "../../src/host/manifest.js";
import { createGuestPictures, PICTURE_STAND_IN } from "../../src/host/pictures.js";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import type { GuestFile, GuestProps } from "../../src/protocol.js";

/*
 * A VIEW WITH `pictures: true` GETS EACH IMAGE FIELD'S `src` (Roadmap,
 * 2026-10-18, a photo gallery on Graview Cloud: "pictures: true never
 * delivers src").
 *
 * A record keeps its file at a path on the host (`/graview/files/…`),
 * which Cloud serves under the app's base (`/a/<app>/graview/files/…`).
 * The host fetched it at the path resolved against the page — the
 * workspace's root, not the app — so the view was never handed `src`. A
 * host that serves its app under a base now says where a record's file
 * is (`file`, as `asset` says where the app's images are), and a picture
 * that could not be loaded says what the host answered and which option
 * a host under a base passes. Headless, nothing is fetched, so a picture
 * comes with a stand-in `src`, and the view's `<img>` is drawn and judged
 * as it will be on the page.
 */
const store = () => new Store({ schema: jobsApp.schema, mutations: [], policy: jobsApp.policy!, snapshot: structuredClone(jobsSeed) as never }) as unknown as Store<AnySchema>;
const photos: WorkerViewManifest = { name: "job-photos", title: "Job photos", attach: "job", cardinality: "many", pictures: true };

/** Cloud's host: each file served under the app's base, and nothing at the workspace's root but its own page. */
function cloud() {
  const fetched: string[] = [];
  vi.spyOn(window, "fetch").mockImplementation(async (url) => {
    const path = new URL(String(url)).pathname;
    fetched.push(path);
    if (path.startsWith("/a/jobs/graview/files/")) return new Response(new Uint8Array(300), { status: 200, headers: { "content-type": "image/png" } });
    if (path.startsWith("/graview/")) return new Response("Sign in to open this app.", { status: 401, headers: { "content-type": "application/json" } });
    return new Response("<!doctype html>", { status: 200, headers: { "content-type": "text/html" } });
  });
  return fetched;
}
afterEach(() => vi.restoreAllMocks());

function hand(file?: (href: string) => string | undefined) {
  const said: string[] = [];
  const live = store();
  let last: GuestProps | undefined;
  const pictures = createGuestPictures(window, {
    as: "data",
    view: '"Job photos"',
    pictures: true,
    ...(file ? { file } : {}),
    shrink: async (blob) => blob,
    moved: () => (last = pictures.hand(workerViewProps(live, sam, { manifest: photos }))),
    onLeft: (one) => said.push(one),
  });
  last = pictures.hand(workerViewProps(live, sam, { manifest: photos }));
  return { said, last: () => last! };
}
const settled = async () => {
  for (let i = 0; i < 20; i += 1) await new Promise((done) => setTimeout(done, 0));
};
const step = (props: GuestProps) => ((props.nodes ?? []).find((node) => node.id === "job:porch") as unknown as { photos: GuestFile[] }).photos[1]!;

describe("a view with pictures: true", () => {
  it("is handed src for a picture its host serves under the app's base, fetched where the host says the file is", async () => {
    const fetched = cloud();
    const { last, said } = hand((href) => `/a/jobs${href}`);
    await settled();
    expect(step(last()).src).toMatch(/^data:image\/png;base64,/);
    expect(fetched).toContain(`/a/jobs${FILES.step}`);
    expect(fetched).not.toContain(FILES.step);
    expect(said).toEqual([]);
  });

  it("where the host does not say, says what the host answered and what a host under a base passes, never silently", async () => {
    cloud();
    const { last, said } = hand();
    await settled();
    const left = step(last()).left;
    expect(step(last()).src).toBeUndefined();
    expect(left).toBe('The picture "step.png" on "Porch repair" could not be loaded for the view "Job photos": the host answered 401. A host that serves the app under a base says where a record\'s files are (file, on the view\'s definition).');
    expect(said).toContain(left);
    expect(left).not.toContain("/graview/files/");
  });

  it("headless, is handed a stand-in src, so the view draws its picture and the run says it", async () => {
    const result = await runWorkerViewHeadless({
      manifest: photos,
      source: `graview.onProps((props) => graview.render(graview.html\`\${props.nodes.map((job) => graview.html\`<section><h3>\${job.label}</h3>\${job.photos.map((one) => one.src ? graview.html\`<img src="\${one.src}" alt="\${one.caption || one.name}">\` : graview.html\`<p>\${one.name} has no src</p>\`)}</section>\`)}\`));`,
      store: store(),
      principal: ana,
      run: nodeIsolate(),
    });
    if (!result.ok) throw new Error(`${result.reason}: ${result.detail}`);
    expect(result.description.text).toContain("The porch before");
    expect(result.description.text).toContain("The cracked step");
    expect(result.description.text).not.toContain("porch.png has no src");
    expect(result.description.problems).toEqual([]);
    expect(step(result.props).src).toBe(PICTURE_STAND_IN);
    // An SVG is a document to a view: no src, headless as live.
    expect(result.description.text).toContain("plan.svg has no src");
    expect(JSON.stringify(result.props)).not.toContain("/graview/files/");
  });
});
