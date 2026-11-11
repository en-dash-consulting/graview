import type { ViewFace } from "@graview/core/css";

/*
 * A VIEW'S OWN FACE BESIDE THE APP'S (HQ f-view-font-face-data). In the
 * document a face is the page's, so a face a view's stylesheet declares
 * under a family the app lends its views (`brand.views.fonts`) would put a
 * second file under the app's name, redrawing every view set in it. The
 * app's face wins, as the app's stylesheet for every view wins over a
 * view's own rules: the view's is not loaded, and that is said. Within the
 * faces views declare, one name from two files is the last lent's, as it is
 * among lent faces (host/fonts.ts). Pure, for the page's host and a
 * headless run alike.
 */

/** The faces of a view's own named, without regard to case, as a family the app lends its views. */
export function lentNamed(faces: readonly ViewFace[], lent: readonly string[] | undefined): readonly ViewFace[] {
  if (!lent || lent.length === 0) return [];
  const names = new Set(lent.map((family) => family.toLowerCase()));
  return faces.filter((face) => names.has(face.family.toLowerCase()));
}
