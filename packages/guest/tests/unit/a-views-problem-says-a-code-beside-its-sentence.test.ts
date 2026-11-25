// @vitest-environment jsdom
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";
import { mountGuestView } from "../../src/host/frame.js";
import { GUEST_PROTOCOL, type HostHello } from "../../src/protocol.js";
import { bethan, showroom } from "./showroom.js";
import { VIEW_PROBLEM_CODES } from "../../src/host/problems.js";
import { VIEW_PROBLEM_CODES as FROM_VIEWS } from "../../src/host/views.js";
import { VIEW_PROBLEM_CODES as FROM_FRAME } from "../../src/host/frame.js";
import { VIEW_PROBLEM_CODES as FROM_WORKER } from "../../src/host/worker.js";

/*
 * A VIEW'S PROBLEM SAYS A CODE BESIDE ITS SENTENCE (HQ f-view-problem-codes).
 * A host that counts what went wrong in its views counts by the code, never
 * by the words: the sentence may be reworded in any version, the code may
 * not. So the list is pinned here whole — renaming a code, or dropping one,
 * fails this test, where rewording a sentence fails none — and each path's
 * own test says the code it gives (a part that failed, a frame held by the
 * growth guard, a face not lent, a link that goes nowhere, a picture left
 * out, and the rest).
 */
describe("the codes a view's problems are said with", () => {
  it("are one closed list, pinned whole: a code is never renamed or reused", () => {
    expect(VIEW_PROBLEM_CODES).toEqual([
      "part-failed",
      "held-by-growth-guard",
      "taller-than-allowed",
      "far-kind-not-handed",
      "views-stylesheet-draws-nothing",
      "face-not-lent",
      "face-not-loaded",
      "face-late",
      "face-several-files",
      "own-face-refused",
      "own-face-not-loaded",
      "picture-left-out",
      "picture-thumb-unsound",
      "image-refused",
      "link-refused",
      "link-goes-nowhere",
      "jump-goes-nowhere",
      "file-link-goes-nowhere",
      "media-not-drawn",
      "embed-refused",
      "embed-not-allowed",
      "drop-not-offered",
      "gestures-not-declared",
      "press-refused",
      "viewer-state-refused",
      "host-part-not-loaded",
    ]);
    expect(new Set(VIEW_PROBLEM_CODES).size).toBe(VIEW_PROBLEM_CODES.length);
    for (const code of VIEW_PROBLEM_CODES) expect(code).toMatch(/^[a-z]+(-[a-z]+)*$/);
  });

  it("are the same list wherever a view's host is imported from", () => {
    for (const list of [FROM_VIEWS, FROM_FRAME, FROM_WORKER]) expect(list).toBe(VIEW_PROBLEM_CODES);
  });

  it("reach a frame guest's host for a navigate that goes nowhere, beside onLost, as link-goes-nowhere", async () => {
    const element = document.body.appendChild(document.createElement("div"));
    const lost: string[] = [];
    const problems: [string, unknown][] = [];
    const frame = mountGuestView(element, { url: "https://cards.example/card.html", view: "card", store: showroom(), principal: bethan, input: () => ({ node: { id: "car:golf" } }), onArrive: () => {}, onLost: (said) => lost.push(said), onProblem: (said, problem) => problems.push([said, problem]) });
    try {
      const posted = vi.spyOn(frame.iframe.contentWindow!, "postMessage");
      window.dispatchEvent(new MessageEvent("message", { data: { graview: "guest-ready", protocol: GUEST_PROTOCOL }, origin: "null", source: frame.iframe.contentWindow }));
      const [hello, , [port]] = posted.mock.calls.at(-1) as unknown as [HostHello, string, MessagePort[]];
      port!.start();
      port!.postMessage({ type: "navigate", nonce: hello.nonce, to: "car:nowhere" });
      for (let i = 0; i < 100 && problems.length === 0; i += 1) await new Promise((resolve) => setTimeout(resolve, 10));
      expect(lost).toHaveLength(1);
      expect(problems).toEqual([[lost[0], { code: "link-goes-nowhere" }]]);
    } finally {
      frame.dispose();
    }
  });

  it("are each documented where the view host is", () => {
    const readme = readFileSync(fileURLToPath(import.meta.url).replace(/tests\/unit\/[^/]+$/, "README.md"), "utf8");
    for (const code of VIEW_PROBLEM_CODES) expect(readme, code).toContain(`\`${code}\``);
  });
});
