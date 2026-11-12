/*
 * WHAT IS SAID OF A VIEW'S OWN FACE (HQ f-view-font-face-data), in a module
 * of its own: needed only where a face was refused, so a view that declares
 * none never carries it.
 */
import { VIEW_FACE_DESCRIPTORS, VIEW_FACE_MOST_BYTES, VIEW_FACES_MOST, VIEW_FACES_MOST_BYTES, type ViewFaceProblem } from "./faces.js";
import type { CssRefusal } from "./sanitize.js";

const KB = (bytes: number) => `${(bytes / 1_000).toLocaleString("en-US", { maximumFractionDigits: 1 })} KB`;
const DRAWS = "a view's face is a data: URL of a WOFF2, WOFF, TTF or OTF font (src: url(data:font/woff2;base64,…))";
const LENT = "or a face the app lends its views (brand.views.fonts)";

/** One refusal of a view's face, said to its author: what was refused, why, and what would do, ending with its finding code. */
export function viewFaceRefusedWords(refusal: CssRefusal): string {
  const named = refusal.family !== undefined ? `the @font-face "${refusal.family}"` : "an @font-face";
  switch (refusal.name as ViewFaceProblem) {
    case "where":
      return `Not drawn: an @font-face inside @media, @supports, @container or a rule. A view's face is declared at the top of its stylesheet (view-font-face).`;
    case "unreadable":
      return `Not drawn: ${named}, which has something before its block. A face is @font-face { font-family: …; src: … } (view-font-face).`;
    case "family":
      return `Not drawn: ${named}: ${refusal.said ?? "its font-family is one name, in quotes or as plain words"}. It is called by a name of its own, which the view's rules then name (view-font-face-family).`;
    case "src":
      return `Not drawn: ${named} has ${refusal.said === "no src" ? "no src" : "a src that is no url()"}: ${DRAWS} (view-font-face-src).`;
    case "address":
      return `Not loaded: ${named} names url(${JSON.stringify(refusal.said ?? "")}). A view loads nothing from the network: ${DRAWS}, ${LENT} (view-font-face-src).`;
    case "local":
      return `Not loaded: ${named} names local(), a face installed on the reader's own machine, which differs from one reader to the next and tells the page what is installed: ${DRAWS} (view-font-face-src).`;
    case "type":
      return `Not loaded: ${named} is a data: URL of ${refusal.said ?? "no type"}, not a font: ${DRAWS} (view-font-face-type).`;
    case "encoding":
      return `Not loaded: ${named} is a data: URL that is not base64, or not base64 throughout: ${DRAWS} (view-font-face-type).`;
    case "bytes":
      return `Not loaded: ${named} holds bytes that are not a WOFF2, WOFF, TrueType or OpenType file, whatever its data: URL says (view-font-face-type).`;
    case "size":
      return `Not loaded: ${named} is ${KB(refusal.bytes ?? 0)} decoded, more than the ${KB(VIEW_FACE_MOST_BYTES)} one face a view declares may be: subset it to the letters the view draws, ${LENT}, which may be larger (view-font-face-size).`;
    case "total":
      return `Not loaded: ${named} would take the view's faces to ${KB(refusal.bytes ?? 0)}, more than the ${KB(VIEW_FACES_MOST_BYTES)} a view's faces may be together: the faces before it are drawn, and the app may lend the rest (brand.views.fonts) (view-font-faces-size).`;
    case "count":
      return `Not loaded: ${named} is more than the ${VIEW_FACES_MOST} faces a view's stylesheets may declare (view-font-faces-size).`;
    case "descriptor":
      return `Not kept: ${refusal.descriptor ?? "a descriptor"} in ${named}. A view's face takes ${VIEW_FACE_DESCRIPTORS.slice(0, -1).join(", ")} and ${VIEW_FACE_DESCRIPTORS.at(-1)}, and is drawn without the rest (view-font-face-descriptor).`;
    case "value":
      return `Not kept: the ${refusal.descriptor ?? "descriptor"} of ${named}, a value a face does not take, so the face is drawn as if it said none (view-font-face-descriptor).`;
    case "lent":
      return `Not loaded: ${named}, since the app lends its views a face by that name (brand.views.fonts), and the app's face is the one drawn: call the view's own something else (view-font-face-lent).`;
    default:
      return `Not drawn: ${named} (view-font-face).`;
  }
}
