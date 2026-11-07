import { tokenize } from "@graview/core/css";

/*
 * THE APP'S THEME WINS (Roadmap f-view-authoring-friction-2026-11). The
 * app's stylesheet for every view (`brand.views.css`) was drawn before the
 * view's own sheet, unlayered as it was, so any rule a view wrote beat it
 * and a design system could not hold. Every sheet in a view's region is now
 * in a cascade layer of the host's, in this order:
 *
 *   graview-motion   less motion where a person asks for it (`!important`)
 *   graview-region   the host's own rules: the ring, the plain button, the
 *                    screen-reader text (`!important` where they must hold)
 *   graview-view     the view's own sheets
 *   graview-theme    the app's stylesheet for every view
 *
 * A later layer's rule wins over an earlier one's whatever the specificity,
 * so wherever the theme and the view style the same element the theme's rule
 * wins, and the view's own class still beats the host's plain button. Two
 * things go past the theme: a view's `!important`, since `!important` reverses
 * the order (and for that reason the host's own `!important` rules beat it),
 * and a `style` attribute on the element, which is in no layer. Inheritance
 * is not the cascade: a theme that sets a font on an ancestor yields to a view
 * that sets one on its own element. Neither sheet can write `@layer` itself
 * (the open kit refuses it), so the order is the host's.
 *
 * THE WRAPPER TRUSTS NO JUDGE. A sheet goes inside a block here, so one `}`
 * in it would close the layer and leave the rest as CSS nobody judged, where
 * a stray `}` at a sheet's top is harmless. The sanitizer refuses that
 * (`readsOtherwise`, core); this reads the text again, as a browser would, and
 * draws nothing of a sheet that is not whole rules with nothing that fetches.
 */
export const VIEW_LAYERS = "@layer graview-motion, graview-region, graview-view, graview-theme;";

const AT_RULES = new Set(["media", "supports", "container", "keyframes", "-webkit-keyframes"]);
const LOADS = new Set(["src", "image-set", "-webkit-image-set"]);
const CLOSES: Readonly<Record<string, string>> = { "}": "{", ")": "(", "]": "[" };

/** Whether text reads as whole rules: every bracket closes what is open, nothing but the kit's at-rules, and nothing that fetches or is read otherwise inside a block. */
export function readsAsWholeRules(css: string): boolean {
  const open: string[] = [];
  const tokens = tokenize(css);
  for (const [index, token] of tokens.entries()) {
    switch (token.type) {
      case "bad-string":
      case "bad-url":
      case "url":
      case "CDO":
      case "CDC":
        return false;
      case "delim":
        if (token.value === "\\") return false;
        break;
      case "at-keyword":
        if (!AT_RULES.has(token.value.toLowerCase())) return false;
        break;
      case ";":
        if (open.length === 0) return false;
        break;
      case "function": {
        const name = token.value.toLowerCase();
        if (LOADS.has(name)) return false;
        if (name === "url") {
          /* The one `url()` the kit keeps: `url("#id")`, a fragment of the view's own drawing. */
          const inside = tokens[index + 1];
          if (inside?.type !== "string" || !inside.value.startsWith("#")) return false;
        }
        open.push("(");
        break;
      }
      case "{":
      case "(":
      case "[":
        open.push(token.type);
        break;
      case "}":
      case ")":
      case "]":
        if (open.pop() !== CLOSES[token.type]) return false;
        break;
      default:
    }
  }
  return open.length === 0;
}

/** A sheet in one of the host's layers; nothing for an empty sheet, or for one that does not read as whole rules. */
export function inLayer(layer: "graview-view" | "graview-theme", css: string): string {
  return css.trim() === "" || !readsAsWholeRules(css) ? "" : `@layer ${layer} {\n${css}\n}`;
}

/** The theme and the view's own sheets as the page draws them: the theme in the layer that wins. The view's alone where there is no theme. */
export function dressedCss(theme: string, own: string): string {
  if (theme.trim() === "") return readsAsWholeRules(own) ? own : "";
  return [VIEW_LAYERS, inLayer("graview-theme", theme), inLayer("graview-view", own)].filter((one) => one !== "").join("\n");
}
