import { themeCss, type Scheme } from "@graview/primitives";
import { createRoot } from "react-dom/client";
import { seedbedBrand } from "./domain/brand.js";
import { PagesApp } from "@graview/pages";
import { createSeedbedUiStore, SeedbedApp } from "./ui/app.js";

const sheet = new CSSStyleSheet();
document.adoptedStyleSheets = [sheet];

const STORED = "graview:scheme";

function initialScheme(): Scheme {
  const asked = new URLSearchParams(window.location.search).get("theme");
  if (asked === "light" || asked === "dark") return asked;
  try {
    const stored = localStorage.getItem(STORED);
    if (stored === "light" || stored === "dark") return stored;
  } catch {
    // A scheme that cannot be remembered still applies for this visit.
  }
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export function applyScheme(scheme: Scheme): void {
  sheet.replaceSync(themeCss(scheme, seedbedBrand));
  document.documentElement.dataset["graviewScheme"] = scheme;
  try {
    localStorage.setItem(STORED, scheme);
  } catch {
    // Same again: not being able to remember is not a reason to fail.
  }
}

const scheme = initialScheme();
applyScheme(scheme);

const root = document.getElementById("root");
if (!root) throw new Error("no #root");
if (window.location.pathname.startsWith("/pages")) {
  // The routed, responsive face: same store, same ids, one app.
  createRoot(root).render(
    <PagesApp basename="/pages" context={{ store: createSeedbedUiStore(), brand: seedbedBrand, sceneHref: "/" }} />,
  );
} else {
  createRoot(root).render(
    <SeedbedApp syncUrl renderer="dom" initialScheme={scheme} onSchemeChange={applyScheme} />,
  );
}

(window as unknown as Record<string, unknown>)["__seedbedReady"] = { renderer: "dom", scheme };
