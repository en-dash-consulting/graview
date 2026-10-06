import { estimateWidth, type Measure } from "@graview/layout/view";
import { createContext, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState, type RefObject } from "react";

/**
 * WHAT A DRAWING CAN HONESTLY CLAIM TO BE, at the size it was actually given.
 *
 * A scalable drawing is written once in its own units and handed whatever
 * room the page has. That is the right way round, and it hides a question
 * nobody asks: at THIS size, is what I am drawing still a thing a person
 * can read, or press?
 *
 * A product's site plan answered no on both counts and said nothing. The
 * scene laid its panel out at 136 pixels on a phone; the canvas — a thousand
 * units wide — resolved to 138 by 2 and the drawing did not scale down, it
 * ESCAPED, painting names nine hundred pixels off the side of a 390-pixel
 * screen. Every marker on it was a one-by-one target carrying a keyboard
 * stop and an ARIA label, which is not an accessible control; it is an
 * inaccessible control that has been described. And the whole canvas said
 * `role="img"`, promising a screen reader that the controls inside it were
 * decoration.
 *
 * There is no radius or font size that fixes any of that. At that scale a
 * 24-pixel target is a sixth of the whole picture and twenty of them are one
 * mush. The only honest answer is for the drawing to stop claiming to be a
 * control surface when it is too small to be one, and for something beside
 * it — a list, a key — to become the way in.
 */
export interface DrawnSize {
  /** Rendered pixels per drawing unit. 1 until the first measurement. */
  readonly scale: number;
  /** The rendered width, in real pixels. */
  readonly width: number;
  /** Whether a mark of `target` units clears the 24px floor once drawn. */
  readonly touchable: boolean;
  /** Whether there is enough room for the drawing to say anything at all. */
  readonly legible: boolean;
}

export interface DrawnOptions {
  /** The width of the drawing in its own units — an SVG viewBox width. */
  readonly units: number;
  /** The width of the smallest thing meant to be pressed, in those units. */
  readonly target?: number;
  /** Below this many real pixels, a drawing of any complexity says nothing. */
  readonly legibleAt?: number;
}

export function useDrawnSize(
  ref: RefObject<Element | null>,
  { units, target = 0, legibleAt = 260 }: DrawnOptions,
): DrawnSize {
  const [width, setWidth] = useState(units);
  useEffect(() => {
    const element = ref.current;
    if (element === null || typeof ResizeObserver === "undefined") return;
    const watch = new ResizeObserver(([entry]) => {
      const seen = entry?.contentRect.width ?? 0;
      if (seen > 0) setWidth(seen);
    });
    watch.observe(element);
    return () => watch.disconnect();
  }, [ref]);
  const scale = width / units;
  return { scale, width, touchable: scale * target >= 24, legible: width >= legibleAt };
}

/**
 * A TEXT MEASURER THAT MEASURES, where there is something to measure with.
 *
 * `fitLabel` takes a `Measure` because the honest answer depends on where
 * you are. In a browser it is a 2D canvas context: synchronous, no layout,
 * the same engine that will draw the SVG. The alternative is
 * `getComputedTextLength`, which means rendering wrong once and correcting
 * in an effect every time anything moves.
 *
 * The face matters. Pass the CSS variable the text is actually drawn in —
 * a display serif and a body sans measure very differently, and guessing an
 * average advance for both is what let three names overflow a plan.
 */
export function useTextMeasure(faceVariable = "--graview-font-body", fallback = "sans-serif"): Measure {
  const ruler = useRef<CanvasRenderingContext2D | null | undefined>(undefined);
  const face = useMemo(() => {
    if (typeof getComputedStyle !== "function" || typeof document === "undefined") return fallback;
    const said = getComputedStyle(document.documentElement).getPropertyValue(faceVariable).trim();
    return said.length > 0 ? said : fallback;
  }, [faceVariable, fallback]);
  return useMemo(() => {
    if (ruler.current === undefined) {
      ruler.current =
        typeof document === "undefined" ? null : (document.createElement("canvas").getContext("2d") ?? null);
    }
    const context = ruler.current;
    if (context === null) return estimateWidth;
    return (text, fontSize) => {
      context.font = `${fontSize}px ${face}`;
      const measured = context.measureText(text).width;
      /* jsdom's stub answers 0 for everything, and so does a context that
         has lost its backing store. Either way the estimate is the answer. */
      return measured > 0 ? measured : estimateWidth(text, fontSize);
    };
  }, [face]);
}

/**
 * HOW WIDE A SHOWING'S NAME IS DRAWN on a district's marquee (FR-118), in
 * the face the scene actually draws it in.
 *
 * The room under a signpost is sized before the names are drawn, and it was
 * sized for an average letter: a brand whose body is a wide display face ran
 * the column past its district into the one below. This reads the face off
 * the scene's own element — an embed scopes its brand to itself, so the
 * document's root may not have it — and measures at the marquee's size and
 * its heavier weight, again once the brand's fonts have loaded. Undefined
 * where nothing can measure (no canvas, jsdom): the layout estimates.
 */
export function useMarqueeNameWidth(within: RefObject<Element | null>, rootPx: number): ((text: string) => number) | undefined {
  const [face, setFace] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(0);
  useLayoutEffectIfAny(() => {
    const element = within.current;
    if (element === null || typeof getComputedStyle !== "function") return;
    const said = getComputedStyle(element).fontFamily.trim();
    if (said.length > 0 && said !== face) setFace(said);
  });
  useEffect(() => {
    const fonts = typeof document === "undefined" ? undefined : document.fonts;
    if (!fonts?.addEventListener) return;
    const again = () => setLoaded((n) => n + 1);
    fonts.addEventListener("loadingdone", again);
    void fonts.ready?.then(again, () => {});
    return () => fonts.removeEventListener("loadingdone", again);
  }, []);
  return useMemo(() => {
    if (face === null || typeof document === "undefined") return undefined;
    const context = document.createElement("canvas").getContext("2d");
    if (!context) return undefined;
    // The marquee's 0.8125rem, at the weight of the showing that is pressed: the wider of the two it is drawn in.
    context.font = `600 ${0.8125 * rootPx}px ${face}`;
    if (!(context.measureText("Mm").width > 0)) return undefined;
    const held = new Map<string, number>();
    return (text: string) => {
      let width = held.get(text);
      if (width === undefined) held.set(text, (width = context.measureText(text).width));
      return width;
    };
    // `loaded` is in the list on purpose: a face that has loaded since measures differently.
  }, [face, rootPx, loaded]);
}

/** The scene's measure of a marquee name, handed to the districts that draw one, so the room a district keeps is the room the layout made. */
export const NameWidthContext = createContext<((text: string) => number) | undefined>(undefined);
/** How wide a showing's name is drawn here, or undefined where the scene could not measure (the estimate is then the answer). */
export function useNameWidth(): ((text: string) => number) | undefined {
  return useContext(NameWidthContext);
}

/** A layout effect where there is a layout, an ordinary one on a server; every render, as the face can change under it. */
const useLayoutEffectIfAny = typeof document === "undefined" ? useEffect : useLayoutEffect;
