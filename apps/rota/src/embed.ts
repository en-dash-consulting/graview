import { mount } from "@graview/embed";
import example from "./data/example.json";
import { rotaApp } from "./domain/app.js";
import { rotaViews } from "./ui/views.js";
import { EXAMPLE_TODAY } from "./ui/when.js";

/*
 * THE ROSTER, TWICE, ON A PAGE THAT LOOKS NOTHING LIKE IT.
 *
 * Each mount carries Rota's own theme scoped to its own element — the brand,
 * the kit, the typefaces — and leaves the host page's serif and paper
 * completely alone. Two stops, two pictures, one declaration: the week over
 * the shifts, and the coverage grid over the volunteers.
 *
 * The seat is the volunteer's, because that is the honest one for a public
 * page: somebody reading an article about the hall may take a shift on, and
 * may not rewrite the roster. Every act they cannot take says so.
 */
const seat = { kind: "human" as const, id: "user-ada", roles: ["volunteer"] };
const common = {
  app: rotaApp as never,
  seed: example as never,
  views: () => rotaViews() as never,
  principal: seat,
  storeOptions: { invariantOptions: { context: { today: EXAMPLE_TODAY } } },
};

mount(document.getElementById("week")!, {
  ...common,
  stop: "#focus=agg:shift&in.view=the-week",
  label: "The week",
} as never);

mount(document.getElementById("coverage")!, {
  ...common,
  stop: "#focus=agg:volunteer",
  label: "Who is covering what",
} as never);
