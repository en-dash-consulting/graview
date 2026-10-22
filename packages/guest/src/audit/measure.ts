/*
 * THE RULES THAT NEED A LAID-OUT PAGE (Roadmap f-view-a11y-audit): the ring
 * the keyboard shows, text contrast, and a box that scrolls because what it
 * holds is bigger than it. Run only where the root is in a browser that lays
 * it out (`auditView` asks); each reads the computed style and the boxes of
 * what was drawn. What a rule cannot judge — a ring drawn as a shadow, text
 * over a picture or a gradient — is counted as unmeasured, never as passing.
 */
import { colorsIn, composite, contrast, type Rgba } from "@graview/core";
import type { AuditedElement } from "./index.js";
import type { AuditImpact, AuditRuleId } from "./rules.js";

export interface MeasureOptions {
  readonly limit: number;
  readonly tabbable: (element: AuditedElement) => boolean;
  /** A box that scrolls on the page: judged as a scroll region, unless the drawing said so already. */
  readonly scrollsOnPage: (element: AuditedElement) => void;
  readonly say: (rule: AuditRuleId, element: AuditedElement, impact: AuditImpact, says: string, fix: string, wcag?: string, automatic?: boolean) => void;
}

const WHITE: Rgba = { r: 255, g: 255, b: 255, a: 1 };
const NEAR_BLACK: Rgba = { r: 18, g: 18, b: 18, a: 1 };

/** The element above, across a shadow root to its host. */
const above = (element: Element): Element | null => element.parentElement ?? ((element.getRootNode() as ShadowRoot).host as Element | undefined) ?? null;

let probe: CanvasRenderingContext2D | null | undefined;
/** A computed color as sRGB: read as written, or drawn once into a pixel where it is a color space the reader does not know. */
function colorOf(value: string, document: Document): Rgba | undefined {
  if (value === "transparent") return { r: 0, g: 0, b: 0, a: 0 };
  const [read] = colorsIn(value);
  if (read) return read;
  if (probe === undefined) probe = document.createElement("canvas").getContext("2d", { willReadFrequently: true });
  if (!probe) return undefined;
  probe.clearRect(0, 0, 1, 1);
  probe.fillStyle = "#000";
  probe.fillStyle = value;
  probe.fillRect(0, 0, 1, 1);
  const [r, g, b, a] = probe.getImageData(0, 0, 1, 1).data;
  return { r: r!, g: g!, b: b!, a: a! / 255 };
}

/** What is drawn behind an element: its backgrounds and its ancestors' laid over each other, or none where a picture or gradient is. */
function groundOf(element: Element): Rgba | undefined {
  const document = element.ownerDocument;
  const view = document.defaultView!;
  const layers: Rgba[] = [];
  for (let at: Element | null = element; at; at = above(at)) {
    const style = view.getComputedStyle(at);
    if (style.backgroundImage && style.backgroundImage !== "none") return undefined;
    const color = colorOf(style.backgroundColor, document);
    if (!color) return undefined;
    if (color.a > 0) layers.push(color);
    if (color.a >= 1) break;
  }
  const dark = view.getComputedStyle(document.documentElement).colorScheme.includes("dark") && view.matchMedia?.("(prefers-color-scheme: dark)").matches;
  return layers.reverse().reduce((under, over) => composite(over, under), dark ? NEAR_BLACK : WHITE);
}

const ratioWords = (ratio: number) => `${Math.floor(ratio * 100) / 100}:1`;

export function measureView(shown: readonly AuditedElement[], options: MeasureOptions): { readonly unmeasured: Partial<Record<AuditRuleId, number>>; readonly measured: Partial<Record<AuditRuleId, number>> } {
  const unmeasured: Partial<Record<AuditRuleId, number>> = {};
  const unsure = (rule: AuditRuleId) => (unmeasured[rule] = (unmeasured[rule] ?? 0) + 1);
  const elements = shown.filter((one): one is AuditedElement & Element => typeof (one as unknown as Element).getBoundingClientRect === "function");
  const first = elements[0];
  if (!first) return { unmeasured, measured: { contrast: 0, "focus-visible": 0 } };
  const document = first.ownerDocument;
  const view = document.defaultView!;
  const boxed = (element: Element) => {
    const box = element.getBoundingClientRect();
    return box.width > 1 && box.height > 1;
  };

  /* TEXT CONTRAST: each element's own words against what is behind them. */
  let read = 0;
  for (const element of elements) {
    if (read >= options.limit) break;
    const own = Array.from(element.childNodes).some((child) => child.nodeType === 3 && (child.textContent ?? "").trim() !== "");
    if (!own || element.namespaceURI !== "http://www.w3.org/1999/xhtml") continue;
    if (element.hasAttribute("disabled") || element.getAttribute("aria-disabled") === "true") continue;
    const style = view.getComputedStyle(element);
    if (style.visibility !== "visible" || style.display === "none" || !boxed(element)) continue;
    read += 1;
    const ink = colorOf(style.color, document);
    const ground = groundOf(element);
    if (!ink || !ground) {
      unsure("contrast");
      continue;
    }
    const ratio = contrast(composite(ink, ground), ground);
    const size = Number.parseFloat(style.fontSize);
    const weight = Number.parseInt(style.fontWeight, 10);
    const large = size >= 24 || (size >= 18.66 && weight >= 700);
    const least = large ? 3 : 4.5;
    if (ratio + 0.005 < least) {
      options.say("contrast", element, "serious", `Its words are at ${ratioWords(ratio)} against their ground; ${least}:1 is the least ${large ? "large " : ""}text may be.`, "Give it a color further from its ground: --graview-ink and --graview-ink-muted are held to the app's grounds.");
    }
  }

  /* THE RING: each thing Tab reaches, focused, shows an outline at least 2px wide at 3:1 against what is around it. */
  const had = document.activeElement as HTMLElement | null;
  let rung = 0;
  for (const element of elements) {
    if (rung >= options.limit) break;
    if (!options.tabbable(element) || !boxed(element)) continue;
    rung += 1;
    const target = element as unknown as HTMLElement;
    target.focus({ preventScroll: true, focusVisible: true } as FocusOptions);
    const active = (element.getRootNode() as Document | ShadowRoot).activeElement;
    if (active !== element || !element.matches(":focus-visible")) {
      unsure("focus-visible");
      continue;
    }
    const style = view.getComputedStyle(element);
    const width = Number.parseFloat(style.outlineWidth) || 0;
    /* In a view's region the ring is the host's (`!important`): one too faint is the brand's accent, the framework's to hold. */
    let region = false;
    for (let at: Element | null = element; at; at = above(at)) if (at.hasAttribute("data-graview-view-root")) region = true;
    /* The browser's own ring (`outline-style: auto`) is drawn as the browser sees fit: not measured here. */
    if (style.outlineStyle === "auto") {
      unsure("focus-visible");
      continue;
    }
    if (style.outlineStyle === "none" || width === 0) {
      if (style.boxShadow && style.boxShadow !== "none") unsure("focus-visible");
      else options.say("focus-visible", element, "serious", "It shows no ring when it has the keyboard: a person cannot see where they are.", "Leave the outline on :focus-visible (in a view the host draws it; restyle it with --graview-focus-color).", "2.4.7", region);
      continue;
    }
    if (width + 0.01 < 2) {
      options.say("focus-visible", element, "serious", `Its ring is ${width}px: at least 2px is seen.`, "Give the outline 2px or more (--graview-focus-width in a view).", "2.4.7", region);
      continue;
    }
    const ring = colorOf(style.outlineColor, document);
    const ground = above(element) ? groundOf(above(element)!) : undefined;
    if (!ring || !ground) {
      unsure("focus-visible");
      continue;
    }
    const ratio = contrast(composite(ring, ground), ground);
    if (ratio + 0.005 < 3) options.say("focus-visible", element, "serious", `Its ring is at ${ratioWords(ratio)} against what is around it; 3:1 is the least a ring may be.`, "Give the ring a color at 3:1 against the ground (--graview-focus-color in a view; the app's accent is held to it).", "1.4.11", region);
  }
  if (rung > 0) {
    (document.activeElement as HTMLElement | null)?.blur?.();
    if (had && had !== document.body) had.focus?.({ preventScroll: true });
  }

  /* A BOX THAT SCROLLS: what it holds is bigger than it, and it scrolls rather than clips. */
  for (const element of elements) {
    const style = view.getComputedStyle(element);
    const scrolls = /(auto|scroll)/.test(style.overflowX) || /(auto|scroll)/.test(style.overflowY);
    if (!scrolls) continue;
    const box = element as unknown as HTMLElement;
    if (box.scrollHeight > box.clientHeight + 1 || box.scrollWidth > box.clientWidth + 1) options.scrollsOnPage(element);
  }
  return { unmeasured, measured: { contrast: read, "focus-visible": rung } };
}
