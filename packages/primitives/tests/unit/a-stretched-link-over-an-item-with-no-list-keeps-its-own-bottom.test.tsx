// @vitest-environment jsdom
(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { useEndsAboveItsList } from "../../src/stretched-link.js";

/*
 * A STRETCHED LINK OVER AN ITEM WITH NO LIST KEEPS ITS OWN BOTTOM. Pages'
 * declared row stretches its link with `inset: 0` written on the link
 * itself; the hook that ends a link above a list inside its item removed
 * the link's `bottom` when there was no list, which took the inset's own
 * bottom with it: the link stood 0 pixels tall, and a declared row could
 * no longer be pressed to its record (`pnpm verify growing`).
 */
function Row({ list }: { readonly list: boolean }) {
  const link = useRef<HTMLAnchorElement>(null);
  useEndsAboveItsList(link);
  return (
    <li style={{ position: "relative" }}>
      <span>Let me export drafts in bulk</span>
      {list ? <div className="graview-spec-listing" /> : null}
      {/* `inset: 0` as a browser writes it on the element; jsdom keeps no shorthand it cannot expand. */}
      <a ref={link} href="/requests/r02" aria-label="Let me export drafts in bulk" style={{ position: "absolute", top: 0, right: 0, bottom: 0, left: 0 }} />
    </li>
  );
}

async function drawn(list: boolean) {
  const host = document.createElement("ul");
  document.body.append(host);
  const root = createRoot(host);
  await act(async () => root.render(<Row list={list} />));
  return { link: host.querySelector("a") as HTMLAnchorElement, done: () => act(async () => root.unmount()) };
}

describe("a stretched link over an item with no list keeps its own bottom", () => {
  it("keeps the bottom its inset gave it", async () => {
    const { link, done } = await drawn(false);
    expect(link.style.bottom).toBe("0px");
    expect(link.style.top).toBe("0px");
    await done();
  });
});
