/*
 * The companion, as the pages draw it in the "Ask" drawer: its own module
 * so `./ask.tsx` can fetch it when the drawer opens (FR-57). Imported by
 * name, not as `import("@graview/primitives")`: a namespace fetched whole
 * keeps every export of the package alive, the lenses with it.
 */
export { Companion } from "@graview/primitives/scene";
