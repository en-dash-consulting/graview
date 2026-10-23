import { HTML_NAMESPACE, type TreeElement, type TreeNode } from "./tree.js";

/*
 * WHAT A HEADLESS RUN DREW, AS MARKUP (`graview view check --audit
 * --browser`). The tree a view drew into — after the host's own marks, so a
 * link or a press carries the keyboard and the role the page gives it — said
 * as HTML a browser parses back into the same elements, to be laid out and
 * held to the rules that need a page. Text and attribute values are escaped;
 * an SVG's elements keep their names as written, and a field its live value.
 */

const VOID = new Set(["area", "base", "br", "col", "embed", "hr", "img", "input", "link", "meta", "source", "track", "wbr"]);
const text = (value: string) => value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
const attribute = (value: string) => value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

/** The markup of what is under `root` (not `root` itself); each element in `marked` carries `mark` as an attribute. */
export function markupOf(root: TreeElement, marked: ReadonlySet<TreeElement> = new Set(), mark = "data-graview-audit-clicked"): string {
  const out: string[] = [];
  const walk = (node: TreeNode) => {
    if (node.nodeType === 3) {
      out.push(text(node.textContent));
      return;
    }
    if (node.nodeType !== 1) return;
    const element = node as TreeElement;
    const name = element.localName;
    const attributes = new Map(element.attributes);
    if (element.namespaceURI === HTML_NAMESPACE && (name === "input" || name === "textarea" || name === "select")) {
      if (name === "input" && element.value !== "" && !attributes.has("value")) attributes.set("value", element.value);
      if (element.checked && !attributes.has("checked")) attributes.set("checked", "");
    }
    if (element.selected && name === "option" && !attributes.has("selected")) attributes.set("selected", "");
    if (marked.has(element)) attributes.set(mark, "");
    out.push(`<${name}`);
    for (const [key, value] of attributes) {
      // A name the parser would read as something else is left out: a page's element never had it either.
      if (!/^[A-Za-z_:][-A-Za-z0-9_.:]*$/.test(key)) continue;
      out.push(value === "" ? ` ${key}` : ` ${key}="${attribute(value)}"`);
    }
    out.push(">");
    if (element.namespaceURI === HTML_NAMESPACE && VOID.has(name)) return;
    if (name === "textarea" && element.value !== "" && element.childNodes.length === 0) out.push(text(element.value));
    for (const child of element.childNodes) walk(child);
    out.push(`</${name}>`);
  };
  for (const child of root.childNodes) walk(child);
  return out.join("");
}
