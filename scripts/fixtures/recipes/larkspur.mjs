#!/usr/bin/env node
/**
 * LARKSPUR: A MADE-UP REPOSITORY, THE SIZE OF A REAL ONE.
 *
 * The recipes on graview.dev are one prompt with a different task each —
 * "turn this repo's docs into a Graview app", "…its decisions…", "…its
 * dependencies…" — and a prompt needs a repository to run in. This writes
 * one: Larkspur, a booking service for small clinics, as a TypeScript
 * monorepo with sixteen modules, READMEs and guides (some missing), a
 * CODEOWNERS that does not cover everything, fourteen architecture decision
 * records that supersede each other, and package manifests pinned at the
 * versions a team two years in would have.
 *
 * Nothing in it is real: the people are handles, the decisions are the
 * ordinary ones. The committed recipes (docs/site/recipes/) are what an agent
 * produced from this repository given only the prompt and graview.dev/start.md,
 * and anyone can run the prompt again in what this writes:
 *
 *   node scripts/fixtures/recipes/larkspur.mjs <dir>
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

const out = resolve(process.argv[2] ?? "larkspur");

const write = (path, text) => {
  const file = join(out, path);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${text.trim()}\n`);
};

/* ── the modules ─────────────────────────────────────────────────────── */

/** Each module: where it is, what it does, whether it has a README, and what it depends on. */
const MODULES = [
  { dir: "services/web", what: "The patient-facing booking site (Next.js).", readme: true, deps: { next: "14.1.0", react: "18.2.0", "react-dom": "18.2.0", "@larkspur/ui-kit": "workspace:*", "@larkspur/api-client": "workspace:*", "date-fns": "2.30.0" } },
  { dir: "services/admin", what: "The clinic staff's admin console: calendars, staff, billing settings.", readme: true, deps: { react: "18.2.0", "react-dom": "18.2.0", "react-router-dom": "6.22.3", graphql: "16.8.1", "@apollo/client": "3.9.9", "@larkspur/ui-kit": "workspace:*" } },
  { dir: "services/api", what: "The HTTP API: REST for the booking site, GraphQL for the admin console.", readme: true, deps: { express: "4.18.3", graphql: "16.8.1", "graphql-http": "1.22.0", pg: "8.11.3", zod: "3.22.4", pino: "8.19.0", jsonwebtoken: "9.0.2", "@larkspur/auth": "workspace:*", "@larkspur/scheduling": "workspace:*", "@larkspur/billing": "workspace:*" } },
  { dir: "services/worker", what: "Background jobs: reminders, invoice retries, search reindexing.", readme: true, deps: { bullmq: "5.4.2", ioredis: "5.3.2", pino: "8.19.0", "@larkspur/notifications": "workspace:*", "@larkspur/billing": "workspace:*" } },
  { dir: "packages/auth", what: "Sign-in, sessions and staff roles.", readme: true, deps: { jsonwebtoken: "9.0.2", "@node-rs/argon2": "1.8.0", zod: "3.22.4" } },
  { dir: "packages/billing", what: "Invoices, payments and the retry schedule, on Stripe.", readme: true, deps: { stripe: "14.21.0", zod: "3.22.4" } },
  { dir: "packages/scheduling", what: "Availability, appointment slots and the booking rules.", readme: true, deps: { "date-fns": "2.30.0", "date-fns-tz": "2.0.1", zod: "3.22.4" } },
  { dir: "packages/notifications", what: "Email and SMS reminders.", readme: true, deps: { nodemailer: "6.9.13", twilio: "4.23.0" } },
  { dir: "packages/search", what: "Clinic and practitioner search.", readme: false, deps: { pg: "8.11.3" } },
  { dir: "packages/ui-kit", what: "Shared React components on Radix primitives.", readme: true, deps: { "@radix-ui/react-dialog": "1.0.5", "@radix-ui/react-popover": "1.0.7", "class-variance-authority": "0.7.0" } },
  { dir: "packages/api-client", what: "The typed client the booking site calls the API with.", readme: true, deps: { zod: "3.22.4" } },
  { dir: "packages/shared-types", what: "Types shared by the API and its clients.", readme: true, deps: {} },
  { dir: "packages/config", what: "Environment parsing and feature flags.", readme: false, deps: { zod: "3.22.4", dotenv: "16.4.5" } },
  { dir: "packages/telemetry", what: "Logging and tracing setup.", readme: false, deps: { "@opentelemetry/api": "1.8.0", "@opentelemetry/sdk-node": "0.49.1", pino: "8.19.0" } },
  { dir: "tools/migrate", what: "Database migrations and the runner.", readme: true, deps: { pg: "8.11.3", "node-pg-migrate": "6.2.2" } },
  { dir: "tools/seed-data", what: "Fake clinics and patients for local development.", readme: false, deps: { "@faker-js/faker": "8.4.1" } },
];

const nameOf = (dir) => `@larkspur/${dir.split("/")[1]}`;

for (const module of MODULES) {
  write(
    `${module.dir}/package.json`,
    JSON.stringify({ name: nameOf(module.dir), version: "0.0.0", private: true, type: "module", description: module.what, dependencies: module.deps }, null, 2),
  );
  write(`${module.dir}/src/index.ts`, `// ${module.what}\nexport {};`);
  if (module.readme) {
    write(
      `${module.dir}/README.md`,
      `# ${nameOf(module.dir)}\n\n${module.what}\n\n## Running it\n\n\`pnpm --filter ${nameOf(module.dir)} dev\` from the repository root.\n`,
    );
  }
}

write(
  "package.json",
  JSON.stringify(
    {
      name: "larkspur",
      private: true,
      packageManager: "pnpm@8.15.4",
      engines: { node: ">=18" },
      scripts: { dev: "turbo dev", build: "turbo build", test: "vitest run", lint: "eslint .", e2e: "playwright test" },
      devDependencies: {
        typescript: "5.4.5",
        vitest: "1.6.0",
        eslint: "8.57.0",
        prettier: "3.2.5",
        "@playwright/test": "1.44.0",
        turbo: "1.13.3",
        "@types/node": "18.19.31",
      },
    },
    null,
    2,
  ),
);
write("pnpm-workspace.yaml", `packages:\n  - "services/*"\n  - "packages/*"\n  - "tools/*"`);

/* ── the docs ────────────────────────────────────────────────────────── */

write(
  "README.md",
  `# Larkspur

Online booking for small clinics: patients book, staff run the calendar,
the clinic gets paid.

- \`services/\` — what runs: the booking site, the admin console, the API, the worker.
- \`packages/\` — what they share.
- \`tools/\` — migrations and local data.
- \`docs/\` — guides, runbooks, the API reference and the decision records.

Start with [docs/onboarding.md](docs/onboarding.md).`,
);

/** Each guide or runbook: its path, its title, and the modules it is about. */
const DOCS = [
  ["docs/onboarding.md", "Onboarding", "Your first week: the repository, the services, how to run everything locally.", ["services/web", "services/api", "services/worker", "tools/seed-data"]],
  ["docs/architecture.md", "Architecture", "How the booking site, the admin console, the API and the worker fit together.", ["services/web", "services/admin", "services/api", "services/worker"]],
  ["docs/guides/auth-flows.md", "Auth flows", "Patient sign-in by email link, staff sign-in by password, and how sessions are kept.", ["packages/auth"]],
  ["docs/guides/scheduling-rules.md", "Scheduling rules", "How availability becomes slots: buffers, double-booking, clinic time zones.", ["packages/scheduling"]],
  ["docs/guides/notifications.md", "Sending reminders", "When reminders go out, by which channel, and how to test them locally.", ["packages/notifications", "services/worker"]],
  ["docs/guides/ui-kit.md", "Using the UI kit", "Which component to reach for, and how to add one.", ["packages/ui-kit"]],
  ["docs/guides/writing-migrations.md", "Writing migrations", "One change per migration, always reversible, and how to run them.", ["tools/migrate"]],
  ["docs/guides/feature-flags.md", "Feature flags", "Adding a flag, reading it, and taking it out again.", ["packages/config"]],
  ["docs/api/rest.md", "REST API", "Every endpoint the booking site calls.", ["services/api", "packages/api-client"]],
  ["docs/api/graphql.md", "Admin GraphQL schema", "The schema the admin console queries.", ["services/api", "services/admin"]],
  ["docs/api/webhooks.md", "Webhooks", "The Stripe webhooks we accept and what each does.", ["services/api", "packages/billing"]],
  ["docs/runbooks/deploys.md", "Deploying", "How a change reaches production, and how to roll one back.", ["services/web", "services/api", "services/worker"]],
  ["docs/runbooks/incidents.md", "Incidents", "Who is paged, what to check first, and how to write it up.", []],
  ["docs/runbooks/billing-retries.md", "Failed payments", "What the retry schedule does, and when to step in.", ["packages/billing", "services/worker"]],
  ["docs/runbooks/queue-backlog.md", "Queue backlog", "When the worker falls behind: what to look at and what is safe to drain.", ["services/worker"]],
];

for (const [path, title, what, about] of DOCS) {
  write(
    path,
    `# ${title}\n\n${what}\n\n${about.length ? `Covers: ${about.map((dir) => `\`${dir}\``).join(", ")}.\n\n` : ""}_Last reviewed: 2025-${String(2 + (title.length % 9)).padStart(2, "0")}-${String(3 + (title.length % 24)).padStart(2, "0")}._`,
  );
}

/* ── who owns what ───────────────────────────────────────────────────── */

write(
  ".github/CODEOWNERS",
  `# Who reviews what. Unlisted paths fall to whoever is on call.
/services/web/            @maya-r
/services/admin/          @maya-r @ola-b
/services/api/            @devon-k
/services/worker/         @tomas-l
/packages/auth/           @devon-k @priya-s
/packages/billing/        @priya-s
/packages/scheduling/     @wen-h
/packages/notifications/  @tomas-l
/packages/ui-kit/         @ola-b
/packages/api-client/     @devon-k
/packages/shared-types/   @devon-k
/packages/config/         @sam-j
/tools/migrate/           @sam-j
/docs/runbooks/           @tomas-l @sam-j`,
);

/* ── the decisions ───────────────────────────────────────────────────── */

/** Each record: number, title, status, date, what it supersedes, the modules it affects, and why. */
const ADRS = [
  [1, "One repository, managed with pnpm workspaces", "accepted", "2023-03-02", null, [], "Four services and their shared code changed together in nearly every pull request. One repository lets one change land atomically; pnpm workspaces link the packages without publishing them."],
  [2, "PostgreSQL as the only database", "accepted", "2023-03-09", null, ["services/api", "tools/migrate", "packages/search"], "The data is relational — clinics, practitioners, slots, appointments — and the team knows Postgres. One database is one thing to back up and one thing to page about."],
  [3, "REST for every client", "superseded", "2023-03-16", null, ["services/api", "packages/api-client"], "One style of API is less to learn. The booking site's needs are simple reads and a few writes."],
  [4, "Sessions as signed JWTs", "superseded", "2023-04-04", null, ["packages/auth", "services/api"], "Stateless tokens avoid a session table and let any API instance verify a request."],
  [5, "Background jobs in a Postgres table", "superseded", "2023-04-20", null, ["services/worker"], "A jobs table with SKIP LOCKED is enough for reminder volume and adds no infrastructure."],
  [6, "Feature flags in configuration, not a service", "accepted", "2023-05-11", null, ["packages/config"], "Flags are read at boot from the environment. A flag service is a dependency we do not need at this size."],
  [7, "The UI kit is built on Radix primitives", "accepted", "2023-06-01", null, ["packages/ui-kit", "services/web", "services/admin"], "Accessible behavior — focus, dialogs, popovers — is the hard part of a component library. Radix does it; we style it."],
  [8, "Every clinic has exactly one time zone", "accepted", "2023-07-19", null, ["packages/scheduling"], "Slots are computed in the clinic's zone and stored in UTC. A clinic spanning zones is two clinics."],
  [9, "Server-side sessions in Postgres", "accepted", "2023-11-08", 4, ["packages/auth", "services/api"], "Signed tokens could not be revoked when a staff member left a clinic. Sessions are rows now; signing out everywhere is a delete."],
  [10, "Stripe for payments and invoices", "accepted", "2023-08-24", null, ["packages/billing", "services/api"], "Clinics already have Stripe accounts, and Stripe's retry schedule and webhooks cover what we would otherwise build."],
  [11, "GraphQL for the admin console", "accepted", "2024-01-17", 3, ["services/api", "services/admin"], "The admin console grew dozens of screens that each needed a slightly different shape. GraphQL serves them from one schema; the booking site stays on REST."],
  [12, "Move the job queue to Redis with BullMQ", "accepted", "2024-04-02", 5, ["services/worker"], "Reminder volume grew tenfold and the jobs table became the busiest table in the database. BullMQ gives retries, delays and a dashboard."],
  [13, "Search on Postgres full-text search", "proposed", "2025-02-12", null, ["packages/search"], "A search service is more infrastructure than clinic and practitioner names justify. Postgres tsvector columns with a trigram index should do."],
  [14, "Drop Node 18", "proposed", "2025-03-03", null, ["services/web", "services/admin", "services/api", "services/worker"], "Node 18 reached end of life. Moving every service to Node 22 lets us drop two polyfills and upgrade the toolchain."],
];

for (const [n, title, status, date, supersedes, affects, why] of ADRS) {
  const id = String(n).padStart(4, "0");
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const supersededBy = ADRS.find((other) => other[4] === n);
  write(
    `docs/adr/${id}-${slug}.md`,
    `# ${n}. ${title}

- Status: ${status}${supersededBy ? ` (superseded by ADR ${supersededBy[0]})` : ""}
- Date: ${date}${supersedes ? `\n- Supersedes: ADR ${supersedes}` : ""}
- Affects: ${affects.length ? affects.map((dir) => `\`${dir}\``).join(", ") : "the whole repository"}

## Context and decision

${why}

## Consequences

${status === "proposed" ? "To be decided at the next architecture review." : "Recorded in the code and the guides that cover the affected modules."}`,
  );
}

write(
  "docs/adr/README.md",
  `# Decision records

One file per decision, numbered, never edited after it is accepted — a
changed mind is a new record that supersedes the old one.`,
);

process.stdout.write(`wrote Larkspur into ${out}\n`);
